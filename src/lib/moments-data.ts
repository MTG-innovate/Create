import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Moment } from "@/lib/moments";

/** Moments from `from` to `to` (inclusive), newest first. */
export async function loadMoments(familyId: string, from: string, to: string): Promise<Moment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moments")
    .select("id, child_id, type, date, time, details, note, created_by")
    .eq("family_id", familyId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("time", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Moment[];
}

/** Each child's most recent meal on any day, for the "Last meal" tile. */
export async function lastMeals(familyId: string, childIds: string[]): Promise<Map<string, Moment>> {
  const supabase = await createClient();
  const found = await Promise.all(
    childIds.map((id) =>
      supabase
        .from("moments")
        .select("id, child_id, type, date, time, details, note, created_by")
        .eq("family_id", familyId)
        .eq("child_id", id)
        .eq("type", "meal")
        .order("date", { ascending: false })
        .order("time", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ),
  );
  return new Map(found.flatMap((r) => (r.data ? [[r.data.child_id as string, r.data as Moment]] : [])));
}

export async function loadMoment(familyId: string, id: string): Promise<Moment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("moments")
    .select("id, child_id, type, date, time, details, note, created_by")
    .eq("family_id", familyId)
    .eq("id", id)
    .maybeSingle();
  return (data as Moment | null) ?? null;
}

/** Display names for "added by", with "you" for the signed-in person. */
export async function namesFor(ids: (string | null)[], me: string): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, p.id === me ? "you" : (p.display_name as string) || "family"]));
}

/** Suggestions for moment fields from the family's own lists. */
export async function suggestions(familyId: string) {
  const supabase = await createClient();
  const [practice, medicines, team] = await Promise.all([
    supabase.from("practice_items").select("instruction").eq("family_id", familyId).eq("active", true),
    supabase.from("medicines").select("name").eq("family_id", familyId).eq("active", true),
    supabase.from("team_contacts").select("name").eq("family_id", familyId),
  ]);
  return {
    practice: (practice.data ?? []).map((p) => p.instruction as string),
    medicines: (medicines.data ?? []).map((m) => m.name as string),
    team: (team.data ?? []).map((t) => t.name as string),
  };
}
