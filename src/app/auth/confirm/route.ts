import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { safeNext } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// Where the emailed sign-in link lands. Turns the link into a session cookie.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  const target = error ? `/sign-in?error=link&next=${encodeURIComponent(next)}` : next;
  return redirectTo(target);
}
