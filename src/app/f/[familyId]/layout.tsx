import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { photoUrls } from "@/lib/photos";
import { getFamily, getMyFamilies } from "@/lib/session";
import { addChild } from "./settings/actions";
import styles from "./family.module.css";
import { Tabs } from "./tabs";

export default async function FamilyLayout({ children, params }: LayoutProps<"/f/[familyId]">) {
  const { familyId } = await params;
  const [{ family, children: kids, me }, families] = await Promise.all([getFamily(familyId), getMyFamilies()]);
  const others = families.filter((f) => f.id !== family.id);
  const initial = kids[0]?.name.trim()[0]?.toUpperCase() ?? "♡";
  const photo = kids[0] ? (await photoUrls(kids.slice(0, 1))).get(kids[0].id) : undefined;

  return (
    <>
      <header className={`band ${styles.top}`}>
        <div className={`inner ${styles.bar}`}>
          <div className={styles.who}>
            <span className={styles.avatar} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived private link */}
              {photo ? <img src={photo} alt="" width={40} height={40} /> : initial}
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
          <form action="/auth/sign-out" method="post">
            <button className="linkbtn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className={`band ${styles.withTabs}`}>
        <div className="inner stack">
          {kids.length ? (
            children
          ) : (
            // Every page is about a child; after the last child's data is deleted, start again here.
            <section className="card pad">
              <h1>Who are we caring for?</h1>
              <p className="muted">This family has no little one in it right now.</p>
              {me.role === "owner" || me.role === "family" ? (
                <ActionForm action={addChild} submit="Add" pendingLabel="Adding…">
                  <input type="hidden" name="familyId" value={family.id} />
                  <div className="field half">
                    <label htmlFor="first-name">Name</label>
                    <input id="first-name" name="name" required maxLength={60} />
                  </div>
                  <div className="field half">
                    <label htmlFor="first-birth">Birthday</label>
                    <input id="first-birth" name="birthDate" type="date" />
                  </div>
                </ActionForm>
              ) : null}
            </section>
          )}
        </div>
      </main>
      <Tabs familyId={family.id} />
    </>
  );
}
