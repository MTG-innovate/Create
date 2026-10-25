"use client";

import { useOptimistic, useState, useTransition } from "react";
import { togglePractice } from "@/app/f/[familyId]/helpers/actions";
import styles from "./home.module.css";

type Item = { id: string; instruction: string; provider: string | null; doneBy: string | null };

/** "Practice together today": daily home exercises from therapists, with who checked each one. */
export function PracticeToday({ familyId, items, canCheck }: { familyId: string; items: Item[]; canCheck: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(items, (list, change: { id: string; done: boolean }) =>
    list.map((i) => (i.id === change.id ? { ...i, doneBy: change.done ? i.doneBy ?? "you" : null } : i)),
  );
  const [, startTransition] = useTransition();
  const [said, setSaid] = useState("");
  const done = optimistic.filter((i) => i.doneBy).length;

  return (
    <section>
      <div className="sec-head">
        <h2>Practice together today</h2>
        <span className="muted small">
          {done} of {optimistic.length}
        </span>
      </div>
      <div className="card list">
        {optimistic.map((item) => (
          <label key={item.id} className={`${styles.check}${item.doneBy ? ` ${styles.done}` : ""}`}>
            <input
              type="checkbox"
              checked={Boolean(item.doneBy)}
              disabled={!canCheck}
              onChange={(e) => {
                const on = e.target.checked;
                startTransition(async () => {
                  setOptimistic({ id: item.id, done: on });
                  const result = await togglePractice(familyId, item.id, on);
                  setSaid(result.error ?? result.done ?? "");
                });
              }}
            />
            <span className="main">
              <span className={styles.what} style={{ display: "block", fontWeight: 700 }}>
                {item.instruction}
              </span>
              <span className="sub">{[item.provider, item.doneBy ? `done by ${item.doneBy}` : null].filter(Boolean).join(" · ")}</span>
            </span>
          </label>
        ))}
      </div>
      <p role="status" className="small muted" style={{ minHeight: "1.2em" }}>
        {said}
      </p>
    </section>
  );
}
