import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { SeriesPrompts } from "@/components/visits/series-prompt";
import { WeekPlan } from "@/components/visits/week-plan";
import { canEdit, canView } from "@/lib/access";
import { addDays, ageText, daysBetween, greeting, hourIn, isDay, todayIn } from "@/lib/dates";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { endingSoon } from "@/lib/visits";
import { loadVisits } from "@/lib/visits-data";
import styles from "./home.module.css";

export default async function FamilyHome({ params, searchParams }: PageProps<"/f/[familyId]">) {
  const { familyId } = await params;
  const { day } = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  const today = todayIn(family.time_zone);
  const hello = greeting(hourIn(family.time_zone));
  const selected = isDay(day) && daysBetween(today, day) >= 0 && daysBetween(today, day) < 7 ? day : today;

  const seesVisits = canView(me, "visits");
  const editsVisits = canEdit(me, "visits");
  const week = seesVisits ? await loadVisits(family.id, today, addDays(today, 6)) : null;
  const childNames = children.length > 1 ? new Map(children.map((c) => [c.id, c.name])) : null;
  const alone = me.role === "owner" && (await countMembers(family.id)) === 1;

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

      {week && editsVisits ? <SeriesPrompts familyId={family.id} series={endingSoon(week.series, today, 14)} /> : null}

      {week ? (
        <WeekPlan
          familyId={family.id}
          today={today}
          selected={selected}
          visits={week.visits}
          canAdd={editsVisits}
          childNames={childNames}
        />
      ) : null}

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

      {seesVisits ? <LiveRefresh familyId={family.id} tables={["visits", "visit_series"]} /> : null}
    </>
  );
}

async function countMembers(familyId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("family_members").select("*", { count: "exact", head: true }).eq("family_id", familyId);
  return count ?? 0;
}
