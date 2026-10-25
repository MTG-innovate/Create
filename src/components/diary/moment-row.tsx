import Link from "next/link";
import { Bubble } from "@/components/icons";
import { fmtTime } from "@/lib/dates";
import { MOMENTS, type Moment } from "@/lib/moments";
import styles from "./diary.module.css";

/** One moment in a day's list (the prototype's logRow). */
export function MomentRow({ moment, href, by, childName }: { moment: Moment; href: string; by?: string; childName?: string }) {
  const kind = MOMENTS[moment.type];
  const line = kind.line(moment);
  return (
    <Link className={styles.row} href={href}>
      <Bubble name={moment.type} color={kind.color} />
      <span className={styles.main}>
        <span className={styles.title}>
          {kind.label}
          {childName ? ` · ${childName}` : ""}
        </span>
        {line ? <span className={styles.line}>{line.length > 220 ? `${line.slice(0, 220)}…` : line}</span> : null}
        {moment.note && moment.type !== "note" ? <span className={styles.line}>{moment.note}</span> : null}
      </span>
      <span className={styles.side}>
        {fmtTime(moment.time)}
        {by ? (
          <>
            <br />
            <span className="small">{by}</span>
          </>
        ) : null}
      </span>
    </Link>
  );
}
