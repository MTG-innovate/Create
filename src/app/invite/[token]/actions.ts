"use server";

import { redirect } from "next/navigation";
import { friendlyError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error?: string };

export async function acceptInvitation(_prev: JoinState, form: FormData): Promise<JoinState> {
  const token = String(form.get("token") ?? "");
  const user = await requireUser(`/invite/${token}`);
  const yourName = String(form.get("yourName") ?? "").trim().slice(0, 80);

  const supabase = await createClient();
  if (yourName) await supabase.from("profiles").update({ display_name: yourName }).eq("id", user.id);
  const { data: familyId, error } = await supabase.rpc("accept_invitation", { invitation_token: token });
  if (error) return { error: friendlyError(error) };
  redirect(`/f/${familyId}`);
}
