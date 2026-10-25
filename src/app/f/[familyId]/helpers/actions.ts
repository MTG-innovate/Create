"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { todayIn } from "@/lib/dates";
import { friendlyError, safeNext } from "@/lib/errors";
import { RECORDS, RECORD_KINDS, parseRecord } from "@/lib/records";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const Base = z.object({
  familyId: z.uuid(),
  kind: z.enum(RECORD_KINDS),
  id: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.uuid().optional()),
  childId: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.uuid().optional()),
  next: z.string().optional(),
});

export async function saveRecord(_prev: FormState, form: FormData): Promise<FormState> {
  const values = Object.fromEntries(form);
  const base = Base.safeParse(values);
  if (!base.success) return { error: "Something went wrong. Reload and try again." };
  const { familyId, kind, id, childId, next } = base.data;
  const { children } = await getFamily(familyId);
  const config = RECORDS[kind];
  const parsed = parseRecord(kind, values);
  if ("error" in parsed) return { error: parsed.error };

  const row: Record<string, unknown> = { ...parsed.row, family_id: familyId };
  if (config.perChild) {
    if (!childId || !children.some((c) => c.id === childId)) return { error: "Please choose who this is for." };
    row.child_id = childId;
  }
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from(config.table).update(row).eq("id", id).eq("family_id", familyId).select("id")
    : await supabase.from(config.table).insert(row).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only family, or the person who added it, can change this." };
  revalidatePath(`/f/${familyId}`, "layout");
  redirect(safeNext(next, `/f/${familyId}/helpers`));
}

export async function deleteRecord(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = Base.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Reload and try again." };
  const { familyId, kind, id, next } = parsed.data;
  await getFamily(familyId);
  const supabase = await createClient();
  const { data, error } = await supabase.from(RECORDS[kind].table).delete().eq("id", id).eq("family_id", familyId).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only family, or the person who added it, can delete this." };
  revalidatePath(`/f/${familyId}`, "layout");
  redirect(safeNext(next, `/f/${familyId}/helpers`));
}

/** Ticks or unticks a practice item for today ("Practice together today" on Home). */
export async function togglePractice(familyId: string, itemId: string, done: boolean): Promise<FormState> {
  const ids = z.object({ familyId: z.uuid(), itemId: z.uuid() }).safeParse({ familyId, itemId });
  if (!ids.success) return { error: "Something went wrong. Reload and try again." };
  const { family } = await getFamily(familyId);
  const supabase = await createClient();
  const { data: item } = await supabase.from("practice_items").select("child_id").eq("id", itemId).eq("family_id", familyId).maybeSingle();
  if (!item) return { error: "That practice item was removed." };
  const today = todayIn(family.time_zone);
  const { error } = done
    ? await supabase
        .from("practice_checks")
        .upsert({ family_id: familyId, child_id: item.child_id, practice_item_id: itemId, done_on: today }, { onConflict: "practice_item_id,done_on", ignoreDuplicates: true })
    : await supabase.from("practice_checks").delete().eq("practice_item_id", itemId).eq("done_on", today);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${familyId}`);
  return { done: done ? "Nice work" : "" };
}
