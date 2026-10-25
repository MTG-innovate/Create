import { canEdit, canView, type CareArea, type Role } from "./access";
import { addDays, fmtTime } from "./dates";
import { friendlyKind, visitsBetween, type SeriesRow, type Visit, type VisitKind, type VisitRow } from "./visits";

// Which reminders are due, worked out from what public.reminder_data returns.
// Visits: the evening before (from 7 PM) and about an hour before. The night
// feed: at the time the person picked, until someone logs it. Each reminder has
// a key so it is sent once (public.claim_reminders).

export const EVENING_FROM = "19:00";
export const SOON_MINUTES = 60;
/** How long after the chosen time the night feed reminder can still go out. */
export const NIGHT_FEED_WINDOW = 3 * 60;

export type ReminderDevice = {
  id: string;
  user_id: string;
  role: Role;
  view_areas: CareArea[];
  edit_areas: CareArea[];
  visit_evening: boolean;
  visit_soon: boolean;
  night_feed: boolean;
  night_feed_at: string;
};

export type ReminderFamily = {
  id: string;
  time_zone: string;
  children: { id: string; name: string }[];
  devices: ReminderDevice[];
  series: Pick<SeriesRow, "id" | "child_id" | "kind" | "title" | "starts_on" | "start_time" | "every_weeks" | "ends_on">[];
  visits: Pick<VisitRow, "id" | "child_id" | "series_id" | "occurrence_date" | "kind" | "title" | "date" | "time" | "cancelled">[];
  night_feeds: { child_id: string; date: string }[];
};

export type Reminder = { device_id: string; key: string; title: string; body: string; url: string };

/** The date and the minutes since midnight in a time zone. */
export function localNow(timeZone: string, now: Date): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const label = (v: Pick<Visit, "title" | "kind">) => v.title || friendlyKind(v.kind as VisitKind);

function familyVisits(f: ReminderFamily, from: string, to: string): Visit[] {
  const empty = { provider: null, location: null, who: null, bring: null, notes: null, summary: null, homework: null };
  const rows = f.visits.map((v) => ({ ...empty, ...v }) as VisitRow);
  const series = f.series.map((s) => ({ ...empty, end_confirmed_at: null, ...s }) as SeriesRow);
  return visitsBetween(rows, series, from, to);
}

export function dueReminders(families: ReminderFamily[], now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const f of families) {
    const { date: today, minutes } = localNow(f.time_zone, now);
    const tomorrow = addDays(today, 1);
    const visits = familyVisits(f, today, tomorrow);
    const name = (childId: string) => f.children.find((c) => c.id === childId)?.name ?? "your little one";

    for (const d of f.devices) {
      if (canView(d, "visits")) {
        if (d.visit_evening && minutes >= minutesOf(EVENING_FROM)) {
          for (const child of f.children) {
            const theirs = visits.filter((v) => v.date === tomorrow && v.child_id === child.id);
            if (!theirs.length) continue;
            out.push({
              device_id: d.id,
              key: `evening:${tomorrow}:${child.id}`,
              title: `Tomorrow for ${child.name}`,
              body: theirs.map((v) => `${label(v)}${v.time ? ` at ${fmtTime(v.time)}` : ""}`).join(", then ") + ".",
              url: `/f/${f.id}/visits`,
            });
          }
        }
        if (d.visit_soon) {
          for (const v of visits) {
            if (v.date !== today || !v.time) continue;
            const until = minutesOf(v.time) - minutes;
            if (until <= 0 || until > SOON_MINUTES) continue;
            out.push({
              device_id: d.id,
              key: `soon:${v.key}`,
              title: `${label(v)} at ${fmtTime(v.time)}`,
              body: `Coming up for ${name(v.child_id)} in ${until >= 55 ? "about an hour" : `${until} minutes`}.`,
              url: `/f/${f.id}/visits/${encodeURIComponent(v.key)}`,
            });
          }
        }
      }

      if (d.night_feed && canEdit(d, "diary")) {
        const since = minutes - minutesOf(d.night_feed_at);
        if (since >= 0 && since < NIGHT_FEED_WINDOW) {
          for (const child of f.children) {
            if (f.night_feeds.some((n) => n.child_id === child.id && n.date === today)) continue;
            out.push({
              device_id: d.id,
              key: `night:${today}:${child.id}`,
              title: `Ready for ${child.name}’s night feed?`,
              body: "Tap here when the pump starts. You can add how it went in the morning.",
              url: `/f/${f.id}/diary/new?${new URLSearchParams({ type: "night_feed", date: today, child: child.id, next: `/f/${f.id}` })}`,
            });
          }
        }
      }
    }
  }
  return out;
}
