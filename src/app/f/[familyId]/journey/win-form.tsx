"use client";

import { useActionState } from "react";
import { ActionForm, type FormState } from "@/components/action-form";
import { WIN_CATEGORIES, type Win } from "@/lib/journey";
import { deleteWin, saveWin } from "./actions";

/** The prototype's win sheet (CFG.wins). */
export function WinForm(props: { familyId: string; win: Win | null; kids: { id: string; name: string }[]; childId: string; date: string; next: string; canEdit: boolean }) {
  const { familyId, win, kids, childId, date, next, canEdit } = props;
  const [state, action, pending] = useActionState<FormState, FormData>(saveWin, {});
  return (
    <>
      <form action={action} className="card pad">
        <input type="hidden" name="familyId" value={familyId} />
        <input type="hidden" name="id" value={win?.id ?? ""} />
        <input type="hidden" name="next" value={next} />
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="fields">
            {kids.length > 1 ? (
              <div className="field">
                <label htmlFor="childId">Whose win</label>
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
            <div className="field">
              <label htmlFor="title">What happened *</label>
              <input id="title" name="title" required maxLength={300} defaultValue={win?.title ?? ""} placeholder="Took a whole bottle by mouth" autoComplete="off" />
            </div>
            <div className="field half">
              <label htmlFor="happenedOn">Date *</label>
              <input id="happenedOn" name="happenedOn" type="date" required defaultValue={win?.happened_on ?? date} />
            </div>
            <div className="field half">
              <label htmlFor="category">Kind of win</label>
              <select id="category" name="category" defaultValue={win?.category ?? "A first"}>
                {WIN_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="note">The story</label>
              <textarea id="note" name="note" rows={3} defaultValue={win?.note ?? ""} placeholder="Who saw it, how it felt" />
            </div>
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
      {win && canEdit ? (
        <section className="card pad">
          <ActionForm action={deleteWin} submit="Delete" confirm="Tap again to delete" pendingLabel="Deleting…" danger>
            <input type="hidden" name="familyId" value={familyId} />
            <input type="hidden" name="id" value={win.id} />
            <input type="hidden" name="next" value={next} />
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
