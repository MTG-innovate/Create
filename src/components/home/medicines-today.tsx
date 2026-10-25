"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleDose } from "@/app/f/[familyId]/helpers/actions";
import type { DoseRow } from "@/lib/medicines-today";
import styles from "./home.module.css";

/**
 * "Medicines today": each dose to tick off, with who gave it and when, so no
 * one wonders whether the 8 PM dose was already given.
 */
export function MedicinesToday({ familyId, rows, names, canTick }: { familyId: string; rows: DoseRow[]; names: Record<string, string>; canTick: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(rows, (list, change: { key: string; given: boolean }) =>
    list.map((r) => (`${r.medicineId} ${r.slot}` === change.key ? { ...r, given: change.given ? (r.given ?? { momentId: "", at: "now", by: null }) : null, waiting: false } : r)),
  );
  const [, startTransition] = useTransition();
  const [said, setSaid] = useState("");
  const done = optimistic.filter((r) => r.given).length;
  const who = (by: string | null) => (by ? (names[by] ?? "family") : "you");

  return (
    <section>
      <div className="sec-head">
        <h2>Medicines today</h2>
        <span className="muted small">
          {done} of {optimistic.length} given
        </span>
      </div>
      <div className="card list">
        {optimistic.map((r) => {
          const key = `${r.medicineId} ${r.slot}`;
          return (
            <label key={key} className={`${styles.check}${r.given ? ` ${styles.done}` : ""}`}>
              <input
                type="checkbox"
                checked={Boolean(r.given)}
                disabled={!canTick}
                aria-label={`${r.name} at ${r.label}`}
                onChange={(e) => {
                  const on = e.target.checked;
                  startTransition(async () => {
                    setOptimistic({ key, given: on });
                    const result = await toggleDose(familyId, r.medicineId, r.slot, on);
                    setSaid(result.error ?? "");
                  });
                }}
              />
              <span className="main">
                <span className={styles.what} style={{ display: "block", fontWeight: 700 }}>
                  {r.label} · {r.name}
                </span>
                <span className="sub">
                  {[r.dose, r.given ? `given by ${who(r.given.by)}${r.given.at && r.given.at !== "now" ? ` at ${r.given.at}` : ""}` : r.waiting ? "Not given yet" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="muted small">Reread the label each time. Doses and the medicine list change only by hand, never by AI.</p>
      {said ? (
        <p role="status" className="small muted">
          {said}
        </p>
      ) : null}
    </section>
  );
}
