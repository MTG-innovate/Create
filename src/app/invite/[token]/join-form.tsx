"use client";

import { useActionState } from "react";
import { acceptInvitation, type JoinState } from "./actions";

export function JoinForm({ token, yourName }: { token: string; yourName: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptInvitation, {});
  return (
    <form action={action} className="fields">
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="yourName">Your name, as the family will see it</label>
        <input id="yourName" name="yourName" defaultValue={yourName} maxLength={80} autoComplete="name" required />
      </div>
      {state.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join"}
        </button>
      </div>
    </form>
  );
}
