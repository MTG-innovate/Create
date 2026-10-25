"use client";

import { startTransition, useActionState, useState } from "react";
import { CAPTURE, typedDraft, type CaptureMode, type NurseDraft, type VisitDraft } from "@/lib/capture";
import type { Unit } from "@/lib/moments";
import { shrinkPhoto } from "@/lib/shrink-photo";
import type { Visit } from "@/lib/visits";
import { MomentForm } from "../diary/moment-form";
import { VisitForm } from "../visits/visit-form";
import { sortCapture, type CaptureState } from "./actions";

type Props = {
  familyId: string;
  mode: CaptureMode;
  kids: { id: string; name: string }[];
  childId: string;
  unit: Unit;
  today: string;
  now: string;
  next: string;
  claude: boolean;
  team: string[];
  suggest: Record<"practice" | "medicines" | "team", string[]>;
};

type Review = { by: "claude" | "you"; nurse?: NurseDraft; visit?: VisitDraft; match?: Visit | null };

/**
 * The prototype's openCapture and applyCapture: paste, dictate or photograph,
 * let Claude sort it, then check the draft in the usual form. Nothing is saved
 * until the person taps Save on that form.
 */
export function CaptureFlow(props: Props) {
  const { familyId, mode, kids, childId, unit, today, now, next, claude, team, suggest } = props;
  const C = CAPTURE[mode];
  const [state, sort, sorting] = useActionState<CaptureState, FormData>(sortCapture, {});
  const [text, setText] = useState("");
  const [kind, setKind] = useState(mode === "visit" ? "" : (C.kinds?.[0] ?? ""));
  const [typed, setTyped] = useState<Review | null>(null);
  const [dismissed, setDismissed] = useState<CaptureState | null>(null);
  const child = kids.find((k) => k.id === childId) ?? kids[0];

  const fromClaude: Review | null = state !== dismissed && (state.nurse || state.visit) ? { by: "claude", ...state } : null;
  const review = typed ?? fromClaude;

  if (review) {
    const startOver = () => {
      setTyped(null);
      setDismissed(state);
    };
    return (
      <>
        {review.by === "claude" ? (
          <div className="card soft" role="status">
            <p className="calm">
              Claude drafted this from what you shared. Check each line and change anything that is not right. Nothing is saved until you
              tap Save.
            </p>
            {review.visit?.fields.homework?.includes("Medicine changes:") ? (
              <p className="muted small">
                Medicine changes are kept in the visit notes. If a medicine or dose changed, update {child.name}&rsquo;s medicine list
                yourself.
              </p>
            ) : null}
            {review.match ? (
              <p className="muted small">This fills in the {review.match.kind} visit already planned for that day.</p>
            ) : null}
          </div>
        ) : null}
        {review.nurse ? (
          <MomentForm
            familyId={familyId}
            type="nurse_note"
            moment={null}
            kids={kids}
            childId={childId}
            unit={unit}
            date={review.nurse.date}
            time={review.nurse.time}
            next={next}
            canEdit
            suggest={suggest}
            draft={review.nurse.details}
          />
        ) : review.visit ? (
          <VisitForm
            familyId={familyId}
            visit={review.match ?? null}
            inSeries={Boolean(review.match?.series_id)}
            kids={kids}
            team={team}
            canEdit
            defaultDate={review.visit.date}
            next={afterSave(familyId, review.visit, next)}
            draft={{ kind: review.visit.kind as Visit["kind"], date: review.visit.date, ...review.visit.fields }}
          />
        ) : null}
        <div className="actions">
          <button type="button" className="btn" onClick={startOver}>
            Start over
          </button>
        </div>
      </>
    );
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) form.set("photo", await shrinkPhoto(photo, 1600), "photo.jpg");
    startTransition(() => sort(form));
  };
  const typeIt = () => setTyped({ by: "you", ...(mode === "nurse" ? { nurse: typedDraft("nurse", text, kind, { today, now, unit }) as NurseDraft } : { visit: typedDraft(mode, text, kind, { today, now, unit }) as VisitDraft }) });

  return (
    <form className="card pad" onSubmit={submit}>
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="now" value={now} />
      <div className="fields">
        {C.kinds ? (
          <div className="field">
            <label htmlFor="kind">Which visit</label>
            <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {mode === "visit" ? <option value="">Let Claude tell from the summary</option> : null}
              {C.kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="text">{C.label}</label>
          <textarea id="text" name="text" rows={7} placeholder={C.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {C.photo && claude ? (
          <div className="field">
            <label htmlFor="photo">{C.photo}</label>
            <input id="photo" name="photo" type="file" accept="image/*" />
          </div>
        ) : null}
      </div>
      <p className="muted small" aria-live="polite">
        {sorting
          ? "Reading it now. This can take up to a minute."
          : claude
            ? C.hint(child.name)
            : "Claude is not set up for Little Steps yet, so type it in and check it before saving."}
      </p>
      {state.error && state !== dismissed ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button type="button" className="btn" onClick={typeIt}>
          Type it in myself
        </button>
        {claude ? (
          <button type="submit" className="btn primary" disabled={sorting}>
            {sorting ? "Reading…" : state.error ? "Try again" : "Sort it for me"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** After a captured visit saves, offer the next appointment it mentioned (the prototype's offerNext). */
function afterSave(familyId: string, draft: VisitDraft, next: string): string {
  if (!draft.next) return next;
  const n = draft.next;
  const q = new URLSearchParams({ from: "capture", kind: n.kind, date: n.date, title: n.title, next });
  if (n.time) q.set("time", n.time);
  if (n.provider) q.set("provider", n.provider);
  return `/f/${familyId}/visits/new?${q}`;
}
