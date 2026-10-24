import Link from "next/link";
import { ageText, greeting, hourIn } from "@/lib/dates";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import styles from "./home.module.css";

export default async function FamilyHome({ params }: PageProps<"/f/[familyId]">) {
  const { familyId } = await params;
  const { family, children, me } = await getFamily(familyId);
  const hello = greeting(hourIn(family.time_zone));

  let alone = false;
  if (me.role === "owner") {
    const supabase = await createClient();
    const { count } = await supabase.from("family_members").select("*", { count: "exact", head: true }).eq("family_id", family.id);
    alone = count === 1;
  }

  return (
    <>
      {children.map((child) => (
        <section key={child.id} className={styles.hero}>
          <span className={styles.photo} aria-hidden="true">
            {child.name.trim()[0]?.toUpperCase()}
          </span>
          <div className={styles.text}>
            <p className="eyebrow">{hello}</p>
            <h1 className={styles.heroName}>{child.name}</h1>
            {ageText(child.birth_date) ? <p className={styles.age}>{ageText(child.birth_date)}</p> : null}
          </div>
        </section>
      ))}

      {alone ? (
        <section className="card pad">
          <h2>Bring in the people who help</h2>
          <p className="muted">
            Invite a grandparent, the other parent, or {children[0]?.name ?? "your little one"}&rsquo;s nurse. Each
            person sees only what you choose.
          </p>
          <div className="actions">
            <Link className="btn primary" href={`/f/${family.id}/people`}>
              Invite someone
            </Link>
          </div>
        </section>
      ) : null}

      <section className="card">
        <p className="calm">
          This is where {children.map((c) => c.name).join(" and ")}&rsquo;s days will live: visits, meals, naps,
          nurse notes and wins. Those arrive in the next updates.
        </p>
      </section>
    </>
  );
}
