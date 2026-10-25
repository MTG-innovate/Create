import { notFound } from "next/navigation";
import { canEdit, canView } from "@/lib/access";
import { safeNext } from "@/lib/errors";
import { MOMENTS } from "@/lib/moments";
import { loadMoment, suggestions } from "@/lib/moments-data";
import { getFamily } from "@/lib/session";
import { MomentForm } from "../moment-form";

export default async function MomentPage({ params, searchParams }: PageProps<"/f/[familyId]/diary/[momentId]">) {
  const { familyId, momentId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  const moment = /^[0-9a-f-]{36}$/.test(momentId) ? await loadMoment(family.id, momentId) : null;
  if (!moment || !canView(me, MOMENTS[moment.type].area)) notFound();

  return (
    <>
      <h1>{MOMENTS[moment.type].label}</h1>
      <MomentForm
        familyId={family.id}
        type={moment.type}
        moment={moment}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        childId={moment.child_id}
        unit={family.feed_unit}
        date={moment.date}
        time={moment.time?.slice(0, 5) ?? ""}
        next={safeNext(query.next, `/f/${family.id}/diary?date=${moment.date}`)}
        canEdit={canEdit(me, MOMENTS[moment.type].area)}
        suggest={await suggestions(family.id)}
      />
    </>
  );
}
