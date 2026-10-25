import Link from "next/link";
import { getFamily, getMyFamilies } from "@/lib/session";
import styles from "./family.module.css";

export default async function FamilyLayout({ children, params }: LayoutProps<"/f/[familyId]">) {
  const { familyId } = await params;
  const [{ family, children: kids }, families] = await Promise.all([getFamily(familyId), getMyFamilies()]);
  const others = families.filter((f) => f.id !== family.id);
  const initial = kids[0]?.name.trim()[0]?.toUpperCase() ?? "♡";

  return (
    <>
      <header className={`band ${styles.top}`}>
        <div className={`inner ${styles.bar}`}>
          <div className={styles.who}>
            <span className={styles.avatar} aria-hidden="true">
              {initial}
            </span>
            {others.length ? (
              <details className={styles.switcher}>
                <summary className={styles.name}>{family.name}</summary>
                <div className={`card list ${styles.menu}`}>
                  {others.map((f) => (
                    <Link key={f.id} className="row" href={`/f/${f.id}`}>
                      {f.name}
                    </Link>
                  ))}
                  <Link className="row" href="/welcome">
                    Start another family
                  </Link>
                </div>
              </details>
            ) : (
              <p className={styles.name}>{family.name}</p>
            )}
          </div>
          <nav className={styles.nav} aria-label="Family">
            <Link href={`/f/${family.id}`}>Home</Link>
            <Link href={`/f/${family.id}/people`}>People</Link>
            <form action="/auth/sign-out" method="post">
              <button className="linkbtn" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="band">
        <div className="inner stack">{children}</div>
      </main>
    </>
  );
}
