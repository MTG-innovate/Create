"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { addBrightSpot, type BrightSpotState } from "@/app/f/[familyId]/journey/actions";
import { fmtDay } from "@/lib/dates";
import { WIN_COLOR, type Win } from "@/lib/journey";
import { celebrate } from "./celebrate";
import styles from "./journey.module.css";

/** "Bright spots" on Home (the prototype's brightSpots): one line, saved as a win, with a short confetti burst. */
export function BrightSpots({
  familyId,
  childId,
  childName,
  wins,
  canAdd,
}: {
  familyId: string;
  childId: string;
  childName: string;
  wins: Win[];
  canAdd: boolean;
}) {
  const [state, action, pending] = useActionState<BrightSpotState, FormData>(addBrightSpot, {});
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.saved) return;
    if (input.current) input.current.value = "";
    celebrate();
  }, [state.saved]);

  return (
    <section>
      <div className="sec-head">
        <h2>Bright spots</h2>
        {wins.length ? (
          <Link className="linkbtn" href={`/f/${familyId}/journey`}>
            See all
          </Link>
        ) : null}
      </div>
      <div className={`card ${styles.bright}`}>
        {canAdd ? (
          <form action={action} className={styles.brightIn}>
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="childId" value={childId} />
            <label htmlFor="brightIn">What was good today?</label>
            <div className={styles.brightRow}>
              <input ref={input} id="brightIn" name="title" type="text" maxLength={300} autoComplete="off" placeholder={`${childName} smiled at the therapist today…`} />
              <button className="btn primary small" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
            <p role="status" className="small muted" style={{ minHeight: "1.2em" }}>
              {state.error ?? state.done ?? ""}
            </p>
          </form>
        ) : null}
        {wins.length ? (
          <div className="list">
            {wins.map((w) => (
              <Link key={w.id} className="row" href={`/f/${familyId}/journey/wins/${w.id}?next=${encodeURIComponent(`/f/${familyId}`)}`} style={{ textDecoration: "none", color: "var(--ink)" }}>
                <span className={styles.winstar} style={{ background: `var(${WIN_COLOR[w.category]})` }} aria-hidden="true" />
                <span className="main">
                  <span className="title" style={{ display: "block" }}>
                    {w.title}
                  </span>
                  <span className="sub">{fmtDay(w.happened_on, { month: "short", day: "numeric" })}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="calm">Every good moment counts. A smile, a full meal, a calm night. Write one here and it joins {childName}&rsquo;s journey.</p>
        )}
      </div>
    </section>
  );
}
