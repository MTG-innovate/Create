import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseVisitKey, visitFromRow, visitFromSeries, visitsBetween, isSeriesDate, type SeriesRow, type Visit, type VisitRow } from "@/lib/visits";

/** Visits from `from` to `to` (inclusive), and every weekly series in the family. */
export async function loadVisits(familyId: string, from: string, to: string): Promise<{ visits: Visit[]; series: SeriesRow[] }> {
  const supabase = await createClient();
  const [rows, series] = await Promise.all([
    supabase
      .from("visits")
      .select("*")
      .eq("family_id", familyId)
      // Rows shown in the window, plus series rows that replace a date in it.
      .or(`and(date.gte.${from},date.lte.${to}),and(occurrence_date.gte.${from},occurrence_date.lte.${to})`),
    supabase.from("visit_series").select("*").eq("family_id", familyId),
  ]);
  if (rows.error) throw rows.error;
  if (series.error) throw series.error;
  return { visits: visitsBetween(rows.data as VisitRow[], series.data as SeriesRow[], from, to), series: series.data as SeriesRow[] };
}

/** One visit by its key, and its series if it has one. Not found if it is not this family's. */
export async function loadVisit(familyId: string, key: string): Promise<{ visit: Visit; series: SeriesRow | null }> {
  const supabase = await createClient();
  const ref = parseVisitKey(key);

  if ("id" in ref) {
    const { data } = await supabase.from("visits").select("*").eq("family_id", familyId).eq("id", ref.id).maybeSingle();
    if (!data) notFound();
    const row = data as VisitRow;
    const series = row.series_id ? await loadSeries(familyId, row.series_id) : null;
    return { visit: visitFromRow(row), series };
  }

  const series = await loadSeries(familyId, ref.seriesId);
  if (!series || !isSeriesDate(series, ref.date)) notFound();
  // If this date already has its own row, use it.
  const { data } = await supabase
    .from("visits")
    .select("*")
    .eq("series_id", series.id)
    .eq("occurrence_date", ref.date)
    .maybeSingle();
  return { visit: data ? visitFromRow(data as VisitRow) : visitFromSeries(series, ref.date), series };
}

async function loadSeries(familyId: string, id: string): Promise<SeriesRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("visit_series").select("*").eq("family_id", familyId).eq("id", id).maybeSingle();
  return (data as SeriesRow | null) ?? null;
}

/** Names from the family's care team, to suggest in the visit form. */
export async function teamNames(familyId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("team_contacts").select("name").eq("family_id", familyId).order("name");
  return (data ?? []).map((t) => t.name as string);
}
