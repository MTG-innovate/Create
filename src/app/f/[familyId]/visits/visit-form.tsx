"use client";

import { useActionState, useState } from "react";
import { ActionForm, type FormState } from "@/components/action-form";
import { REPEAT_CHOICES, VISIT_KINDS, type Visit } from "@/lib/visits";
import { removeVisit, saveVisit } from "./actions";

type Props = {
  familyId: string;
  visit: Visit | null;
  inSeries: boolean;
  kids: { id: string; name: string }[];
  team: string[];
  canEdit: boolean;
  defaultDate: string;
  next: string;
  /** Values to start with, such as a draft from a visit summary, over the visit's own. */
  draft?: Partial<Visit>;
};

/** The prototype's visit sheet (CFG.appts), with the same fields and words. */
export function VisitForm({ familyId, visit, inSeries, kids, team, canEdit, defaultDate, next, draft }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVisit, {});
  const [scope, setScope] = useState<"this" | "all">("this");
  const v = visit;
  const d: Partial<Visit> = { ...visit, ...draft };
  const hm = (t: string | null | undefined) => t?.slice(0, 5) ?? "";

  return (
    <>
      <form action={action} className="card pad">
        <input type="hidden" name="familyId" value={familyId} />
        <input type="hidden" name="key" value={v?.key ?? ""} />
        <input type="hidden" name="next" value={next} />
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="fields">
            {kids.length > 1 && !inSeries ? (
              <div className="field">
                <label htmlFor="childId">Who is this visit for</label>
                <select id="childId" name="childId" defaultValue={v?.child_id ?? kids[0].id}>
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="childId" value={v?.child_id ?? kids[0].id} />
            )}
            <div className="field">
              <label htmlFor="kind">Type</label>
              <select id="kind" name="kind" defaultValue={d.kind ?? VISIT_KINDS[0]}>
                {VISIT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <Text name="title" label="What is it" value={d.title} placeholder="Feeding evaluation" />
            <div className="field">
              <label htmlFor="provider">Doctor, therapist or nurse</label>
              <input id="provider" name="provider" defaultValue={d.provider ?? ""} list="team" autoComplete="off" />
              <datalist id="team">
                {team.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="field half">
              <label htmlFor="date">Date *</label>
              <input id="date" name="date" type="date" required defaultValue={d.date ?? defaultDate} />
            </div>
            <div className="field half">
              <label htmlFor="time">Time</label>
              <input id="time" name="time" type="time" defaultValue={hm(d.time)} />
            </div>
            <Text name="location" label="Location" value={d.location} />
            <Text name="who" label="Who is going" value={d.who} />
            <Text name="bring" label="What to bring" value={d.bring} placeholder="Insurance card, med list, diapers, bottle" />
            <Area name="notes" label="Before the visit" value={d.notes} rows={2} placeholder="Questions to ask, paperwork" />
            <Area
              name="summary"
              label="What happened at the visit"
              value={d.summary}
              rows={4}
              placeholder="Weight, what they checked, what they said"
            />
            <Area
              name="homework"
              label="What we need to do at home"
              value={d.homework}
              rows={3}
              placeholder="Exercises, feeding changes, next appointment"
            />
            {!v ? (
              <div className="field">
                <label htmlFor="repeat">Repeat</label>
                <select id="repeat" name="repeat" defaultValue="1">
                  {REPEAT_CHOICES.map(([n, label]) => (
                    <option key={n} value={n}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {inSeries ? (
              <fieldset className="field">
                <legend>This visit repeats every week. Save changes to</legend>
                <label className="choice">
                  <input type="radio" name="scope" value="this" checked={scope === "this"} onChange={() => setScope("this")} />
                  <span>Just this visit</span>
                </label>
                <label className="choice">
                  <input type="radio" name="scope" value="all" checked={scope === "all"} onChange={() => setScope("all")} />
                  <span>
                    Every week
                    <br />
                    <span className="muted small">
                      Type, place, time and who is going change for every week. What happened stays with this visit.
                    </span>
                  </span>
                </label>
              </fieldset>
            ) : null}
          </div>
        </fieldset>
        {state.error ? (
          <p className="banner" role="alert">
            {state.error}
          </p>
        ) : null}
        {canEdit ? (
          <div className="actions">
            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <p className="muted small">You can see this visit, but not change it.</p>
        )}
      </form>

      {v && canEdit ? (
        <section className="card pad">
          {inSeries ? (
            <>
              <RemoveButton familyId={familyId} visitKey={v.key} next={next} how="cancel" label="Cancel just this visit" />
              <RemoveButton
                familyId={familyId}
                visitKey={v.key}
                next={next}
                how="stop"
                label="Stop the weekly visits from here"
                hint="Earlier visits and their notes stay."
              />
            </>
          ) : (
            <RemoveButton familyId={familyId} visitKey={v.key} next={next} how="delete" label="Delete this visit" />
          )}
        </section>
      ) : null}
    </>
  );
}

function RemoveButton(props: { familyId: string; visitKey: string; next: string; how: string; label: string; hint?: string }) {
  return (
    <ActionForm action={removeVisit} submit={props.label} confirm="Tap again to confirm" pendingLabel="One moment…" danger>
      <input type="hidden" name="familyId" value={props.familyId} />
      <input type="hidden" name="key" value={props.visitKey} />
      <input type="hidden" name="how" value={props.how} />
      <input type="hidden" name="next" value={props.next} />
      {props.hint ? <p className="muted small">{props.hint}</p> : null}
    </ActionForm>
  );
}

function Text({ name, label, value, placeholder }: { name: string; label: string; value?: string | null; placeholder?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value ?? ""} placeholder={placeholder} autoComplete="off" />
    </div>
  );
}

function Area(props: { name: string; label: string; value?: string | null; rows: number; placeholder?: string }) {
  return (
    <div className="field">
      <label htmlFor={props.name}>{props.label}</label>
      <textarea id={props.name} name={props.name} rows={props.rows} defaultValue={props.value ?? ""} placeholder={props.placeholder} />
    </div>
  );
}
