import type { CSSProperties, ReactNode } from "react";

// The prototype's ICON set, drawn at 24×24 with a round 1.9 stroke.
const PATHS: Record<string, ReactNode> = {
  meal: (
    <>
      <path d="M9.5 3h5M10 3v3L8 9v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9l-2-3V3" />
      <path d="M8 13h8" />
    </>
  ),
  night_feed: <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  diaper: <path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1A4.5 4.5 0 0 0 7 18z" />,
  nap: <path d="M4 6h6l-6 7h6M13 12h5l-5 6h5" />,
  playtime: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" />
    </>
  ),
  weigh_in: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z" />
      <path d="M12 14c0-3-2.5-5-6-5 0 3.5 2.5 5 6 5z" />
      <path d="M8 20h8" />
    </>
  ),
  medicine_given: (
    <>
      <rect x="4" y="9" width="16" height="7" rx="3.5" transform="rotate(-35 12 12.5)" />
      <path d="M10 8.5l4 7" />
    </>
  ),
  nurse_note: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M12 17s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4z" />
    </>
  ),
  note: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  win: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" />
    </>
  ),
  visit: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
    </>
  ),
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.note}
    </svg>
  );
}

/** A soft rounded square in a color token with an icon in it (the prototype's bubble). */
export function Bubble({ name, color, size = 38 }: { name: string; color: string; size?: number }) {
  const style = { "--c": `var(${color})`, width: size, height: size } as CSSProperties;
  return (
    <span className="bubble" style={style} aria-hidden="true">
      <Icon name={name} />
    </span>
  );
}
