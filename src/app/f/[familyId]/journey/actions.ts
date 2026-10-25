"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { isDay, todayIn } from "@/lib/dates";
import { friendlyError, safeNext } from "@/lib/errors";
import { WIN_CATEGORIES } from "@/lib/journey";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const optionalId = z
  .string()
  .optional()
  .transform((v) => v || undefined)
  .pipe(z.uuid().optional());

const WinForm = z.object({
  familyId: z.uuid(),
  id: optionalId,
  childId: z.uuid(),
  title: z.string().trim().min(1, "Please say what happened.").max(300),
  happenedOn: z.string().refine(isDay, "Please choose a date."),
  category: z.enum(WIN_CATEGORIES).default("Bright spot"),
  note: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => v || null),
  next: z.string().optional(),
});

export async function saveWin(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = WinForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  await getFamily(v.familyId);
  const row = { family_id: v.familyId, child_id: v.childId, title: v.title, happened_on: v.happenedOn, category: v.category, note: v.note };
  const supabase = await createClient();
  const { data, error } = v.id
    ? await supabase.from("wins").update(row).eq("id", v.id).eq("family_id", v.familyId).select("id")
    : await supabase.from("wins").insert(row).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only family, or the person who added it, can change this." };
  revalidatePath(`/f/${v.familyId}`, "layout");
  const next = safeNext(v.next, `/f/${v.familyId}/journey`);
  // A new win gets a little celebration where it lands.
  redirect(v.id ? next : `${next}${next.includes("?") ? "&" : "?"}celebrate=1`);
}

export async function deleteWin(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ familyId: z.uuid(), id: z.uuid(), next: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Reload and try again." };
  const { familyId, id, next } = parsed.data;
  await getFamily(familyId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("wins").delete().eq("id", id).eq("family_id", familyId).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only family, or the person who added it, can delete this." };
  revalidatePath(`/f/${familyId}`, "layout");
  redirect(safeNext(next, `/f/${familyId}/journey`));
}

export type BrightSpotState = FormState & { saved?: number };

/** "What was good today?" on Home: saves a bright spot for today. */
export async function addBrightSpot(prev: BrightSpotState, form: FormData): Promise<BrightSpotState> {
  const parsed = z
    .object({ familyId: z.uuid(), childId: z.uuid(), title: z.string().trim().min(1, "Write one good thing first.").max(300) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { familyId, childId, title } = parsed.data;
  const { family } = await getFamily(familyId);
  const supabase = await createClient();
  const { error } = await supabase.from("wins").insert({
    family_id: familyId,
    child_id: childId,
    title,
    happened_on: todayIn(family.time_zone),
    category: "Bright spot",
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${familyId}`, "layout");
  return { done: "Saved to the journey", saved: (prev.saved ?? 0) + 1 };
}
