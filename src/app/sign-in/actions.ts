"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { sentTo?: string; error?: string; codeError?: string };

export async function sendSignInLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Please check the email address." };

  const next = safeNext(form.get("next"));
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return { error: error.status === 429 ? "Too many tries. Wait a minute, then try again." : "We could not send the link. Try again." };
  }
  return { sentTo: email.data };
}

/**
 * Signs in with the code from the email, for someone using JOSIA Care from the
 * Home Screen: the email's link would open in the browser instead of the app.
 */
export async function signInWithCode(prev: SignInState, form: FormData): Promise<SignInState> {
  const email = prev.sentTo;
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!email) return { error: "Please ask for a new sign-in email." };
  if (code.length < 6 || code.length > 10) return { sentTo: email, codeError: "Please type the code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return {
      sentTo: email,
      codeError:
        error.status === 429
          ? "Too many tries. Wait a minute, then try again."
          : "That code did not work. Check the newest email, or ask for a new one.",
    };
  }
  redirect(safeNext(form.get("next")));
}
