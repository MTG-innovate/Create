import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { isDay, todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { visitKindsFor } from "@/lib/journeys";
import { getFamily } from "@/lib/session";
import { VISIT_KINDS, type Visit } from "@/lib/visits";
import { teamNames } from "@/lib/visits-data";
import { VisitForm } from "../visit-form";

export default async function NewVisitPage({ params, searchParams }: PageProps<"/f/[familyId]/visits/new">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!canEdit(me, "visits")) notFound();
  // After a visit summary is saved: the next appointment it mentioned, ready to check and add.
  const one = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined);
  const kind = VISIT_KINDS.find((k) => k === query.kind);
  const draft: Partial<Visit> = {
    ...(kind ? { kind } : {}),
    ...(one(query.title) ? { title: one(query.title) } : {}),
    ...(one(query.provider) ? { provider: one(query.provider) } : {}),
    ...(typeof query.time === "string" && /^\d{2}:\d{2}$/.test(query.time) ? { time: query.time } : {}),
  };
  const mentioned = query.from === "capture";

  return (
    <>
      <h1>{mentioned ? "The next appointment they mentioned" : "New visit"}</h1>
      {mentioned ? <p className="muted">Check it and save to add it to the week, or go back if it is already planned.</p> : null}
      <VisitForm
        familyId={family.id}
        visit={null}
        inSeries={false}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        kinds={visitKindsFor(children.map((c) => c.journey))}
        team={await teamNames(family.id)}
        canEdit
        defaultDate={isDay(query.date) ? query.date : todayIn(family.time_zone)}
        next={safeNext(query.next, `/f/${family.id}/visits`)}
        draft={draft}
      />
    </>
  );
}
