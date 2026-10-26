"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { StartStep } from "@/lib/getting-started";

// The checklist hides itself once everything is done. "Hide this" is
// remembered on this phone only, which is all a checklist like this needs.

const hiddenKey = (familyId: string) => `getting-started-hidden:${familyId}`;
const listeners = new Set<() => void>();

function readHidden(familyId: string) {
  try {
    return localStorage.getItem(hiddenKey(familyId)) === "1";
  } catch {
    return false;
  }
}

/** "Add to Home Screen" only matters on a phone that has not done it yet. */
function homeScreenStep(): "done" | "todo" | "skip" {
  const phone = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  return installed ? "done" : phone ? "todo" : "skip";
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function GettingStarted({ familyId, steps }: { familyId: string; steps: StartStep[] }) {
  const hidden = useSyncExternalStore(subscribe, () => readHidden(familyId), () => false);
  const homeScreen = useSyncExternalStore(subscribe, homeScreenStep, () => "skip" as const);

  const all: (StartStep & { hint?: string })[] =
    homeScreen === "skip"
      ? steps
      : [
          ...steps,
          {
            key: "home-screen",
            label: "Add JOSIA Care to your Home Screen",
            href: `/f/${familyId}/settings`,
            done: homeScreen === "done",
            hint: "In the browser's Share menu, tap Add to Home Screen. Reminders on iPhone need this.",
          },
        ];
  const done = all.filter((s) => s.done).length;
  if (hidden || done === all.length) return null;

  const hide = () => {
    try {
      localStorage.setItem(hiddenKey(familyId), "1");
    } catch {}
    listeners.forEach((fn) => fn());
  };

  return (
    <section aria-labelledby="getting-started">
      <div className="sec-head">
        <h2 id="getting-started">Getting started</h2>
        <span className="muted small">
          {done} of {all.length} done
        </span>
      </div>
      <div className="card list">
        {all.map((s) =>
          s.done ? (
            <div key={s.key} className="row" style={{ color: "var(--muted)" }}>
              <span aria-hidden="true" style={{ color: "var(--accent-text)", fontWeight: 700, width: 24 }}>
                ✓
              </span>
              <span className="main">
                <s>{s.label}</s>
                <span className="visually-hidden"> (done)</span>
              </span>
            </div>
          ) : (
            <Link key={s.key} className="row" href={s.href} style={{ textDecoration: "none", color: "var(--ink)" }}>
              <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 12, border: "2px solid var(--line)", flex: "none" }} />
              <span className="main">
                <span className="title" style={{ display: "block" }}>
                  {s.label}
                </span>
                {s.hint ? <span className="sub">{s.hint}</span> : null}
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          ),
        )}
      </div>
      <div className="actions">
        <button type="button" className="btn small" onClick={hide}>
          Hide this
        </button>
      </div>
    </section>
  );
}
