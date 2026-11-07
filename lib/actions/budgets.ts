"use server"

import { auth } from "@/lib/auth"
import { upsertBudget, deleteBudget } from "@/lib/services/budgets"
import { revalidatePath } from "next/cache"

export async function upsertBudgetAction(data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }

  const result = await upsertBudget(session.user.id, data)
  if (result.error) return { error: result.error }
  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  return {}
}

export async function deleteBudgetAction(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }

  const result = await deleteBudget(session.user.id, id)
  if (result.error) return { error: result.error }
  revalidatePath("/budgets")
  revalidatePath("/dashboard")
  return {}
}
