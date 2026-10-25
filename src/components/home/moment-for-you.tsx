import { selfCareToday } from "@/lib/daily-words";
import styles from "./home.module.css";

/** "A moment for you": a small daily act of self-care for the caregiver, and NICU family support. */
export function MomentForYou({ today, name }: { today: string; name: string }) {
  return (
    <section className={styles.moment}>
      <p className="eyebrow">A moment for you</p>
      <p className={styles.big}>{selfCareToday(today, name)}</p>
      <p className="small muted">
        Caring for {name} means caring for you too. If worry or sadness is hanging on, tell your doctor. Other NICU families understand.
      </p>
      <a className="linkbtn" href="https://handtohold.org" target="_blank" rel="noopener noreferrer">
        Support for NICU families from Hand to Hold
      </a>
    </section>
  );
}
