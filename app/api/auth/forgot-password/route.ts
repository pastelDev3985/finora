import { NextResponse } from "next/server"
import { z } from "zod"
import { requestPasswordReset } from "@/lib/services/password-reset"

const Schema = z.object({
  email: z.email({ error: "Please enter a valid email address" }).trim(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = Schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid input" },
        { status: 400 }
      )
    }

    const result = await requestPasswordReset(parsed.data.email)
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "If that email is registered, a reset link has been sent." },
      { status: 200 }
    )
  } catch (error) {
    console.error("[forgot-password]", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
