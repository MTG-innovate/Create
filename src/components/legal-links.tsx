import Link from "next/link";

/** Privacy and terms, at the foot of the pages a new family sees first. */
export function LegalLinks() {
  return (
    <p className="muted small" style={{ textAlign: "center" }}>
      <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
    </p>
  );
}
