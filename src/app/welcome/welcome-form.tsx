"use client";

import { useActionState, useSyncExternalStore } from "react";
import { startFamily, type WelcomeState } from "./actions";

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function WelcomeForm({ yourName, needsCode }: { yourName: string; needsCode: boolean }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(startFamily, {});
  const timeZone = useSyncExternalStore(() => () => {}, browserTimeZone, () => "America/New_York");
  const typed = state.values ?? {};

  return (
    <form action={action} className="card pad">
      <input type="hidden" name="timeZone" value={timeZone} />
      <div className="fields">
        {needsCode ? (
          <div className="field">
            <label htmlFor="pilotCode">Pilot code</label>
            <input id="pilotCode" name="pilotCode" defaultValue={typed.pilotCode} required maxLength={60} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            <span className="muted small">JOSIA Care is in a small pilot. The code is in the message that invited you.</span>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="childName">Your little one&rsquo;s name</label>
          <input id="childName" name="childName" defaultValue={typed.childName} required maxLength={60} autoComplete="off" />
        </div>
        <div className="field half">
          <label htmlFor="birthDate">Birthday</label>
          <input id="birthDate" name="birthDate" type="date" defaultValue={typed.birthDate} />
        </div>
        <div className="field half">
          <label htmlFor="yourName">Your name</label>
          <input id="yourName" name="yourName" defaultValue={typed.yourName ?? yourName} maxLength={80} autoComplete="name" />
        </div>
      </div>
      {state.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Setting up…" : "Start"}
        </button>
      </div>
      <p className="muted small">
        Next you can invite family and helpers. Everything you add is private to the people you invite.
      </p>
    </form>
  );
}
