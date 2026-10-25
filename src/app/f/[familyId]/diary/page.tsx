import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { AddMenu } from "@/components/diary/add-menu";
import { addMenuGroups } from "@/components/diary/add-menu-groups";
import { DayTiles, newMomentHref } from "@/components/diary/day-tiles";
import styles from "@/components/diary/diary.module.css";
import { MomentRow } from "@/components/diary/moment-row";
import { canEdit, canView } from "@/lib/access";
import { addDays, dayLabel, isDay, minutesSince, todayIn } from "@/lib/dates";
import { MOMENTS, summarizeDay } from "@/lib/moments";
import { lastMeals, loadMoments, namesFor } from "@/lib/moments-data";
import { getFamily } from "@/lib/session";

export default async function DiaryPage({ params, searchParams }: PageProps<"/f/[familyId]/diary">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me, user } = await getFamily(familyId);

  if (!canView(me, "diary") && !canView(me, "nurse_notes") && !canView(me, "growth")) {
    return (
      <section className="card pad">
        <h1>Diary</h1>
        <p className="muted">The family has not shared the diary with you. Ask an owner if you need to see it.</p>
      </section>
    );
  }

  const today = todayIn(family.time_zone);
  const date = isDay(query.date) && query.date <= today ? query.date : today;
  const child = children.find((c) => c.id === query.child) ?? children[0];
  const here = (d: string) =>
    `/f/${family.id}/diary?${new URLSearchParams({ date: d, ...(children.length > 1 ? { child: child.id } : {}) })}`;
  const next = here(date);

  const all = await loadMoments(family.id, addDays(date, -1), date);
  const moments = all.filter((m) => m.child_id === child.id);
  const items = moments.filter((m) => m.date === date);
  const last = (await lastMeals(family.id, [child.id])).get(child.id) ?? null;
  const names = await namesFor(items.map((m) => m.created_by), user.id);
  const addHref = (t: Parameters<typeof newMomentHref>[1]) =>
    canEdit(me, MOMENTS[t].area) ? newMomentHref(family.id, t, date, child.id, next) : null;

  return (
    <>
      <h1>{child.name}&rsquo;s diary</h1>
      {children.length > 1 ? (
        <nav className="actions" aria-label="Whose diary">
          {children.map((c) => (
            <Link
              key={c.id}
              className={`btn small${c.id === child.id ? " primary" : ""}`}
              href={`/f/${family.id}/diary?${new URLSearchParams({ date, child: c.id })}`}
              aria-current={c.id === child.id ? "page" : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <nav className={`card ${styles.daynav}`} aria-label="Day">
        <Link className={styles.navbtn} href={here(addDays(date, -1))} aria-label="Previous day">
          ‹
        </Link>
        <b>{dayLabel(date, today)}</b>
        <Link
          className={styles.navbtn}
          href={here(addDays(date, 1))}
          aria-label="Next day"
          aria-disabled={date >= today}
          tabIndex={date >= today ? -1 : undefined}
        >
          ›
        </Link>
      </nav>

      {canView(me, "diary") ? (
        <DayTiles
          summary={summarizeDay(moments, date, family.feed_unit, last)}
          unit={family.feed_unit}
          childName={child.name}
          lastMealMinutes={last ? minutesSince(last.date, last.time, family.time_zone) : null}
          addHref={addHref}
        />
      ) : null}

      <section>
        <h2>Moments</h2>
        {items.length ? (
          <div className="card list">
            {items.map((m) => (
              <MomentRow
                key={m.id}
                moment={m}
                href={`/f/${family.id}/diary/${m.id}?next=${encodeURIComponent(next)}`}
                by={m.created_by ? names.get(m.created_by) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="calm">
              A quiet page so far. Tap the plus button to add a meal, a nap, playtime or a note from {child.name}&rsquo;s nurse.
            </p>
          </div>
        )}
      </section>

      <AddMenu groups={addMenuGroups({ familyId: family.id, me, childName: child.name, childId: child.id, date, next })} />
      <LiveRefresh familyId={family.id} tables={["moments"]} />
    </>
  );
}
