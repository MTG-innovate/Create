import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { getFamily } from "@/lib/session";
import { WinForm } from "../../win-form";

export default async function NewWinPage({ params, searchParams }: PageProps<"/f/[familyId]/journey/wins/new">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!canEdit(me, "wins")) notFound();
  const child = children.find((c) => c.id === query.child) ?? children[0];
  return (
    <>
      <h1>Celebrate a win</h1>
      <WinForm
        familyId={family.id}
        win={null}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        childId={child.id}
        date={todayIn(family.time_zone)}
        next={safeNext(query.next, `/f/${family.id}/journey`)}
        canEdit
      />
    </>
  );
}
