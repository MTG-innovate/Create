import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { isDay, todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { getFamily } from "@/lib/session";
import { teamNames } from "@/lib/visits-data";
import { VisitForm } from "../visit-form";

export default async function NewVisitPage({ params, searchParams }: PageProps<"/f/[familyId]/visits/new">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!canEdit(me, "visits")) notFound();

  return (
    <>
      <h1>New visit</h1>
      <VisitForm
        familyId={family.id}
        visit={null}
        inSeries={false}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        team={await teamNames(family.id)}
        canEdit
        defaultDate={isDay(query.date) ? query.date : todayIn(family.time_zone)}
        next={safeNext(query.next, `/f/${family.id}/visits`)}
      />
    </>
  );
}
