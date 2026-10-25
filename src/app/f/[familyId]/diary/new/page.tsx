import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { isDay, todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { MOMENTS, isMomentType } from "@/lib/moments";
import { suggestions } from "@/lib/moments-data";
import { getFamily } from "@/lib/session";
import { MomentForm } from "../moment-form";

export default async function NewMomentPage({ params, searchParams }: PageProps<"/f/[familyId]/diary/new">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!isMomentType(query.type) || !canEdit(me, MOMENTS[query.type].area)) notFound();
  const type = query.type;
  const child = children.find((c) => c.id === query.child) ?? children[0];
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: family.time_zone }).format(new Date());

  return (
    <>
      <h1>{MOMENTS[type].label}</h1>
      <MomentForm
        familyId={family.id}
        type={type}
        moment={null}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        childId={child.id}
        unit={family.feed_unit}
        date={isDay(query.date) ? query.date : todayIn(family.time_zone)}
        time={now}
        next={safeNext(query.next, `/f/${family.id}/diary`)}
        canEdit
        suggest={await suggestions(family.id)}
      />
    </>
  );
}
