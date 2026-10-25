"use server";

import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const Feedback = z.object({
  familyId: z.uuid(),
  message: z.string().trim().min(1, "Please write a few words first.").max(2000, "Please keep it under 2,000 characters."),
  from: z.string().max(200).optional(),
});

/** Sends a note to the JOSIA Care team. No one in the Care Circle can read it. */
export async function sendFeedback(_prev: FormState, form: FormData): Promise<FormState> {
  const input = Feedback.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { familyId, message, from } = input.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_feedback", { family: familyId, message, page: from?.startsWith("/") ? from : null });
  if (error) return { error: friendlyError(error) };
  return { done: "Sent. Thank you, we read every note." };
}
