import type { NextRequest } from "next/server";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "children",
  "visit_series",
  "visits",
  "moments",
  "practice_items",
  "practice_checks",
  "medicines",
  "team_contacts",
  "wins",
  "questions",
] as const;

/**
 * "Download everything": the owner's copy of all the family's records, as one
 * JSON file. Every read runs as the owner, under the same row level security
 * as the app.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/f/[familyId]/export">) {
  const { familyId } = await params;
  const { family, me } = await getFamily(familyId);
  if (me.role !== "owner") return new Response("Only an owner can download the family's data.", { status: 403 });

  const supabase = await createClient();
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*").eq("family_id", family.id);
      if (error) throw error;
      return [table, data] as const;
    }),
  );
  const { data: members } = await supabase.from("family_members").select("user_id, role, helper_label, view_areas, edit_areas, created_at").eq("family_id", family.id);
  const { data: names } = await supabase.from("profiles").select("id, display_name").in("id", (members ?? []).map((m) => m.user_id));

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      family,
      people: (members ?? []).map((m) => ({ ...m, name: names?.find((n) => n.id === m.user_id)?.display_name ?? "" })),
      ...Object.fromEntries(results),
    },
    null,
    2,
  );
  const fileName = `little-steps-${family.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
