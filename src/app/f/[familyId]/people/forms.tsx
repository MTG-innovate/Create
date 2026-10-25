"use client";

import { useActionState, useRef, useState } from "react";
import { AccessFields } from "./access-fields";
import { invitePerson, type InviteState } from "./actions";

export function InviteForm({ familyId }: { familyId: string }) {
  const [state, run, pending] = useActionState<InviteState, FormData>(invitePerson, {});
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.link ?? "");
      setCopied(true);
    } catch {
      linkRef.current?.select();
    }
  };

  return (
    <form action={run} className="card pad" key={state.link}>
      <input type="hidden" name="familyId" value={familyId} />
      <div className="field">
        <label htmlFor="invite-email">Their email</label>
        <input id="invite-email" name="email" type="email" inputMode="email" autoComplete="off" required />
      </div>
      <AccessFields idPrefix="invite" />
      {state.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Making the invitation…" : "Invite"}
        </button>
      </div>
      {state.link ? (
        <div className="banner warm" role="status">
          <p>
            Send this link to <b>{state.email}</b> by text or email. It works once, only for that email address, and
            expires in 14 days.
          </p>
          <div className="copybox" style={{ marginTop: 10 }}>
            <input ref={linkRef} readOnly value={state.link} aria-label="Invitation link" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn small" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
