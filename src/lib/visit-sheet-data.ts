import "server-only";
import { addDays } from "@/lib/dates";
import type { JourneyConfig } from "@/lib/journeys";
import type { Moment, Unit } from "@/lib/moments";
import { createClient } from "@/lib/supabase/server";
import { buildVisitSheet, type SheetVisit, type VisitSheet } from "@/lib/visit-sheet";

const MOMENT_COLUMNS = "id, child_id, type, date, time, details, note, created_by";

/**
 * Gathers one child's records for a visit sheet. Every read runs as the
 * signed-in person, so a helper's sheet only includes what they may see.
 */
export async function loadVisitSheet(opts: {
  familyId: string;
  childId: string;
  childName: string;
  journey: JourneyConfig;
  visit: SheetVisit;
  today: string;
  unit: Unit;
}): Promise<VisitSheet> {
  const { familyId, childId, today } = opts;
  const supabase = await createClient();
  const [medicines, weighIns, recent, notes, practice, questions] = await Promise.all([
    supabase.from("medicines").select("name, dose, when_to_give").eq("family_id", familyId).eq("child_id", childId).eq("active", true).order("name"),
    supabase.from("moments").select(MOMENT_COLUMNS).eq("family_id", familyId).eq("child_id", childId).eq("type", "weigh_in").gte("date", addDays(today, -60)),
    supabase.from("moments").select(MOMENT_COLUMNS).eq("family_id", familyId).eq("child_id", childId).neq("type", "weigh_in").gte("date", addDays(today, -14)),
    supabase
      .from("visits")
      .select("kind, provider, date, summary, homework")
      .eq("family_id", familyId)
      .eq("child_id", childId)
      .eq("cancelled", false)
      .gte("date", addDays(today, -90))
      .lte("date", today)
      .or("summary.not.is.null,homework.not.is.null"),
    supabase.from("practice_items").select("instruction, provider").eq("family_id", familyId).eq("child_id", childId).eq("active", true).order("created_at"),
    supabase.from("questions").select("text, for_whom").eq("family_id", familyId).eq("child_id", childId).eq("done", false).order("created_at"),
  ]);
  return buildVisitSheet({
    childName: opts.childName,
    journey: opts.journey,
    visit: opts.visit,
    today,
    unit: opts.unit,
    medicines: medicines.data ?? [],
    moments: [...((weighIns.data ?? []) as Moment[]), ...((recent.data ?? []) as Moment[])],
    notes: notes.data ?? [],
    practice: practice.data ?? [],
    questions: questions.data ?? [],
  });
}
