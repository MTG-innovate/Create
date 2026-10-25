"use client";

import { useActionState, useState, type ReactNode } from "react";

export type FormState = { error?: string; done?: string };

/** A form for a server action that shows its result next to the button. */
export function ActionForm({
  action,
  children,
  submit,
  pendingLabel,
  danger,
  plain,
  confirm,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode;
  submit: string;
  pendingLabel: string;
  danger?: boolean;
  plain?: boolean;
  confirm?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  const [armed, setArmed] = useState(false);
  return (
    <form
      action={run}
      className="fields"
      onSubmit={(e) => {
        // Destructive buttons ask for a second tap instead of a pop-up.
        if (confirm && !armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      {children}
      <div className="actions">
        <button className={`btn small ${danger ? "danger" : plain ? "" : "primary"}`} type="submit" disabled={pending}>
          {pending ? pendingLabel : armed && confirm ? confirm : submit}
        </button>
        <span role="status" className="small muted">
          {state.done}
        </span>
      </div>
      {state.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
