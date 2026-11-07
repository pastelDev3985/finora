"use client"

import { ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { BudgetCard, type BudgetCardData } from "@/components/budgets/budget-card"
import { BudgetForm } from "@/components/budgets/budget-form"

interface Category {
  id: string
  name: string
}

interface BudgetsClientProps {
  budgets: BudgetCardData[]
  expenseCategories: Category[]
  currencySymbol: string
  monthlyIncome: string | null
  totalBudgets: string | null
  remainingIncome: string | null
  hasMonthlyIncome: boolean
  month: number
  year: number
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export function BudgetsClient({
  budgets: initialBudgets,
  expenseCategories,
  currencySymbol,
  monthlyIncome,
  totalBudgets,
  remainingIncome,
  hasMonthlyIncome,
  month,
  year,
}: BudgetsClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [editBudget, setEditBudget] = useState<BudgetCardData | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function navigate(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    startTransition(() => {
      router.push(`/budgets?month=${m}&year=${y}`)
    })
  }

  /** Ensure the budget being edited appears in the list (Base UI Select labels need a matching item). */
  const categoriesForForm = useMemo(() => {
    if (!editBudget) return expenseCategories
    if (expenseCategories.some((c) => c.id === editBudget.categoryId)) {
      return expenseCategories
    }
    return [
      ...expenseCategories,
      { id: editBudget.categoryId, name: editBudget.categoryName },
    ]
  }, [editBudget, expenseCategories])

  return (
    <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Budgets"
            description="Set and track your monthly spending limits."
          />
          <Button
            onClick={() => { setEditBudget(null); setShowForm(true) }}
            className="shrink-0 cursor-pointer font-semibold"
            size="sm"
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Set budget</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Month picker — full width on mobile */}
        <div className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-2 py-1 sm:self-start">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isPending}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="min-w-[100px] text-center text-sm font-semibold text-foreground">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={isPending}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {hasMonthlyIncome && monthlyIncome && totalBudgets && remainingIncome ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Monthly income</p>
            <p className="font-semibold tabular-nums text-foreground">{monthlyIncome}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Budgeted</p>
            <p className="font-semibold tabular-nums text-foreground">{totalBudgets}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Available to budget</p>
            <p className="font-semibold tabular-nums text-primary">{remainingIncome}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-4 text-sm text-[var(--color-error)]">
          Record income for {MONTH_NAMES[month - 1]} {year} before creating budgets.
        </div>
      )}

      {initialBudgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budgets set"
          description="Add a budget limit for a spending category to start tracking."
          action={
            <Button
              onClick={() => setShowForm(true)}
              className="cursor-pointer font-semibold"
            >
              Set your first budget
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {initialBudgets.map((b) => (
            <BudgetCard key={b.id} budget={b} onEdit={setEditBudget} />
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={showForm || !!editBudget}
        onOpenChange={(open) => {
          if (!open) { setShowForm(false); setEditBudget(null) }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editBudget ? "Edit budget" : "Set budget"}</DialogTitle>
            <DialogDescription>
              {editBudget
                ? `Update the monthly limit for ${editBudget.categoryName}.`
                : "Choose an expense category and set a monthly limit."}
            </DialogDescription>
          </DialogHeader>
          <BudgetForm
            key={`budget-${editBudget?.id ?? "new"}-${month}-${year}`}
            categories={categoriesForForm}
            currencySymbol={currencySymbol}
            month={month}
            year={year}
            defaultValues={
              editBudget
                ? {
                    budgetId: editBudget.id,
                    categoryId: editBudget.categoryId,
                    categoryName: editBudget.categoryName,
                    limitAmount: editBudget.limitAmountRaw,
                  }
                : undefined
            }
            onSuccess={() => {
              setShowForm(false)
              setEditBudget(null)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
