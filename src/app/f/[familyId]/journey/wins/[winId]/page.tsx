import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { safeNext } from "@/lib/errors";
import { loadWin } from "@/lib/journey-data";
import { getFamily } from "@/lib/session";
import { WinForm } from "../../win-form";

export default async function WinPage({ params, searchParams }: PageProps<"/f/[familyId]/journey/wins/[winId]">) {
  const { familyId, winId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  const win = /^[0-9a-f-]{36}$/.test(winId) ? await loadWin(family.id, winId) : null;
  if (!win) notFound();
  return (
    <>
      <h1>A win worth celebrating</h1>
      <WinForm
        familyId={family.id}
        win={win}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        childId={win.child_id}
        date={win.happened_on}
        next={safeNext(query.next, `/f/${family.id}/journey`)}
        canEdit={canEdit(me, "wins")}
      />
    </>
  );
}
