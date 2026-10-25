import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TeamContact = { id: string; name: string; role: string | null; phone: string | null; notes: string | null };
export type PracticeItem = {
  id: string;
  child_id: string;
  instruction: string;
  provider: string | null;
  frequency: string | null;
  since: string | null;
  active: boolean;
};
export type Medicine = {
  id: string;
  child_id: string;
  name: string;
  dose: string | null;
  when_to_give: string | null;
  prescriber: string | null;
  pharmacy: string | null;
  notes: string | null;
};
export type PracticeCheck = { practice_item_id: string; created_by: string | null };

export async function loadTeam(familyId: string): Promise<TeamContact[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("team_contacts").select("id, name, role, phone, notes").eq("family_id", familyId).order("name");
  return (data ?? []) as TeamContact[];
}

export async function loadPractice(familyId: string): Promise<PracticeItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_items")
    .select("id, child_id, instruction, provider, frequency, since, active")
    .eq("family_id", familyId)
    .order("created_at");
  return (data ?? []) as PracticeItem[];
}

export async function loadMedicines(familyId: string): Promise<Medicine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("medicines")
    .select("id, child_id, name, dose, when_to_give, prescriber, pharmacy, notes")
    .eq("family_id", familyId)
    .eq("active", true)
    .order("name");
  return (data ?? []) as Medicine[];
}

/** Which practice items were done on a day, and by whom. */
export async function loadChecks(familyId: string, day: string): Promise<PracticeCheck[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("practice_checks").select("practice_item_id, created_by").eq("family_id", familyId).eq("done_on", day);
  return (data ?? []) as PracticeCheck[];
}

/** The most recent notes from each kind of visit, for "What Josiah's helpers are saying". */
export async function latestVisitNotes(familyId: string, today: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, child_id, kind, title, provider, date, summary, homework")
    .eq("family_id", familyId)
    .eq("cancelled", false)
    .lte("date", today)
    .neq("kind", "In-home nurse")
    .or("summary.not.is.null,homework.not.is.null")
    .order("date", { ascending: false })
    .limit(60);
  const latest = new Map<string, NonNullable<typeof data>[number]>();
  for (const v of data ?? []) if (!latest.has(v.kind)) latest.set(v.kind, v);
  return [...latest.values()];
}
