"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.object({
  email: z.email({ error: "Please enter a valid email address" }).trim(),
});

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");

    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(
        parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          body?.error ?? "Unable to send the reset email. Please try again.",
        );
      }

      setSubmitted(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="glass-light w-full max-w-md rounded-2xl border border-border-light p-6 shadow-lg sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--color-success)]/10">
            <CheckCircle2
              className="size-7 text-[var(--color-success)]"
              aria-hidden
            />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If that email is registered, a reset link has been sent. It
              expires in 1 hour.
            </p>
          </div>
          <Link
            href="/login"
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 transition-all duration-200 hover:text-primary-hover hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-light w-full max-w-md rounded-2xl border border-border-light p-6 shadow-lg sm:p-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Mail className="size-7 text-primary" aria-hidden />
        </div>
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Forgot your password?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!emailError}
            disabled={isSubmitting}
          />
          {emailError && (
            <p className="text-xs text-destructive" role="alert">
              {emailError}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full cursor-pointer rounded-lg font-semibold transition-all duration-200 hover:-translate-y-px"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 font-medium text-primary underline-offset-4 transition-all duration-200 hover:text-primary-hover hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
