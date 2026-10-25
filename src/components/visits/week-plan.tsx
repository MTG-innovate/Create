import Link from "next/link";
import { addDays, dayLabel, fmtDay } from "@/lib/dates";
import { KIND_COLOR, type Visit } from "@/lib/visits";
import { TimelineRow } from "./visit-rows";
import styles from "./visits.module.css";

/** "This week": seven days from today with a dot per visit type, and the chosen day's timeline. */
export function WeekPlan({
  familyId,
  today,
  selected,
  visits,
  canAdd,
  childNames,
}: {
  familyId: string;
  today: string;
  selected: string;
  visits: Visit[];
  canAdd: boolean;
  childNames: Map<string, string> | null;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const onDay = (d: string) => visits.filter((v) => v.date === d);
  const list = onDay(selected);
  const back = encodeURIComponent(`/f/${familyId}?day=${selected}`);

  return (
    <section>
      <div className="sec-head">
        <h2>This week</h2>
        {canAdd ? (
          <Link className="linkbtn" href={`/f/${familyId}/visits/new?date=${selected}&next=${back}`}>
            + Add a visit
          </Link>
        ) : null}
      </div>
      <nav className={styles.week} aria-label="This week">
        {days.map((d) => {
          const kinds = [...new Set(onDay(d).map((v) => v.kind))].slice(0, 4);
          return (
            <Link
              key={d}
              className={styles.wday}
              href={d === today ? `/f/${familyId}` : `/f/${familyId}?day=${d}`}
              scroll={false}
              aria-current={d === selected ? "date" : undefined}
              aria-label={`${dayLabel(d, today)}, ${kinds.length ? `${onDay(d).length} visits` : "no visits"}`}
            >
              <span className={styles.wd}>{d === today ? "Today" : fmtDay(d, { weekday: "short" })}</span>
              <b>{fmtDay(d, { day: "numeric" })}</b>
              <span className={styles.dots} aria-hidden="true">
                {kinds.map((k) => (
                  <i key={k} style={{ background: `var(${KIND_COLOR[k]})` }} />
                ))}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className={`card ${styles.dayCard}`}>
        <p className="eyebrow">{dayLabel(selected, today)}</p>
        {list.length ? (
          <div className={styles.tlList}>
            {list.map((v) => (
              <TimelineRow
                key={v.key}
                visit={v}
                href={`/f/${familyId}/visits/${encodeURIComponent(v.key)}?next=${back}`}
                childName={childNames?.get(v.child_id)}
              />
            ))}
          </div>
        ) : (
          <p className="calm">
            {selected === today ? "No visits today. A good day for cuddles and rest." : "Nothing planned. A free day."}
          </p>
        )}
      </div>
    </section>
  );
}
