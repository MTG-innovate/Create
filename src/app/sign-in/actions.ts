"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { safeNext } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { sentTo?: string; error?: string };

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
