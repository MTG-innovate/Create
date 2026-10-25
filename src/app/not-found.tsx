import Link from "next/link";

export default function NotFound() {
  return (
    <main className="band">
      <div className="inner stack">
        <section className="card pad">
          <h1>We could not find that page</h1>
          <p className="muted">It may belong to a Care Circle you are not part of, or the link may be old.</p>
          <div className="actions">
            <Link className="btn primary" href="/">
              Go home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
