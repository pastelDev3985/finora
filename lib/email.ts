import { BrevoClient } from "@getbrevo/brevo"
import { getPublicAppUrl } from "@/lib/public-app-url"

// ─── Singleton ────────────────────────────────────────────────────────────────

function createBrevoClient(): BrevoClient {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error("BREVO_API_KEY is not set")
  return new BrevoClient({ apiKey, maxRetries: 2, timeoutInSeconds: 30 })
}

const globalForBrevo = globalThis as unknown as { brevo?: BrevoClient }

function getBrevoClient(): BrevoClient {
  if (!globalForBrevo.brevo) {
    globalForBrevo.brevo = createBrevoClient()
  }
  return globalForBrevo.brevo
}

// ─── Sender ───────────────────────────────────────────────────────────────────

function getSender() {
  const email = process.env.BREVO_SENDER_EMAIL
  const name = process.env.BREVO_SENDER_NAME ?? "Finora"
  if (!email) throw new Error("BREVO_SENDER_EMAIL is not set")
  return { email, name }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

/**
 * Send a 6-digit email-verification OTP to a newly registered user.
 */
export async function sendEmailVerificationOtp(
  to: { email: string; name: string },
  otp: string
): Promise<void> {
  await getBrevoClient().transactionalEmails.sendTransacEmail({
    sender: getSender(),
    to: [to],
    subject: `${otp} is your Finora verification code`,
    htmlContent: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#fffdf5;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <h1 style="font-size:24px;font-weight:700;color:#141414;margin-bottom:8px;">Verify your email</h1>
    <p style="color:#555;margin-bottom:32px;">Enter this code in the Finora app to verify your email address. It expires in <strong>15 minutes</strong>.</p>
    <div style="background:#fffdf5;border:2px solid #FFD100;border-radius:12px;text-align:center;padding:24px 0;letter-spacing:12px;font-size:36px;font-weight:700;color:#141414;">${otp}</div>
    <p style="color:#888;font-size:12px;margin-top:32px;">If you didn't create a Finora account, you can safely ignore this email.</p>
  </div>
</body>
</html>`,
  })
}

/**
 * Send a welcome email after the user successfully verifies their email.
 */
export async function sendWelcomeEmail(
  to: { email: string; name: string }
): Promise<void> {
  const firstName = to.name.split(" ")[0]
  await getBrevoClient().transactionalEmails.sendTransacEmail({
    sender: getSender(),
    to: [to],
    subject: `Welcome to Finora, ${firstName}!`,
    htmlContent: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#fffdf5;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <h1 style="font-size:24px;font-weight:700;color:#141414;margin-bottom:8px;">Welcome to Finora, ${firstName}!</h1>
    <p style="color:#555;margin-bottom:24px;">Your account is verified and ready to go. Start by adding your first transaction or setting up a savings goal.</p>
    <a href="${getPublicAppUrl()}/dashboard" style="display:inline-block;background:#FFD100;color:#141414;font-weight:700;text-decoration:none;border-radius:8px;padding:14px 28px;">Go to your Dashboard</a>
    <p style="color:#888;font-size:12px;margin-top:32px;">Questions? Reply to this email — we're here to help.</p>
  </div>
</body>
</html>`,
  })
}

/**
 * Send a password-reset link. The link is valid for 1 hour.
 */
export async function sendPasswordResetEmail(
  to: { email: string; name: string },
  resetUrl: string
): Promise<void> {
  const firstName = to.name.split(" ")[0]
  await getBrevoClient().transactionalEmails.sendTransacEmail({
    sender: getSender(),
    to: [to],
    subject: "Reset your Finora password",
    htmlContent: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#fffdf5;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <h1 style="font-size:24px;font-weight:700;color:#141414;margin-bottom:8px;">Reset your password</h1>
    <p style="color:#555;margin-bottom:32px;">Hi ${firstName}, click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#FFD100;color:#141414;font-weight:700;text-decoration:none;border-radius:8px;padding:14px 28px;">Reset Password</a>
    <p style="color:#555;margin-top:24px;font-size:13px;">Or copy this link:<br/><span style="color:#888;word-break:break-all;">${resetUrl}</span></p>
    <p style="color:#888;font-size:12px;margin-top:32px;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
  </div>
</body>
</html>`,
  })
}
