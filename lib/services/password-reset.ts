import crypto from "crypto"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import { getPublicAppUrl } from "@/lib/public-app-url"
import type { ServiceResult } from "@/types/index"

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, { error: "Reset token is required" }),
    newPassword: z
      .string()
      .min(8, { error: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(1, { error: "Please confirm your password" }),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  })

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Find the user by email, create a reset token, and send the password-reset email.
 * Always returns success to prevent email enumeration — the caller should show
 * a generic "check your inbox" message regardless of whether the email exists.
 */
export async function requestPasswordReset(
  email: string
): Promise<ServiceResult<{ sent: true }>> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    })

    // Silently succeed to prevent email enumeration
    if (!user) return { data: { sent: true } }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    // Generate a new 32-byte cryptographically random token
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    const base = getPublicAppUrl()
    if (!base) {
      throw new Error("AUTH_URL is not set")
    }

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    })

    const resetUrl = `${base}/reset-password?token=${rawToken}`
    try {
      await sendPasswordResetEmail({ email: user.email, name: user.name }, resetUrl)
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      })
      throw error
    }

    return { data: { sent: true } }
  } catch (error) {
    console.error("[requestPasswordReset]", error)
    return { error: "Failed to send password reset email" }
  }
}

/**
 * Validate a raw reset token (from the URL). Returns the userId if valid.
 */
export async function validateResetToken(
  rawToken: string
): Promise<ServiceResult<{ userId: string }>> {
  try {
    const tokenHash = hashToken(rawToken)
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!record) return { error: "Invalid or expired reset link" }
    if (record.usedAt) return { error: "This reset link has already been used" }
    if (record.expiresAt < new Date()) return { error: "This reset link has expired" }

    return { data: { userId: record.userId } }
  } catch (error) {
    console.error("[validateResetToken]", error)
    return { error: "Failed to validate reset token" }
  }
}

/**
 * Reset the user's password and mark the token as consumed.
 * Expects the raw token (from the URL) + new password.
 */
export async function resetPassword(
  data: unknown
): Promise<ServiceResult<{ success: true }>> {
  const parsed = ResetPasswordSchema.safeParse(data)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const first =
      fieldErrors.newPassword?.[0] ??
      fieldErrors.confirmPassword?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      "Invalid input"
    return { error: first }
  }

  const { token: rawToken, newPassword } = parsed.data

  try {
    const tokenHash = hashToken(rawToken)
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    })

    if (!record) return { error: "Invalid or expired reset link" }
    if (record.usedAt) return { error: "This reset link has already been used" }
    if (record.expiresAt < new Date()) return { error: "This reset link has expired" }

    const hashed = await bcrypt.hash(newPassword, 12)

    // Atomic: update password + mark token used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    return { data: { success: true } }
  } catch (error) {
    console.error("[resetPassword]", error)
    return { error: "Failed to reset password" }
  }
}
