"use client";

import { useActionState } from "react";
import { ActionForm, type FormState } from "@/components/action-form";
import { RECORDS, TEAM_ROLES, type RecordField, type RecordKind } from "@/lib/records";
import { deleteRecord, saveRecord } from "./actions";

type Props = {
  familyId: string;
  kind: RecordKind;
  record: Record<string, unknown> | null;
  kids: { id: string; name: string }[];
  childId: string;
  today: string;
  team: string[];
  next: string;
  canEdit: boolean;
};

/** The prototype's sheets for a helper, a practice instruction or a medicine. */
export function RecordForm({ familyId, kind, record, kids, childId, today, team, next, canEdit }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecord, {});
  const config = RECORDS[kind];
  const child = kids.find((k) => k.id === childId) ?? kids[0];

  return (
    <>
      <form action={action} className="card pad">
        <input type="hidden" name="familyId" value={familyId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={(record?.id as string) ?? ""} />
        <input type="hidden" name="next" value={next} />
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="fields">
            {config.perChild && kids.length > 1 ? (
              <div className="field">
                <label htmlFor="childId">Who is this for</label>
                <select id="childId" name="childId" defaultValue={child.id}>
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : config.perChild ? (
              <input type="hidden" name="childId" value={child.id} />
            ) : null}
            {config.fields(child.name).map((f) => (
              <Field key={f.key} field={f} value={record?.[f.key]} today={today} options={f.suggest === "roles" ? TEAM_ROLES : f.suggest === "team" ? team : undefined} />
            ))}
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
          <p className="muted small">You can see this, but not change it.</p>
        )}
      </form>
      {record && canEdit ? (
        <section className="card pad">
          <ActionForm action={deleteRecord} submit="Delete" confirm="Tap again to delete" pendingLabel="Deleting…" danger>
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={record.id as string} />
            <input type="hidden" name="next" value={next} />
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}

function Field({ field: f, value, today, options }: { field: RecordField; value: unknown; today: string; options?: string[] }) {
  const id = `f_${f.key}`;
  const initial = value ?? (f.initial === "today" ? today : f.initial);
  if (f.kind === "checkbox") {
    return (
      <label className="field choice" htmlFor={id} style={{ flexDirection: "row" }}>
        <input id={id} name={f.key} type="checkbox" defaultChecked={initial !== false && initial != null} />
        <span>{f.label}</span>
      </label>
    );
  }
  const label = `${f.label}${f.required ? " *" : ""}`;
  const text = initial == null ? "" : String(initial);
  return (
    <div className={`field${f.half ? " half" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {f.kind === "textarea" ? (
        <textarea id={id} name={f.key} rows={3} required={f.required} defaultValue={text} placeholder={f.placeholder} />
      ) : f.kind === "select" ? (
        <select id={id} name={f.key} defaultValue={text}>
          <option value="">Choose…</option>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={f.key}
          type={f.kind === "tel" ? "tel" : f.kind === "date" ? "date" : "text"}
          inputMode={f.kind === "tel" ? "tel" : undefined}
          required={f.required}
          defaultValue={text}
          placeholder={f.placeholder}
          list={options?.length ? `${id}_list` : undefined}
          autoComplete="off"
        />
      )}
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
