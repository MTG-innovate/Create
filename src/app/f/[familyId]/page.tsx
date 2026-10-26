import Link from "next/link";
import { AddMenu } from "@/components/diary/add-menu";
import { addMenuGroups } from "@/components/diary/add-menu-groups";
import { DayTiles, newMomentHref } from "@/components/diary/day-tiles";
import diary from "@/components/diary/diary.module.css";
import { NurseCard } from "@/components/diary/nurse-card";
import { Encouragement } from "@/components/home/encouragement";
import { GettingStarted } from "@/components/home/getting-started";
import { HelpersSaying } from "@/components/home/helpers-saying";
import { MomentForYou } from "@/components/home/moment-for-you";
import { MedicinesToday } from "@/components/home/medicines-today";
import { PracticeToday } from "@/components/home/practice-today";
import { QuestionsToAsk } from "@/components/home/questions";
import { Bubble } from "@/components/icons";
import { BrightSpots } from "@/components/journey/bright-spots";
import journey from "@/components/journey/journey.module.css";
import { LiveRefresh } from "@/components/live-refresh";
import { SeriesPrompts } from "@/components/visits/series-prompt";
import { WeekPlan } from "@/components/visits/week-plan";
import { canEdit, canView } from "@/lib/access";
import { gettingStarted } from "@/lib/getting-started";
import { addDays, ageText, correctedAgeText, daysBetween, fmtDay, fmtTime, greeting, hourIn, isDay, minutesSince, todayIn } from "@/lib/dates";
import { latestVisitNotes, loadChecks, loadDoses, loadPractice } from "@/lib/helpers-data";
import { dosesToday } from "@/lib/medicines-today";
import { localNow } from "@/lib/reminders";
import { upSince, weighIns } from "@/lib/journey";
import { loadWeighIns, loadWins } from "@/lib/journey-data";
import { MOMENTS, newestFirst, summarizeDay, type MomentType } from "@/lib/moments";
import { lastMeals, loadMoments, namesFor } from "@/lib/moments-data";
import { photoUrls } from "@/lib/photos";
import { dayTilesFor, journeyConfig } from "@/lib/journeys";
import { getFamily } from "@/lib/session";
import type { Child } from "@/lib/types";
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
  const first = children[0];
  const start = me.role === "owner" ? await startSteps(family.id, first, user.id) : null;
  const growth = canView(me, "growth")
    ? new Map(await Promise.all(children.map(async (c) => [c.id, upSince(weighIns(await loadWeighIns(family.id, c.id)), c.birth_date)] as const)))
    : new Map();
  const brightSpots = canView(me, "wins") ? await loadWins(family.id, first.id, 3) : null;
  const photos = await photoUrls(children);
  const caregiver = me.role !== "helper";
  const daily = canView(me, "practice")
    ? (await loadPractice(family.id)).filter((p) => p.active && (p.frequency === "Every day" || p.frequency === "Several times a day"))
    : [];
  const checks = daily.length ? await loadChecks(family.id, today) : [];
  const checkers = await namesFor(checks.map((c) => c.created_by), user.id);
  // Doses are ticked in the diary, so the checklist needs both the medicine list and the diary.
  const doses = canView(me, "medicines") && seesDiary ? await loadDoses(family.id, today) : null;
  const doseRows = doses ? dosesToday(doses.medicines, doses.given, localNow(family.time_zone, new Date()).minutes) : [];
  const givers = await namesFor(doseRows.map((r) => r.given?.by ?? null), user.id);
  const helperNotes = seesVisits ? await latestVisitNotes(family.id, today) : [];
  const allNames = children.map((c) => c.name).join(" and ");
  const questions = canView(me, "questions") ? await openQuestions(family.id) : [];

  return (
    <>
      {children.map((child) => (
        <section key={child.id} className={styles.hero}>
          <span className={styles.photo}>
            {photos.get(child.id) ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived private link, not a static asset
              <img src={photos.get(child.id)} alt={`${child.name}'s photo`} width={112} height={112} />
            ) : (
              <span aria-hidden="true">{child.name.trim()[0]?.toUpperCase()}</span>
            )}
          </span>
          <div className={styles.text}>
            <p className="eyebrow">{greeting(hour)}</p>
            <h1 className={styles.heroName}>{child.name}</h1>
            {ageText(child.birth_date) ? (
                <p className={styles.age}>
                  {ageText(child.birth_date)}
                  {correctedAgeText(child.birth_date, child.due_date) ? (
                    <span className={styles.corrected}>{correctedAgeText(child.birth_date, child.due_date)}</span>
                  ) : null}
                </p>
              ) : null}
            <UpSince familyId={family.id} up={growth.get(child.id) ?? null} />
          </div>
        </section>
      ))}

      {caregiver ? <Encouragement style={family.encouragement} today={today} name={allNames} /> : null}

      {start ? <GettingStarted familyId={family.id} steps={start} /> : null}

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
                  tiles={dayTilesFor(journeyConfig(child.journey), mine)}
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
          addHref={canEdit(me, "nurse_notes") ? `/f/${family.id}/capture/nurse?${new URLSearchParams({ child: first.id, next: here })}` : null}
        />
      ) : null}

      {doseRows.length ? (
        <MedicinesToday
          familyId={family.id}
          canTick={canEdit(me, "diary")}
          names={Object.fromEntries(givers)}
          rows={doseRows.map((r) => (childNames ? { ...r, name: `${r.name} (${childNames.get(r.childId)})` } : r))}
        />
      ) : null}

      {daily.length ? (
        <PracticeToday
          familyId={family.id}
          canCheck={canEdit(me, "practice")}
          items={daily.map((p) => {
            const check = checks.find((c) => c.practice_item_id === p.id);
            return {
              id: p.id,
              instruction: children.length > 1 ? `${p.instruction} (${childNames?.get(p.child_id)})` : p.instruction,
              provider: p.provider,
              doneBy: check ? (check.created_by ? (checkers.get(check.created_by) ?? "family") : "family") : null,
            };
          })}
        />
      ) : null}

      <HelpersSaying familyId={family.id} name={allNames} notes={helperNotes} />

      {brightSpots ? (
        <BrightSpots familyId={family.id} childId={first.id} childName={first.name} wins={brightSpots} canAdd={canEdit(me, "wins")} />
      ) : null}


      <QuestionsToAsk familyId={family.id} questions={questions} canAdd={canEdit(me, "questions")} />

      {caregiver ? <MomentForYou today={today} name={allNames} /> : null}

      <AddMenu groups={addMenuGroups({ familyId: family.id, me, childName: first.name, childId: first.id, journey: first.journey, date: today, next: here })} />
      <LiveRefresh familyId={family.id} tables={["visits", "visit_series", "moments", "wins", "practice_checks", "practice_items", "children", "families", "questions", "medicines"]} />
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
            + Add the nurse’s text
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
            update comes in, add it here and everyone in the Care Circle will see it.
          </p>
        </div>
      )}
    </section>
  );
}

/** The hero's "Up 3 lb 4 oz since birth" badge, which opens the journey. */
function UpSince({ familyId, up }: { familyId: string; up: ReturnType<typeof upSince> }) {
  if (!up) return null;
  return (
    <Link className={journey.winPill} href={`/f/${familyId}/journey`}>
      <span className={journey.starkey} aria-hidden="true" /> Up {up.gain} since {up.since === "birth" ? "birth" : fmtDay(up.since, { month: "short", day: "numeric" })}
    </Link>
  );
}

async function openQuestions(familyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("questions").select("id, text, for_whom").eq("family_id", familyId).eq("done", false).order("created_at");
  return data ?? [];
}

/** What the owner's "Getting started" checklist needs. Only owners see it, and owners can read all of this. */
async function startSteps(familyId: string, child: Child, userId: string) {
  const supabase = await createClient();
  const count = (r: { count: number | null }) => r.count ?? 0;
  const head = { count: "exact", head: true } as const;
  const [members, invites, visits, series, phones] = await Promise.all([
    supabase.from("family_members").select("*", head).eq("family_id", familyId),
    supabase.from("invitations").select("*", head).eq("family_id", familyId).is("accepted_at", null).is("revoked_at", null),
    supabase.from("visits").select("*", head).eq("family_id", familyId),
    supabase.from("visit_series").select("*", head).eq("family_id", familyId),
    supabase.from("push_devices").select("*", head).eq("family_id", familyId).eq("user_id", userId),
  ]);
  return gettingStarted({
    familyId,
    childName: child.name,
    birthDate: child.birth_date,
    othersOrInvites: count(members) - 1 + count(invites),
    visits: count(visits) + count(series),
    cardFilled: Boolean(child.allergies || child.conditions || child.emergency_plan),
    reminders: count(phones) > 0,
  });
}
