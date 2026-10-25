import Link from "next/link";
import { fmtDay, fmtTime } from "@/lib/dates";
import { KIND_COLOR, friendlyKind, type Visit } from "@/lib/visits";
import styles from "./visits.module.css";

const color = (v: Visit) => `var(${KIND_COLOR[v.kind]})`;

/** A visit on the Home timeline (the prototype's visitRow). */
export function TimelineRow({ visit, href, childName }: { visit: Visit; href: string; childName?: string }) {
  const shortNote = visit.notes && visit.notes.length <= 24 ? visit.notes : "";
  const place = visit.location === "Home" ? "At home" : visit.location?.split(",")[0];
  const sub = [childName, shortNote, place, visit.who ? `With ${visit.who}` : ""].filter(Boolean).join(" · ");
  return (
    <Link className={styles.tl} href={href}>
      <span className={styles.tlTime}>{visit.time ? fmtTime(visit.time) : "Anytime"}</span>
      <span className={styles.dot} style={{ background: color(visit) }} aria-hidden="true" />
      <span className={styles.main}>
        <span className={styles.title} style={{ display: "block" }}>
          {visit.title || friendlyKind(visit.kind)}
        </span>
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </span>
    </Link>
  );
}

/** A visit in the Visits list (the prototype's apptRow). */
export function VisitListRow({ visit, href, childName }: { visit: Visit; href: string; childName?: string }) {
  return (
    <Link className={styles.appt} href={href}>
      <span className={styles.datebox}>
        <span>{fmtDay(visit.date, { month: "short" })}</span>
        <b>{fmtDay(visit.date, { day: "numeric" })}</b>
        <span>{fmtDay(visit.date, { weekday: "short" })}</span>
      </span>
      <span className={styles.main}>
        <span className={styles.title} style={{ display: "block" }}>
          {visit.title || visit.kind}
        </span>
        <span className={styles.sub} style={{ display: "block" }}>
          {[visit.time ? fmtTime(visit.time) : "Time not set", visit.provider, visit.location, childName].filter(Boolean).join(" · ")}
        </span>
        {visit.who ? (
          <span className={styles.sub} style={{ display: "block" }}>
            Going: {visit.who}
          </span>
        ) : null}
        {visit.summary ? <span className={styles.clamp}>{visit.summary}</span> : null}
        {visit.homework ? (
          <span className={styles.home} style={{ display: "block" }}>
            <b>At home: </b>
            {visit.homework}
          </span>
        ) : null}
        <span className={styles.chip}>
          <i style={{ background: color(visit) }} />
          {visit.kind}
          {visit.series_id ? " · weekly" : ""}
        </span>
      </span>
    </Link>
  );
}
