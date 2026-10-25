import Link from "next/link";
import { AddMenu } from "@/components/diary/add-menu";
import { addMenuGroups } from "@/components/diary/add-menu-groups";
import { DayTiles, newMomentHref } from "@/components/diary/day-tiles";
import diary from "@/components/diary/diary.module.css";
import { NurseCard } from "@/components/diary/nurse-card";
import { Bubble } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { SeriesPrompts } from "@/components/visits/series-prompt";
import { WeekPlan } from "@/components/visits/week-plan";
import { canEdit, canView } from "@/lib/access";
import { addDays, ageText, daysBetween, fmtTime, greeting, hourIn, isDay, minutesSince, todayIn } from "@/lib/dates";
import { MOMENTS, newestFirst, summarizeDay, type MomentType } from "@/lib/moments";
import { lastMeals, loadMoments, namesFor } from "@/lib/moments-data";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { endingSoon } from "@/lib/visits";
import { loadVisits } from "@/lib/visits-data";
import styles from "./home.module.css";

export default async function FamilyHome({ params, searchParams }: PageProps<"/f/[familyId]">) {
  const { familyId } = await params;
  const { day } = await searchParams;
  const { family, children, me, user } = await getFamily(familyId);
  const today = todayIn(family.time_zone);
  const hour = hourIn(family.time_zone);
  const selected = isDay(day) && daysBetween(today, day) >= 0 && daysBetween(today, day) < 7 ? day : today;
  const here = `/f/${family.id}`;

  const seesVisits = canView(me, "visits");
  const editsVisits = canEdit(me, "visits");
  const seesDiary = canView(me, "diary");
  const seesNurse = canView(me, "nurse_notes");
  const week = seesVisits ? await loadVisits(family.id, today, addDays(today, 6)) : null;
  const moments = seesDiary || seesNurse ? await loadMoments(family.id, addDays(today, -1), today) : [];
  const last = seesDiary ? await lastMeals(family.id, children.map((c) => c.id)) : new Map();
  const nurseToday = newestFirst(moments.filter((m) => m.type === "nurse_note" && m.date === today));
  const names = await namesFor(nurseToday.map((m) => m.created_by), user.id);
  const childNames = children.length > 1 ? new Map(children.map((c) => [c.id, c.name])) : null;
  const alone = me.role === "owner" && (await countMembers(family.id)) === 1;
  const first = children[0];

  return (
    <>
      {children.map((child) => (
        <section key={child.id} className={styles.hero}>
          <span className={styles.photo} aria-hidden="true">
            {child.name.trim()[0]?.toUpperCase()}
          </span>
          <div className={styles.text}>
            <p className="eyebrow">{greeting(hour)}</p>
            <h1 className={styles.heroName}>{child.name}</h1>
            {ageText(child.birth_date) ? <p className={styles.age}>{ageText(child.birth_date)}</p> : null}
          </div>
        </section>
      ))}

      {week && editsVisits ? <SeriesPrompts familyId={family.id} series={endingSoon(week.series, today, 14)} /> : null}

      {week ? (
        <WeekPlan familyId={family.id} today={today} selected={selected} visits={week.visits} canAdd={editsVisits} childNames={childNames} />
      ) : null}

      {seesDiary
        ? children.map((child) => {
            const mine = moments.filter((m) => m.child_id === child.id);
            const lastMeal = last.get(child.id) ?? null;
            const add = (t: MomentType) => (canEdit(me, MOMENTS[t].area) ? newMomentHref(family.id, t, today, child.id, here) : null);
            const nightFeedLogged = mine.some((m) => m.type === "night_feed" && m.date === today);
            return (
              <section key={child.id}>
                <h2>{child.name}&rsquo;s day so far</h2>
                {hour >= 17 && !nightFeedLogged && add("night_feed") ? (
                  <Link className={diary.nightcard} href={add("night_feed")!}>
                    <Bubble name="night_feed" color="--sleep" />
                    <span>
                      <b>Ready for the night feed?</b>
                      <span className={diary.sub} style={{ display: "block" }}>
                        Tap here when the pump starts. You can add how it went in the morning.
                      </span>
                    </span>
                  </Link>
                ) : null}
                <DayTiles
                  summary={summarizeDay(mine, today, family.feed_unit, lastMeal)}
                  unit={family.feed_unit}
                  childName={child.name}
                  lastMealMinutes={lastMeal ? minutesSince(lastMeal.date, lastMeal.time, family.time_zone) : null}
                  addHref={add}
                />
              </section>
            );
          })
        : null}

      {seesNurse ? (
        <NurseSection
          familyId={family.id}
          childName={first.name}
          notes={nurseToday}
          names={names}
          nurseVisitTime={week?.visits.find((v) => v.date === today && v.kind === "In-home nurse")?.time ?? undefined}
          nurseVisitToday={Boolean(week?.visits.some((v) => v.date === today && v.kind === "In-home nurse"))}
          addHref={canEdit(me, "nurse_notes") ? newMomentHref(family.id, "nurse_note", today, first.id, here) : null}
        />
      ) : null}

      {alone ? (
        <section className="card pad">
          <h2>Bring in the people who help</h2>
          <p className="muted">
            Invite a grandparent, the other parent, or {first.name}&rsquo;s nurse. Each person sees only what you choose.
          </p>
          <div className="actions">
            <Link className="btn primary" href={`/f/${family.id}/people`}>
              Invite someone
            </Link>
          </div>
        </section>
      ) : null}

      <AddMenu groups={addMenuGroups({ familyId: family.id, me, childName: first.name, childId: first.id, date: today, next: here })} />
      <LiveRefresh familyId={family.id} tables={["visits", "visit_series", "moments"]} />
    </>
  );
}

/** "From Josiah's nurse": shown when the nurse has written today, or is visiting today. */
function NurseSection(props: {
  familyId: string;
  childName: string;
  notes: Awaited<ReturnType<typeof loadMoments>>;
  names: Map<string, string>;
  nurseVisitToday: boolean;
  nurseVisitTime?: string;
  addHref: string | null;
}) {
  if (!props.notes.length && !props.nurseVisitToday) return null;
  return (
    <section>
      <div className="sec-head">
        <h2>From {props.childName}&rsquo;s nurse</h2>
        {props.addHref ? (
          <Link className="linkbtn" href={props.addHref}>
            + Add the update
          </Link>
        ) : null}
      </div>
      {props.notes.length ? (
        props.notes.map((m) => (
          <NurseCard
            key={m.id}
            moment={m}
            href={`/f/${props.familyId}/diary/${m.id}?next=${encodeURIComponent(`/f/${props.familyId}`)}`}
            childName={props.childName}
            by={m.created_by ? props.names.get(m.created_by) : undefined}
          />
        ))
      ) : (
        <div className="card">
          <p className="calm">
            {props.childName}&rsquo;s nurse is here today{props.nurseVisitTime ? ` from ${fmtTime(props.nurseVisitTime)}` : ""}. When the
            update comes in, add it here and the whole family will see it.
          </p>
        </div>
      )}
    </section>
  );
}

async function countMembers(familyId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("family_members").select("*", { count: "exact", head: true }).eq("family_id", familyId);
  return count ?? 0;
}
