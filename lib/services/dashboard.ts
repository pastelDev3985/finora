import { prisma } from "@/lib/db"
import { sumExpensesByCategoryIds } from "@/lib/services/budgets"
import { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace"
import type {
  ServiceResult,
  DashboardSummary,
  BudgetWithSpend,
  GoalData,
  TransactionData,
} from "@/types/index"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)
  return { month, year, startDate, endDate }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getDashboardSummary(
  userId: string
): Promise<ServiceResult<DashboardSummary>> {
  const { month, year, startDate, endDate } = currentMonthRange()

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { lte: endDate } },
      select: { type: true, amount: true, date: true },
    })

    let totalIncome = new Decimal(0)
    let totalExpenses = new Decimal(0)
    let balance = new Decimal(0)

    for (const tx of transactions) {
      if (tx.type === "INCOME") {
        balance = balance.add(tx.amount)
      } else {
        balance = balance.sub(tx.amount)
      }

      // Keep the summary totals monthly while carrying the resulting balance
      // forward from all earlier months.
      if (tx.date >= startDate) {
        if (tx.type === "INCOME") totalIncome = totalIncome.add(tx.amount)
        else totalExpenses = totalExpenses.add(tx.amount)
      }
    }

    return {
      data: {
        totalIncome,
        totalExpenses,
        net: balance,
        month,
        year,
      },
    }
  } catch (error) {
    console.error("[getDashboardSummary]", error)
    return { error: "Failed to fetch dashboard summary" }
  }
}

export async function getBudgetHealthStrip(
  userId: string
): Promise<ServiceResult<BudgetWithSpend[]>> {
  const { month, year } = currentMonthRange()

  try {
    const budgets = await prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    })

    const spentByCategory = await sumExpensesByCategoryIds(
      userId,
      budgets.map((b) => b.categoryId),
      month,
      year
    )

    const withSpend: BudgetWithSpend[] = budgets.map((b) => {
      const spentAmount =
        spentByCategory.get(b.categoryId) ?? new Decimal(0)
      const percentUsed = b.limitAmount.equals(0)
        ? 0
        : spentAmount.div(b.limitAmount).mul(100).toNumber()

      return {
        ...b,
        spentAmount,
        percentUsed: Math.round(percentUsed * 10) / 10,
        isOverBudget: spentAmount.greaterThan(b.limitAmount),
      }
    })

    return { data: withSpend }
  } catch (error) {
    console.error("[getBudgetHealthStrip]", error)
    return { error: "Failed to fetch budget health" }
  }
}

export async function getTopGoals(
  userId: string,
  limit = 3
): Promise<ServiceResult<GoalData[]>> {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { savedAmount: "desc" },
      take: limit,
    })
    return { data: goals as GoalData[] }
  } catch (error) {
    console.error("[getTopGoals]", error)
    return { error: "Failed to fetch goals" }
  }
}

export async function getRecentTransactions(
  userId: string,
  limit = 8
): Promise<ServiceResult<TransactionData[]>> {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: "desc" },
      take: limit,
    })
    return { data: transactions as TransactionData[] }
  } catch (error) {
    console.error("[getRecentTransactions]", error)
    return { error: "Failed to fetch recent transactions" }
  }
}
