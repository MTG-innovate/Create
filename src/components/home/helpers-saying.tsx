import Link from "next/link";
import { fmtDay } from "@/lib/dates";
import { KIND_COLOR, friendlyKind, type VisitKind } from "@/lib/visits";
import styles from "./home.module.css";

type Note = { id: string; kind: string; title: string | null; provider: string | null; date: string; summary: string | null; homework: string | null };

/** "What Josiah's helpers are saying": the latest notes from each kind of visit. */
export function HelpersSaying({ familyId, name, notes }: { familyId: string; name: string; notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <section>
      <h2>What {name}&rsquo;s helpers are saying</h2>
      <div className="card list">
        {notes.map((n) => (
          <Link key={n.id} className="row" href={`/f/${familyId}/visits/${n.id}?next=${encodeURIComponent(`/f/${familyId}`)}`} style={{ textDecoration: "none", color: "var(--ink)" }}>
            <span className={styles.dot} style={{ background: `var(${KIND_COLOR[n.kind as VisitKind] ?? "--note"})` }} aria-hidden="true" />
            <span className="main">
              <span className="title" style={{ display: "block" }}>
                {friendlyKind(n.kind as VisitKind)}
              </span>
              <span className="sub">{[fmtDay(n.date), n.provider].filter(Boolean).join(" · ")}</span>
              {n.summary ? <span className={styles.clamp} style={{ display: "-webkit-box" }}>{n.summary}</span> : null}
              {n.homework ? (
                <span className={styles.atHome}>
                  <b>At home: </b>
                  {n.homework}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
