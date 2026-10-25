"use client";

import { useActionState } from "react";
import { ActionForm, type FormState } from "@/components/action-form";
import { MOMENTS, type Field, type Moment, type MomentType, type Unit } from "@/lib/moments";
import { deleteMoment, saveMoment } from "./actions";

type Props = {
  familyId: string;
  type: MomentType;
  moment: Moment | null;
  kids: { id: string; name: string }[];
  childId: string;
  unit: Unit;
  date: string;
  time: string;
  next: string;
  canEdit: boolean;
  suggest: Record<"practice" | "medicines" | "team", string[]>;
};

/** The prototype's moment sheet (editLog): date and time, then that kind of moment's own fields. */
export function MomentForm({ familyId, type, moment, kids, childId, unit, date, time, next, canEdit, suggest }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMoment, {});
  const child = kids.find((k) => k.id === childId) ?? kids[0];
  const fields = MOMENTS[type].fields({ name: child.name, unit });
  const value = (f: Field): string => {
    if (!moment) return f.initial ?? "";
    const v = f.key === "note" ? moment.note : moment.details[f.key];
    return v == null ? "" : String(v);
  };
  const night = type === "night_feed";

  return (
    <>
      <form action={action} className="card pad">
        <input type="hidden" name="familyId" value={familyId} />
        <input type="hidden" name="id" value={moment?.id ?? ""} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="fields">
            {kids.length > 1 ? (
              <div className="field">
                <label htmlFor="childId">Who is this for</label>
                <select id="childId" name="childId" defaultValue={childId}>
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="childId" value={childId} />
            )}
            <div className="field half">
              <label htmlFor="date">{night ? "Night of" : "Date"} *</label>
              <input id="date" name="date" type="date" required defaultValue={date} />
            </div>
            <div className="field half">
              <label htmlFor="time">{night ? "Started" : "Time"}</label>
              <input id="time" name="time" type="time" defaultValue={time} />
            </div>
            {fields.map((f) => (
              <FieldInput key={f.key} field={f} value={value(f)} options={f.suggest ? suggest[f.suggest] : undefined} />
            ))}
          </div>
        </fieldset>
        {night ? (
          <p className="muted small">Leave the total empty and it is worked out from the pump rate and the times.</p>
        ) : null}
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
          <p className="muted small">You can see this, but not change it.</p>
        )}
      </form>
      {moment && canEdit ? (
        <section className="card pad">
          <ActionForm action={deleteMoment} submit="Delete" confirm="Tap again to delete" pendingLabel="Deleting…" danger>
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="id" value={moment.id} />
            <input type="hidden" name="next" value={next} />
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}

function FieldInput({ field: f, value, options }: { field: Field; value: string; options?: string[] }) {
  const id = `f_${f.key}`;
  let input;
  if (f.kind === "select") {
    input = (
      <select id={id} name={f.key} defaultValue={value}>
        <option value="">Choose…</option>
        {(f.options ?? []).map((o) => {
          const [v, label] = typeof o === "string" ? [o, o] : o;
          return (
            <option key={v} value={v}>
              {label}
            </option>
          );
        })}
      </select>
    );
  } else if (f.kind === "textarea") {
    input = <textarea id={id} name={f.key} rows={f.rows ?? 3} defaultValue={value} placeholder={f.placeholder} />;
  } else {
    input = (
      <input
        id={id}
        name={f.key}
        type={f.kind === "number" ? "number" : f.kind === "time" ? "time" : "text"}
        inputMode={f.kind === "number" ? "decimal" : undefined}
        step={f.step}
        min={f.kind === "number" ? 0 : undefined}
        defaultValue={value}
        placeholder={f.placeholder}
        list={options?.length ? `${id}_list` : undefined}
        autoComplete="off"
      />
    );
  }
  return (
    <div className={`field${f.half ? " half" : ""}`}>
      <label htmlFor={id}>{f.label}</label>
      {input}
      {options?.length ? (
        <datalist id={`${id}_list`}>
          {[...new Set(options)].map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
