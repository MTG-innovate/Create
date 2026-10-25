"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { friendlyError } from "@/lib/errors";
import { pushReady, sendPush } from "@/lib/push";
import { getFamily, requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Reminders on this phone. Every query runs as the signed-in person, and the
// database lets them see and change only their own phones.

const subscription = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Saves this phone's push address after the person allows notifications. */
export async function turnOnReminders(familyId: string, sub: unknown): Promise<FormState> {
  const parsed = subscription.safeParse(sub);
  if (!z.uuid().safeParse(familyId).success || !parsed.success) return { error: "This phone could not turn on reminders." };
  await getFamily(familyId);
  const user = await requireUser();
  const supabase = await createClient();
  const { endpoint, keys } = parsed.data;
  // Already saved on this phone: just refresh its keys.
  const updated = await supabase
    .from("push_devices")
    .update({ p256dh: keys.p256dh, auth_key: keys.auth })
    .eq("family_id", familyId)
    .eq("endpoint", endpoint)
    .select("id");
  if (updated.error) return { error: friendlyError(updated.error) };
  if (!updated.data.length) {
    const { error } = await supabase
      .from("push_devices")
      .insert({ family_id: familyId, user_id: user.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth });
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath(`/f/${familyId}/settings`);
  return { done: "Reminders are on" };
}

export async function turnOffReminders(familyId: string, endpoint: string): Promise<FormState> {
  await getFamily(familyId);
  const supabase = await createClient();
  const { error } = await supabase.from("push_devices").delete().eq("family_id", familyId).eq("endpoint", endpoint);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${familyId}/settings`);
  return { done: "Reminders are off on this phone" };
}

const choices = z.object({
  familyId: z.uuid(),
  deviceId: z.uuid(),
  visitEvening: z.literal("on").optional(),
  visitSoon: z.literal("on").optional(),
  nightFeed: z.literal("on").optional(),
  nightFeedAt: z.string().regex(/^\d{2}:\d{2}$/, "Please check the night feed time."),
});

export async function saveReminderChoices(_prev: FormState, form: FormData): Promise<FormState> {
  const v = choices.safeParse(Object.fromEntries(form));
  if (!v.success) return { error: v.error.issues[0].message };
  await getFamily(v.data.familyId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_devices")
    .update({
      visit_evening: Boolean(v.data.visitEvening),
      visit_soon: Boolean(v.data.visitSoon),
      night_feed: Boolean(v.data.nightFeed),
      night_feed_at: v.data.nightFeedAt,
    })
    .eq("id", v.data.deviceId)
    .eq("family_id", v.data.familyId)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Turn reminders on for this phone first." };
  return { done: "Saved" };
}

/** A test reminder to this phone, so the person can see what one looks like. */
export async function sendTestReminder(_prev: FormState, form: FormData): Promise<FormState> {
  const v = z.object({ familyId: z.uuid(), deviceId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "Something went wrong. Please try again." };
  const { children } = await getFamily(v.data.familyId);
  if (!pushReady()) return { error: "Reminders are not set up for JOSIA Care yet." };
  const supabase = await createClient();
  const { data } = await supabase.from("push_devices").select("endpoint, p256dh, auth_key").eq("id", v.data.deviceId).maybeSingle();
  if (!data) return { error: "Turn reminders on for this phone first." };
  const result = await sendPush(data, {
    title: "JOSIA Care",
    body: `This is how reminders about ${children[0]?.name ?? "your little one"} will look.`,
    url: `/f/${v.data.familyId}/settings`,
    tag: "test",
  });
  if (result === "sent") return { done: "Sent. It should arrive in a moment." };
  return { error: "That did not reach this phone. Turn reminders off and on again." };
}
