import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, canView } from "@/lib/access";
import { dayLabel, todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { getFamily } from "@/lib/session";
import { friendlyKind } from "@/lib/visits";
import { loadVisit, teamNames } from "@/lib/visits-data";
import { VisitForm } from "../visit-form";

export default async function VisitPage({ params, searchParams }: PageProps<"/f/[familyId]/visits/[visitKey]">) {
  const { familyId, visitKey } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!canView(me, "visits")) notFound();
  const { visit, series } = await loadVisit(family.id, decodeURIComponent(visitKey));

  return (
    <>
      <section>
        <p className="eyebrow">{dayLabel(visit.date, todayIn(family.time_zone))}</p>
        <h1>{visit.title || friendlyKind(visit.kind)}</h1>
        {visit.date >= todayIn(family.time_zone) ? (
          <div className="actions">
            <Link className="btn primary" href={`/f/${family.id}/visits/${encodeURIComponent(visit.key)}/sheet`}>
              Visit sheet
            </Link>
            <span className="muted small">Everything this helper should know, ready to show or copy</span>
          </div>
        ) : null}
      </section>
      <VisitForm
        familyId={family.id}
        visit={visit}
        inSeries={Boolean(series)}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        team={await teamNames(family.id)}
        canEdit={canEdit(me, "visits")}
        defaultDate={visit.date}
        next={safeNext(query.next, `/f/${family.id}/visits`)}
      />
    </>
  );
}
