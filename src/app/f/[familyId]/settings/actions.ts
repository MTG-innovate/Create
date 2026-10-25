"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { isDay } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "child-photos";
const birthday = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isDay(v), "Please check the birthday.");
const childName = z.string().trim().min(1, "Please add a name.").max(60);
const notSaved = (error: { code?: string; message?: string } | null, rows: unknown[] | null) =>
  error ? friendlyError(error) : !rows?.length ? "Only an owner or family can change this." : null;

export async function saveChild(_prev: FormState, form: FormData): Promise<FormState> {
  const v = z.object({ familyId: z.uuid(), childId: z.uuid(), name: childName, birthDate: birthday }).safeParse(Object.fromEntries(form));
  if (!v.success) return { error: v.error.issues[0].message };
  await getFamily(v.data.familyId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .update({ name: v.data.name, birth_date: v.data.birthDate })
    .eq("id", v.data.childId)
    .eq("family_id", v.data.familyId)
    .select("id");
  const problem = notSaved(error, data);
  if (problem) return { error: problem };
  revalidatePath(`/f/${v.data.familyId}`, "layout");
  return { done: "Saved" };
}

export async function saveFamilySettings(_prev: FormState, form: FormData): Promise<FormState> {
  const v = z
    .object({ familyId: z.uuid(), feedUnit: z.enum(["oz", "ml"]), encouragement: z.enum(["scripture", "gentle"]) })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "Please choose from the lists." };
  await getFamily(v.data.familyId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("families")
    .update({ feed_unit: v.data.feedUnit, encouragement: v.data.encouragement })
    .eq("id", v.data.familyId)
    .select("id");
  const problem = notSaved(error, data);
  if (problem) return { error: problem };
  revalidatePath(`/f/${v.data.familyId}`, "layout");
  return { done: "Saved" };
}

export async function addChild(_prev: FormState, form: FormData): Promise<FormState> {
  const v = z.object({ familyId: z.uuid(), name: childName, birthDate: birthday }).safeParse(Object.fromEntries(form));
  if (!v.success) return { error: v.error.issues[0].message };
  await getFamily(v.data.familyId);
  const supabase = await createClient();
  const { error } = await supabase.from("children").insert({ family_id: v.data.familyId, name: v.data.name, birth_date: v.data.birthDate });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${v.data.familyId}`, "layout");
  redirect(`/f/${v.data.familyId}`);
}

/**
 * After the browser uploads a photo into the child's private folder, point
 * the child at it and remove the photo it replaces.
 */
export async function setPhoto(familyId: string, childId: string, path: string): Promise<FormState> {
  const v = z.object({ familyId: z.uuid(), childId: z.uuid() }).safeParse({ familyId, childId });
  if (!v.success || !path.startsWith(`${familyId}/${childId}/`)) return { error: "That photo could not be added. Try again." };
  const { children } = await getFamily(familyId);
  const before = children.find((c) => c.id === childId)?.photo_path;
  const supabase = await createClient();
  const { data, error } = await supabase.from("children").update({ photo_path: path }).eq("id", childId).eq("family_id", familyId).select("id");
  const problem = notSaved(error, data);
  if (problem) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: problem };
  }
  if (before && before !== path) await supabase.storage.from(BUCKET).remove([before]);
  revalidatePath(`/f/${familyId}`, "layout");
  return { done: "Photo added" };
}

export async function removePhoto(_prev: FormState, form: FormData): Promise<FormState> {
  const v = z.object({ familyId: z.uuid(), childId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "Something went wrong. Reload and try again." };
  const { children } = await getFamily(v.data.familyId);
  const before = children.find((c) => c.id === v.data.childId)?.photo_path;
  const supabase = await createClient();
  const { data, error } = await supabase.from("children").update({ photo_path: null }).eq("id", v.data.childId).eq("family_id", v.data.familyId).select("id");
  const problem = notSaved(error, data);
  if (problem) return { error: problem };
  if (before) await supabase.storage.from(BUCKET).remove([before]);
  revalidatePath(`/f/${v.data.familyId}`, "layout");
  return { done: "Photo removed" };
}

/**
 * Permanently deletes a child's data: every record, its history and photos.
 * Owner only (the database checks too), and only after typing the child's name.
 */
export async function deleteChildData(_prev: FormState, form: FormData): Promise<FormState> {
  const v = z.object({ familyId: z.uuid(), childId: z.uuid(), confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "Something went wrong. Reload and try again." };
  const { children, me } = await getFamily(v.data.familyId);
  const child = children.find((c) => c.id === v.data.childId);
  if (!child) return { error: "That child's data was already deleted." };
  if (me.role !== "owner") return { error: "Only an owner can delete a child's data." };
  if (v.data.confirm.trim().toLowerCase() !== child.name.trim().toLowerCase()) {
    return { error: `Type ${child.name}'s name to confirm.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_child", { child: child.id });
  if (error) return { error: friendlyError(error) };
  const folder = `${v.data.familyId}/${child.id}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(folder);
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  revalidatePath(`/f/${v.data.familyId}`, "layout");
  redirect(`/f/${v.data.familyId}/settings?deleted=1`);
}
