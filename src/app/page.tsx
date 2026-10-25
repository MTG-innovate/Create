import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyFamilies, getUser } from "@/lib/session";

export default async function Start() {
  if (await getUser()) {
    const families = await getMyFamilies();
    redirect(families.length ? `/f/${families[0].id}` : "/welcome");
  }

  return (
    <main className="band">
      <div className="inner stack">
        <section className="card pad" style={{ background: "linear-gradient(135deg, var(--hero1), var(--hero2))", border: 0 }}>
          <p className="eyebrow">Little Steps</p>
          <h1>Every small step, in one warm place.</h1>
          <p>
            Visits, meals, naps, nurse notes and wins for your little one, shared with everyone who helps them grow.
          </p>
          <div className="actions">
            <Link className="btn primary" href="/sign-in">
              Sign in or get started
            </Link>
          </div>
        </section>
        <p className="muted small" style={{ textAlign: "center" }}>
          Little Steps helps your family stay organized. It is not medical advice. Follow your care team, and call 911
          in an emergency.
        </p>
      </div>
    </main>
  );
}
