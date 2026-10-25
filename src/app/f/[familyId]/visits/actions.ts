"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { addDays, isDay } from "@/lib/dates";
import { friendlyError, safeNext } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { KEEP_GOING_WEEKS, VISIT_KINDS, parseVisitKey, seriesEnd, type SeriesRow } from "@/lib/visits";

// Empty fields arrive as "" (or not at all) and are stored as null.
const text = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => v || null);

const VisitForm = z.object({
  familyId: z.uuid(),
  key: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  childId: z.uuid(),
  kind: z.enum(VISIT_KINDS, "Please choose the type of visit."),
  title: text,
  provider: text,
  date: z.string().refine(isDay, "Please choose a date."),
  time: z
    .string()
    .regex(/^(\d{2}:\d{2})?$/, "Please check the time.")
    .optional()
    .transform((v) => v || null),
  location: text,
  who: text,
  bring: text,
  notes: text,
  summary: text,
  homework: text,
  repeat: z.coerce.number().int().refine((n) => [1, 4, 8, 12].includes(n)).default(1),
  scope: z.enum(["this", "all"]).default("this"),
  next: z.string().optional(),
});

export async function saveVisit(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = VisitForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();

  const shared = {
    kind: v.kind,
    title: v.title,
    provider: v.provider,
    location: v.location,
    who: v.who,
    bring: v.bring,
    notes: v.notes,
  };
  const own = { ...shared, child_id: v.childId, date: v.date, time: v.time, summary: v.summary, homework: v.homework };
  const base = { family_id: v.familyId, child_id: v.childId };

  let error;
  if (!v.key) {
    if (v.repeat > 1) {
      // One weekly rule, not copies. Each date is worked out from it.
      const { data, error: seriesError } = await supabase
        .from("visit_series")
        .insert({ ...base, ...shared, starts_on: v.date, start_time: v.time, every_weeks: 1, ends_on: seriesEnd(v.date, v.repeat) })
        .select("id")
        .single();
      error = seriesError;
      if (!error && (v.summary || v.homework)) {
        ({ error } = await supabase.from("visits").insert({ ...base, ...own, series_id: data!.id, occurrence_date: v.date }));
      }
    } else {
      ({ error } = await supabase.from("visits").insert({ ...base, ...own }));
    }
  } else {
    const target = await findTarget(v.familyId, v.key);
    if (!target) return { error: "This visit was changed or removed by someone else. Go back and try again." };

    if (!target.series) {
      ({ error } = await supabase.from("visits").update(own).eq("id", target.rowId!).eq("family_id", v.familyId));
    } else {
      const s = target.series;
      if (v.scope === "all") {
        ({ error } = await supabase
          .from("visit_series")
          .update({ ...shared, start_time: v.time })
          .eq("id", s.id));
      }
      // This date keeps its own row when it has notes, a different day, or
      // was given "just this visit" changes.
      const needsOwnRow =
        v.scope === "this" || target.rowId || v.summary || v.homework || v.date !== target.occurrence;
      if (!error && needsOwnRow) {
        ({ error } = await supabase
          .from("visits")
          .upsert(
            { ...base, ...own, series_id: s.id, occurrence_date: target.occurrence, cancelled: false },
            { onConflict: "series_id,occurrence_date" },
          ));
      }
    }
  }

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${v.familyId}`, "layout");
  redirect(safeNext(v.next, `/f/${v.familyId}/visits`));
}

const Remove = z.object({
  familyId: z.uuid(),
  key: z.string(),
  how: z.enum(["delete", "cancel", "stop"]),
  next: z.string().optional(),
});

/** Delete a one-off visit, cancel one date of a series, or stop a series from a date onward. */
export async function removeVisit(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = Remove.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Reload and try again." };
  const { familyId, key, how, next } = parsed.data;
  const target = await findTarget(familyId, key);
  if (!target) return { error: "This visit was already changed or removed." };
  const supabase = await createClient();

  let error;
  if (!target.series) {
    const { data, error: e } = await supabase.from("visits").delete().eq("id", target.rowId!).select("id");
    error = e ?? (data?.length ? null : { code: "42501", message: "Only family, or the person who added it, can delete this visit." });
  } else if (how === "stop") {
    ({ error } = await supabase.rpc("stop_series", { series: target.series.id, from_date: target.occurrence }));
  } else if (target.rowId) {
    // This week already has its own row (maybe with notes): keep it, marked cancelled.
    ({ error } = await supabase.from("visits").update({ cancelled: true }).eq("id", target.rowId));
  } else {
    const s = target.series;
    ({ error } = await supabase.from("visits").insert(
      {
        family_id: familyId,
        child_id: s.child_id,
        series_id: s.id,
        occurrence_date: target.occurrence,
        kind: s.kind,
        title: s.title,
        date: target.occurrence,
        time: s.start_time,
        cancelled: true,
      }));
  }

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${familyId}`, "layout");
  redirect(safeNext(next, `/f/${familyId}/visits`));
}

const SeriesAnswer = z.object({ familyId: z.uuid(), seriesId: z.uuid() });

/** "Keep it going": the same weekly visit for 12 more weeks. */
export async function keepSeriesGoing(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = SeriesAnswer.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Reload and try again." };
  const supabase = await createClient();
  const { data: s } = await supabase.from("visit_series").select("ends_on").eq("id", parsed.data.seriesId).maybeSingle();
  if (!s?.ends_on) return { error: "This weekly visit was already changed." };
  const { data, error } = await supabase
    .from("visit_series")
    .update({ ends_on: addDays(s.ends_on, 7 * KEEP_GOING_WEEKS), end_confirmed_at: null })
    .eq("id", parsed.data.seriesId)
    .select("id");
  if (error || !data.length) return { error: friendlyError(error ?? { code: "42501", message: "" }) };
  revalidatePath(`/f/${parsed.data.familyId}`, "layout");
  return { done: `Added ${KEEP_GOING_WEEKS} more weeks` };
}

/** "It is ending": stop asking about this series. */
export async function seriesIsEnding(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = SeriesAnswer.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Reload and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_series")
    .update({ end_confirmed_at: new Date().toISOString() })
    .eq("id", parsed.data.seriesId)
    .select("id");
  if (error || !data.length) return { error: friendlyError(error ?? { code: "42501", message: "" }) };
  revalidatePath(`/f/${parsed.data.familyId}`, "layout");
  return { done: "Got it" };
}

type Target = { rowId: string | null; series: SeriesRow | null; occurrence: string };

/** What a visit key points at right now: a row, a series date, or both. */
async function findTarget(familyId: string, key: string): Promise<Target | null> {
  const supabase = await createClient();
  const ref = parseVisitKey(key);
  if ("id" in ref) {
    const { data: row } = await supabase
      .from("visits")
      .select("id, series_id, occurrence_date, date")
      .eq("family_id", familyId)
      .eq("id", ref.id)
      .maybeSingle();
    if (!row) return null;
    if (!row.series_id) return { rowId: row.id, series: null, occurrence: row.date };
    const { data: series } = await supabase.from("visit_series").select("*").eq("id", row.series_id).maybeSingle();
    return series ? { rowId: row.id, series: series as SeriesRow, occurrence: row.occurrence_date } : null;
  }
  const { data: series } = await supabase
    .from("visit_series")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", ref.seriesId)
    .maybeSingle();
  if (!series) return null;
  const { data: row } = await supabase
    .from("visits")
    .select("id")
    .eq("series_id", ref.seriesId)
    .eq("occurrence_date", ref.date)
    .maybeSingle();
  return { rowId: row?.id ?? null, series: series as SeriesRow, occurrence: ref.date };
}
