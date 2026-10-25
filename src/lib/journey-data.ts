import "server-only";
import type { Win } from "@/lib/journey";
import type { Moment } from "@/lib/moments";
import { createClient } from "@/lib/supabase/server";

const MOMENT_COLUMNS = "id, child_id, type, date, time, details, note, created_by";

/** Every weigh-in for a child, oldest first. */
export async function loadWeighIns(familyId: string, childId: string): Promise<Moment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moments")
    .select(MOMENT_COLUMNS)
    .eq("family_id", familyId)
    .eq("child_id", childId)
    .eq("type", "weigh_in")
    .order("date")
    .order("time", { nullsFirst: true });
  if (error) throw error;
  return (data ?? []) as Moment[];
}

/** A child's wins, newest first. */
export async function loadWins(familyId: string, childId: string, limit?: number): Promise<Win[]> {
  const supabase = await createClient();
  let query = supabase
    .from("wins")
    .select("id, child_id, title, happened_on, category, note")
    .eq("family_id", familyId)
    .eq("child_id", childId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Win[];
}

export async function loadWin(familyId: string, id: string): Promise<Win | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wins")
    .select("id, child_id, title, happened_on, category, note")
    .eq("family_id", familyId)
    .eq("id", id)
    .maybeSingle();
  return (data as Win | null) ?? null;
}
