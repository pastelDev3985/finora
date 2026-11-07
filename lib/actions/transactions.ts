"use server"

import { auth } from "@/lib/auth"
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/services/transactions"
import { revalidatePath } from "next/cache"

export async function createTransactionAction(data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }

  const result = await createTransaction(session.user.id, data)
  if (result.error) return { error: result.error }
  revalidatePath("/transactions")
  revalidatePath("/dashboard")
  revalidatePath("/budgets")
  return {}
}

export async function updateTransactionAction(id: string, data: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }

  const result = await updateTransaction(session.user.id, id, data)
  if (result.error) return { error: result.error }
  revalidatePath("/transactions")
  revalidatePath("/dashboard")
  revalidatePath("/budgets")
  return {}
}

export async function deleteTransactionAction(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }

  const result = await deleteTransaction(session.user.id, id)
  if (result.error) return { error: result.error }
  revalidatePath("/transactions")
  revalidatePath("/dashboard")
  revalidatePath("/budgets")
  return {}
}
