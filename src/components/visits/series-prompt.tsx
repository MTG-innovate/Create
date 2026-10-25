import { ActionForm } from "@/components/action-form";
import { keepSeriesGoing, seriesIsEnding } from "@/app/f/[familyId]/visits/actions";
import { fmtDay } from "@/lib/dates";
import { KEEP_GOING_WEEKS, KIND_COLOR, type SeriesRow } from "@/lib/visits";
import styles from "./visits.module.css";

/** The prototype's seriesCards: a weekly visit is about to run out. Is it still happening? */
export function SeriesPrompts({ familyId, series }: { familyId: string; series: SeriesRow[] }) {
  return series.map((s) => (
    <section key={s.id} className={`card ${styles.series}`}>
      <span className={styles.bubble} style={{ ["--c" as string]: `var(${KIND_COLOR[s.kind]})` }} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
        </svg>
      </span>
      <div className={styles.main}>
        <b>
          {s.title || s.kind} on {fmtDay(s.starts_on, { weekday: "long" })}s ends {fmtDay(s.ends_on!, { month: "short", day: "numeric" })}
        </b>
        <div className={styles.sub}>Is it still happening? Add the next three months so nobody misses it.</div>
        <div className={styles.answers}>
          <ActionForm action={keepSeriesGoing} submit={`Keep it going ${KEEP_GOING_WEEKS} more weeks`} pendingLabel="Adding…">
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="seriesId" value={s.id} />
          </ActionForm>
          <ActionForm action={seriesIsEnding} submit="It is ending" pendingLabel="Saving…" plain>
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="seriesId" value={s.id} />
          </ActionForm>
        </div>
      </div>
    </section>
  ));
}
