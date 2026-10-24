"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, {});

  if (state.sentTo) {
    return (
      <div className="card pad" role="status">
        <h2>Check your email</h2>
        <p>
          We sent a sign-in link to <b>{state.sentTo}</b>. Open it on this phone or computer. It works once and expires
          in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card pad">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </div>
      {state.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
      <p className="muted small">No password to remember. New here? The same link creates your account.</p>
    </form>
  );
}
