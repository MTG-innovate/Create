"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./family.module.css";

// The prototype's bottom tab bar. People and Settings are reached from Helpers.
const TABS = [
  { path: "", label: "Home", icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  {
    path: "/visits",
    label: "Visits",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    path: "/diary",
    label: "Diary",
    icon: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <path d="M5 17a3 3 0 0 1 3-3h11" />
      </>
    ),
  },
  { path: "/journey", label: "Journey", icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /> },
  { path: "/helpers", also: ["/people", "/settings"], label: "Helpers", icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /> },
];

export function Tabs({ familyId }: { familyId: string }) {
  const pathname = usePathname();
  const base = `/f/${familyId}`;
  const current = TABS.slice()
    .reverse()
    .find((t) =>
      t.path ? [t.path, ...(("also" in t && t.also) || [])].some((p) => pathname.startsWith(base + p)) : pathname === base,
    );

  return (
    <nav className={styles.tabs} aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.label} href={base + t.path} aria-current={t === current ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {t.icon}
          </svg>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
