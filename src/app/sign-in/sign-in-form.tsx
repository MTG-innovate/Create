"use client";

import { useActionState, useState } from "react";
import { sendSignInLink, signInWithCode, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [sent, setSent] = useState<SignInState | null>(null);
  const [state, action, pending] = useActionState<SignInState, FormData>(async (prev, form) => {
    const result = await sendSignInLink(prev, form);
    if (result.sentTo) setSent(result);
    return result;
  }, {});

  if (sent?.sentTo) return <EnterCode sent={sent} next={next} startOver={() => setSent(null)} />;

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

/** After the email is sent: type its code here, or tap its link. */
function EnterCode({ sent, next, startOver }: { sent: SignInState; next: string; startOver: () => void }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithCode, sent);

  return (
    <form action={action} className="card pad">
      <h2>Check your email</h2>
      <p>
        We sent a sign-in email to <b>{sent.sentTo}</b>. Type the code from it here, or tap its button on this phone or
        computer. Both work once, for an hour.
      </p>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="code">Code from the email</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          required
          style={{ fontSize: "1.4rem", letterSpacing: "0.2em" }}
        />
      </div>
      {state.codeError ? (
        <p className="banner" role="alert">
          {state.codeError}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <button className="btn" type="button" onClick={startOver}>
          Use a different email
        </button>
      </div>
      <p className="muted small">Using JOSIA Care from your Home Screen? Type the code, so you stay in the app.</p>
    </form>
  );
}
