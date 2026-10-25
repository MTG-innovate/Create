"use client";

import { useState } from "react";

/** Copies a phone number or text, with the prototype's fallback hint when copying is blocked. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [said, setSaid] = useState("");
  return (
    <button
      type="button"
      className="btn small"
      aria-label={`${label} ${text}`}
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
