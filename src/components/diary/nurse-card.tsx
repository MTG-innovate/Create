import Link from "next/link";
import { Bubble } from "@/components/icons";
import { fmtTime } from "@/lib/dates";
import type { Moment } from "@/lib/moments";
import styles from "./diary.module.css";

/**
 * Today's nurse note as a friendly card (the prototype's nurseCard). "Keep an
 * eye on" sits in a soft highlighted box, never alarm red.
 */
export function NurseCard({ moment, href, childName, by }: { moment: Moment; href: string; childName: string; by?: string }) {
  const d = moment.details as Record<string, string | number | undefined>;
  const rows = (
    [
      ["Ate and drank", d.intake ? `${d.intake} ${d.unit ?? ""}`.trim() : ""],
      ["Meals", d.feeds],
      ["Diapers", d.wet != null || d.dirty != null ? `${d.wet ?? 0} wet, ${d.dirty ?? 0} dirty` : ""],
      [`How ${childName} is doing`, d.vitals],
      ["Practice and play", d.activity],
    ] as const
  ).filter(([, v]) => v);

  return (
    <Link className={`card ${styles.nurse}`} href={href}>
      <span className={styles.nhead}>
        <Bubble name="nurse_note" color="--nurse" />
        <span>
          <b>
            {d.nurse || `${childName}'s nurse`} checked in{moment.time ? ` at ${fmtTime(moment.time)}` : ""}
          </b>
          {by ? <span className="small muted" style={{ display: "block" }}>Added by {by}</span> : null}
        </span>
      </span>
      {rows.length ? (
        <dl>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : d.text ? (
        <p className={styles.clamp}>{d.text}</p>
      ) : null}
      {d.concerns ? (
        <span className={styles.watch}>
          <b>Keep an eye on: </b>
          {d.concerns}
        </span>
      ) : null}
      {rows.length && d.text ? <span className="small muted">Tap to read the whole message</span> : null}
    </Link>
  );
}
