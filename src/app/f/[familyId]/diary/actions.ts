"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { isDay } from "@/lib/dates";
import { friendlyError, safeNext } from "@/lib/errors";
import { MOMENT_TYPES, nightFeedTotal, parseMomentFields } from "@/lib/moments";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const Base = z.object({
  familyId: z.uuid(),
  id: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.uuid().optional()),
  childId: z.uuid(),
  type: z.enum(MOMENT_TYPES),
  date: z.string().refine(isDay, "Please choose a date."),
  time: z
    .string()
    .regex(/^(\d{2}:\d{2})?$/, "Please check the time.")
    .optional()
    .transform((v) => v || null),
  next: z.string().optional(),
});

export async function saveMoment(_prev: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(form);
  const base = Base.safeParse(values);
  if (!base.success) return { error: base.error.issues[0].message };
  const { familyId, id, childId, type, date, time, next } = base.data;
  const { family, children } = await getFamily(familyId);
  const child = children.find((c) => c.id === childId);
  if (!child) return { error: "Please choose who this is for." };

  const fields = parseMomentFields(type, values, { name: child.name, unit: family.feed_unit });
  if ("error" in fields) return { error: fields.error };
  const details = { ...fields.details };
  if (type === "night_feed" && details.total == null) {
    // The prototype fills in the total from the pump rate and the times.
    const total = nightFeedTotal(time, details.end as string | undefined, details.rate as number | undefined);
    if (total != null) Object.assign(details, { total, unit: "ml" });
  }

  const row = { family_id: familyId, child_id: childId, type, date, time, details, note: fields.note };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("moments").update(row).eq("id", id).eq("family_id", familyId).select("id")
    : await supabase.from("moments").insert(row).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only family, or the person who added it, can change this." };

  revalidatePath(`/f/${familyId}`, "layout");
  redirect(safeNext(next, `/f/${familyId}/diary?date=${date}`));
}

export async function deleteMoment(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ familyId: z.uuid(), id: z.uuid(), next: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Reload and try again." };
  const { familyId, id, next } = parsed.data;
  await getFamily(familyId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("moments").delete().eq("id", id).eq("family_id", familyId).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only family, or the person who added it, can delete this." };
  revalidatePath(`/f/${familyId}`, "layout");
  redirect(safeNext(next, `/f/${familyId}/diary`));
}
