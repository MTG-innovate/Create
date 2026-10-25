import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { SeriesPrompts } from "@/components/visits/series-prompt";
import { VisitListRow } from "@/components/visits/visit-rows";
import styles from "@/components/visits/visits.module.css";
import { canEdit, canView } from "@/lib/access";
import { addDays, dayLabel, todayIn } from "@/lib/dates";
import { getFamily } from "@/lib/session";
import { VISIT_KINDS, endingSoon, type Visit, type VisitKind } from "@/lib/visits";
import { loadVisits } from "@/lib/visits-data";
import { KindFilter } from "./kind-filter";

export default async function VisitsPage({ params, searchParams }: PageProps<"/f/[familyId]/visits">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  const childName = children[0]?.name ?? "your little one";

  if (!canView(me, "visits")) {
    return (
      <section className="card pad">
        <h1>Visits</h1>
        <p className="muted">The family has not shared visits with you. Ask an owner if you need to see them.</p>
      </section>
    );
  }

  const today = todayIn(family.time_zone);
  const past = query.show === "past";
  const kind = (VISIT_KINDS as readonly string[]).includes(String(query.kind)) ? (query.kind as VisitKind) : null;
  const { visits, series } = past
    ? await loadVisits(family.id, addDays(today, -730), addDays(today, -1))
    : await loadVisits(family.id, today, addDays(today, 365));
  const shown = (kind ? visits.filter((v) => v.kind === kind) : visits).slice();
  if (past) shown.reverse();

  const groups: { date: string; items: Visit[] }[] = [];
  for (const v of shown) {
    const last = groups[groups.length - 1];
    if (last?.date === v.date) last.items.push(v);
    else groups.push({ date: v.date, items: [v] });
  }

  const editsVisits = canEdit(me, "visits");
  const childNames = children.length > 1 ? new Map(children.map((c) => [c.id, c.name])) : null;
  const tab = (isPast: boolean) => {
    const qs = new URLSearchParams({ ...(isPast ? { show: "past" } : {}), ...(kind ? { kind } : {}) });
    return `/f/${family.id}/visits${qs.size ? `?${qs}` : ""}`;
  };
  const back = encodeURIComponent(tab(past));

  return (
    <>
      <h1>{childName}&rsquo;s visits</h1>
      {editsVisits && !past ? <SeriesPrompts familyId={family.id} series={endingSoon(series, today, 21)} /> : null}

      <div className="sec-head">
        <nav className={styles.seg} aria-label="Which visits">
          <Link href={tab(false)} aria-current={!past ? "page" : undefined}>
            Upcoming
          </Link>
          <Link href={tab(true)} aria-current={past ? "page" : undefined}>
            Past
          </Link>
        </nav>
        {editsVisits ? (
          <Link className="btn small primary" href={`/f/${family.id}/visits/new?next=${back}`}>
            + Visit
          </Link>
        ) : null}
      </div>

      <KindFilter value={kind ?? ""} />

      {groups.length ? (
        groups.map((g) => (
          <section key={g.date}>
            <p className="eyebrow">{dayLabel(g.date, today)}</p>
            <div className="card list">
              {g.items.map((v) => (
                <VisitListRow
                  key={v.key}
                  visit={v}
                  href={`/f/${family.id}/visits/${encodeURIComponent(v.key)}?next=${back}`}
                  childName={childNames?.get(v.child_id)}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="card pad">
          <p className="muted">
            {past
              ? "Past visits will collect here, with the notes from each one."
              : "Nothing scheduled. Add doctor visits, specialists, therapy sessions and nurse days. Nurse visits can repeat weekly."}
          </p>
          {editsVisits && !past ? (
            <div className="actions">
              <Link className="btn small" href={`/f/${family.id}/visits/new?next=${back}`}>
                + Add a visit
              </Link>
            </div>
          ) : null}
        </div>
      )}

      <LiveRefresh familyId={family.id} tables={["visits", "visit_series"]} />
    </>
  );
}
