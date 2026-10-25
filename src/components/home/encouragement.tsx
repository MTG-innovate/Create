import { encouragement } from "@/lib/daily-words";
import styles from "./home.module.css";

/** The daily encouragement card: scripture or gentle words, as the family chose in Settings. */
export function Encouragement({ style, today, name }: { style: "scripture" | "gentle"; today: string; name: string }) {
  const words = encouragement(style, today, name);
  return (
    <section className={styles.encourage}>
      <svg className={styles.sun} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <figure style={{ margin: 0 }}>
        <blockquote className={styles.quote} style={{ margin: 0 }}>
          {words.text}
        </blockquote>
        {words.reference ? <figcaption className={styles.ref}>{words.reference}</figcaption> : null}
      </figure>
    </section>
  );
}
