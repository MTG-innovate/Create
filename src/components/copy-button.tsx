"use client";

import { useState } from "react";

/** Copies a phone number or text, with the prototype's fallback hint when copying is blocked. */
export function CopyButton({ text, label = "Copy", primary, long }: { text: string; label?: string; primary?: boolean; long?: boolean }) {
  const [said, setSaid] = useState("");
  return (
    <button
      type="button"
      className={primary ? "btn primary" : "btn small"}
      // Short text (a phone number) is part of the name; long text (a whole sheet) is not read aloud.
      aria-label={long ? label : `${label} ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setSaid("Copied");
        } catch {
          setSaid("Press and hold to copy");
        }
        setTimeout(() => setSaid(""), 2400);
      }}
    >
      <span aria-live="polite">{said || label}</span>
    </button>
  );
}
