import { auth } from "@/lib/auth"
import { formatCurrency, getCurrencySymbol } from "@/lib/currency"
import { Decimal } from "@/lib/generated/prisma/internal/prismaNamespace"
import { listCategories } from "@/lib/services/categories"
import {
  getBudgetAllocationSummary,
  listBudgets,
} from "@/lib/services/budgets"
import { BudgetsClient } from "@/components/budgets/budgets-client"

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function BudgetsPage({ searchParams }: Props) {
  const session = await auth()
  const userId = session!.user.id
  const currency = session!.user.currency ?? "GHS"
  const currencySymbol = getCurrencySymbol(currency)

  const { month: monthStr, year: yearStr } = await searchParams
  const now = new Date()
  const month = Math.min(12, Math.max(1, parseInt(monthStr ?? String(now.getMonth() + 1), 10)))
  const year = parseInt(yearStr ?? String(now.getFullYear()), 10)

  const [budgetsResult, categoriesResult, allocationResult] = await Promise.all([
    listBudgets(userId, month, year),
    listCategories(userId, "EXPENSE"),
    getBudgetAllocationSummary(userId, month, year),
  ])

  const budgets = (budgetsResult.data ?? []).map((b) => ({
    id: b.id,
    categoryId: b.categoryId,
    categoryName: b.category.name,
    leftAmount: formatCurrency(
      Decimal.max(0, b.limitAmount.sub(b.spentAmount)),
      currency,
    ),
    limitAmount: formatCurrency(b.limitAmount, currency),
    limitAmountRaw: b.limitAmount.toNumber().toFixed(2),
    percentUsed: b.percentUsed,
    isOverBudget: b.isOverBudget,
  }))

  const expenseCategories = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }))
  const allocation = allocationResult.data
  const hasMonthlyIncome = Boolean(
    allocation && allocation.monthlyIncome.greaterThan(0),
  )
  const monthlyIncome = allocation
    ? formatCurrency(allocation.monthlyIncome, currency)
    : null
  const totalBudgets = allocation
    ? formatCurrency(allocation.totalBudgets, currency)
    : null
  const remainingIncome = allocation
    ? formatCurrency(
        Decimal.max(0, allocation.monthlyIncome.sub(allocation.totalBudgets)),
        currency,
      )
    : null

  return (
    <BudgetsClient
      budgets={budgets}
      expenseCategories={expenseCategories}
      currencySymbol={currencySymbol}
      monthlyIncome={monthlyIncome}
      totalBudgets={totalBudgets}
      remainingIncome={remainingIncome}
      hasMonthlyIncome={hasMonthlyIncome}
      month={month}
      year={year}
    />
  )
}
