import { z } from "zod"
import { prisma } from "@/lib/db"
import { validateExpenseAgainstBudget } from "@/lib/services/budgets"
import { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace"
import type {
  ServiceResult,
  TransactionData,
  TransactionSummary,
  PaginatedResult,
} from "@/types/index"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateTransactionSchema = z.object({
  categoryId: z.string().min(1, { error: "Category is required" }),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      error: "Amount must be a positive number",
    }),
  date: z.coerce.date(),
  note: z.string().trim().optional(),
  recurrence: z
    .enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
    .optional()
    .default("NONE"),
})

const UpdateTransactionSchema = CreateTransactionSchema.partial()

const TransactionFiltersSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  sort: z
    .enum(["date_desc", "date_asc", "category_asc", "category_desc"])
    .optional()
    .default("date_desc"),
})

// ─── Service functions ────────────────────────────────────────────────────────

export async function listTransactions(
  userId: string,
  filters: unknown = {}
): Promise<ServiceResult<PaginatedResult<TransactionData>>> {
  const parsed = TransactionFiltersSchema.safeParse(filters)
  if (!parsed.success) {
    return { error: "Invalid filter parameters" }
  }

  const { startDate, endDate, type, categoryId, page, limit, sort } =
    parsed.data
  const skip = (page - 1) * limit

  const orderBy =
    sort === "date_asc"
      ? ([{ date: "asc" as const }, { id: "asc" as const }] as const)
      : sort === "category_asc"
        ? ([
            { category: { name: "asc" as const } },
            { date: "desc" as const },
            { id: "desc" as const },
          ] as const)
        : sort === "category_desc"
          ? ([
              { category: { name: "desc" as const } },
              { date: "desc" as const },
              { id: "desc" as const },
            ] as const)
          : ([{ date: "desc" as const }, { id: "desc" as const }] as const)

  const where = {
    userId,
    ...(type ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  }

  try {
    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: [...orderBy],
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return {
      data: {
        data: transactions as TransactionData[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    console.error("[listTransactions]", error)
    return { error: "Failed to fetch transactions" }
  }
}

export async function getTransactionById(
  userId: string,
  id: string
): Promise<ServiceResult<TransactionData>> {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id, userId },
      include: { category: true },
    })

    if (!transaction) return { error: "Transaction not found" }
    return { data: transaction as TransactionData }
  } catch (error) {
    console.error("[getTransactionById]", error)
    return { error: "Failed to fetch transaction" }
  }
}

export async function createTransaction(
  userId: string,
  data: unknown
): Promise<ServiceResult<TransactionData>> {
  const parsed = CreateTransactionSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors[0] ?? "Invalid input" }
  }

  try {
    if (parsed.data.type === "EXPENSE") {
      const budgetError = await validateExpenseAgainstBudget(
        userId,
        parsed.data.categoryId,
        new Decimal(parsed.data.amount),
        parsed.data.date
      )
      if (budgetError) return { error: budgetError }
    }

    const transaction = await prisma.transaction.create({
      data: {
        ...parsed.data,
        amount: new Decimal(parsed.data.amount),
        userId,
      },
      include: { category: true },
    })
    return { data: transaction as TransactionData }
  } catch (error) {
    console.error("[createTransaction]", error)
    return { error: "Failed to create transaction" }
  }
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: unknown
): Promise<ServiceResult<TransactionData>> {
  const parsed = UpdateTransactionSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors[0] ?? "Invalid input" }
  }

  try {
    const current = await prisma.transaction.findUnique({
      where: { id, userId },
      select: { categoryId: true, type: true, amount: true, date: true },
    })
    if (!current) return { error: "Transaction not found" }

    const nextCategoryId = parsed.data.categoryId ?? current.categoryId
    const nextType = parsed.data.type ?? current.type
    const nextAmount = parsed.data.amount
      ? new Decimal(parsed.data.amount)
      : current.amount
    const nextDate = parsed.data.date ?? current.date

    if (nextType === "EXPENSE") {
      const budgetError = await validateExpenseAgainstBudget(
        userId,
        nextCategoryId,
        nextAmount,
        nextDate,
        id
      )
      if (budgetError) return { error: budgetError }
    }

    const transaction = await prisma.transaction.update({
      where: { id, userId },
      data: {
        ...parsed.data,
        ...(parsed.data.amount
          ? { amount: new Decimal(parsed.data.amount) }
          : {}),
      },
      include: { category: true },
    })
    return { data: transaction as TransactionData }
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return { error: "Transaction not found" }
    }
    console.error("[updateTransaction]", error)
    return { error: "Failed to update transaction" }
  }
}

export async function deleteTransaction(
  userId: string,
  id: string
): Promise<ServiceResult<{ id: string }>> {
  try {
    await prisma.transaction.delete({ where: { id, userId } })
    return { data: { id } }
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return { error: "Transaction not found" }
    }
    console.error("[deleteTransaction]", error)
    return { error: "Failed to delete transaction" }
  }
}

export async function getTransactionSummary(
  userId: string,
  month: number,
  year: number
): Promise<ServiceResult<TransactionSummary>> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      select: { type: true, amount: true },
    })

    let totalIncome = new Decimal(0)
    let totalExpenses = new Decimal(0)

    for (const tx of transactions) {
      if (tx.type === "INCOME") {
        totalIncome = totalIncome.add(tx.amount)
      } else {
        totalExpenses = totalExpenses.add(tx.amount)
      }
    }

    return {
      data: {
        totalIncome,
        totalExpenses,
        net: totalIncome.sub(totalExpenses),
      },
    }
  } catch (error) {
    console.error("[getTransactionSummary]", error)
    return { error: "Failed to calculate transaction summary" }
  }
}
