import { notFound } from "next/navigation";
import { canEdit, canView } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { loadTeam } from "@/lib/helpers-data";
import { RECORDS, isRecordKind } from "@/lib/records";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { RecordForm } from "../../record-form";

export default async function RecordPage({ params, searchParams }: PageProps<"/f/[familyId]/helpers/[kind]/[recordId]">) {
  const { familyId, kind, recordId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!isRecordKind(kind) || !canView(me, RECORDS[kind].area) || !/^[0-9a-f-]{36}$/.test(recordId)) notFound();
  const supabase = await createClient();
  const { data: record } = await supabase.from(RECORDS[kind].table).select("*").eq("family_id", family.id).eq("id", recordId).maybeSingle();
  if (!record) notFound();
  return (
    <>
      <h1>{(record.name as string) ?? RECORDS[kind].title}</h1>
      <RecordForm
        familyId={family.id}
        kind={kind}
        record={record}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        childId={(record.child_id as string) ?? children[0].id}
        today={todayIn(family.time_zone)}
        team={(await loadTeam(family.id)).map((t) => t.name)}
        next={safeNext(query.next, `/f/${family.id}/helpers`)}
        canEdit={canEdit(me, RECORDS[kind].area)}
      />
    </>
  );
}
