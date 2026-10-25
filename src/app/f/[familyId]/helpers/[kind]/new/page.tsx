import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { loadTeam } from "@/lib/helpers-data";
import { RECORDS, isRecordKind } from "@/lib/records";
import { getFamily } from "@/lib/session";
import { RecordForm } from "../../record-form";

export default async function NewRecordPage({ params, searchParams }: PageProps<"/f/[familyId]/helpers/[kind]/new">) {
  const { familyId, kind } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!isRecordKind(kind) || !canEdit(me, RECORDS[kind].area)) notFound();
  const child = children.find((c) => c.id === query.child) ?? children[0];
  return (
    <>
      <h1>New {RECORDS[kind].title.toLowerCase()}</h1>
      <RecordForm
        familyId={family.id}
        kind={kind}
        record={null}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        childId={child.id}
        today={todayIn(family.time_zone)}
        team={(await loadTeam(family.id)).map((t) => t.name)}
        next={safeNext(query.next, `/f/${family.id}/helpers`)}
        canEdit
      />
    </>
  );
}
