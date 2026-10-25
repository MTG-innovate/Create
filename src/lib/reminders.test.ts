import { describe, expect, it } from "vitest";
import { dueReminders, localNow, type ReminderDevice, type ReminderFamily } from "./reminders";

const device = (over: Partial<ReminderDevice> = {}): ReminderDevice => ({
  id: "dev-1",
  user_id: "u-1",
  role: "family",
  view_areas: [],
  edit_areas: [],
  visit_evening: true,
  visit_soon: true,
  night_feed: false,
  night_feed_at: "21:00",
  ...over,
});

const family = (over: Partial<ReminderFamily> = {}): ReminderFamily => ({
  id: "fam",
  time_zone: "America/New_York",
  children: [{ id: "josiah", name: "Josiah" }],
  devices: [device()],
  series: [],
  visits: [],
  night_feeds: [],
  ...over,
});

const visit = (date: string, time: string | null, over = {}) => ({
  id: `v-${date}-${time}`,
  child_id: "josiah",
  series_id: null,
  occurrence_date: null,
  kind: "Physical therapy" as const,
  title: null,
  date,
  time,
  cancelled: false,
  ...over,
});

// 2026-03-10 is a Tuesday. New York is UTC-4 then (daylight saving time).
const at = (local: string) => new Date(`${local}:00-04:00`);

it("works in the family's own time zone", () => {
  expect(localNow("America/New_York", new Date("2026-03-11T02:30:00Z"))).toEqual({ date: "2026-03-10", minutes: 22 * 60 + 30 });
});

describe("the evening before", () => {
  const f = family({ visits: [visit("2026-03-11", "10:30"), visit("2026-03-11", "14:00", { kind: "Primary care" })] });

  it("waits until 7 PM, then lists tomorrow's visits", () => {
    expect(dueReminders([f], at("2026-03-10T18:59"))).toEqual([]);
    expect(dueReminders([f], at("2026-03-10T19:05"))).toEqual([
      {
        device_id: "dev-1",
        key: "evening:2026-03-11:josiah",
        title: "Tomorrow for Josiah",
        body: "Physical therapy at 10:30 AM, then Checkup at 2:00 PM.",
        url: "/f/fam/visits",
      },
    ]);
  });

  it("includes dates from a weekly series, and leaves out cancelled visits", () => {
    const series = { id: "s1", child_id: "josiah", kind: "Speech therapy" as const, title: null, starts_on: "2026-03-04", start_time: "09:00", every_weeks: 1, ends_on: null };
    const cancelled = visit("2026-03-11", "09:00", { id: "row", series_id: "s1", occurrence_date: "2026-03-11", kind: "Speech therapy", cancelled: true });
    const withSeries = dueReminders([family({ series: [series] })], at("2026-03-10T20:00"));
    expect(withSeries[0].body).toBe("Speech at 9:00 AM.");
    expect(dueReminders([family({ series: [series], visits: [cancelled] })], at("2026-03-10T20:00"))).toEqual([]);
  });

  it("is only for people who chose it", () => {
    expect(dueReminders([family({ ...f, devices: [device({ visit_evening: false })] })], at("2026-03-10T20:00"))).toEqual([]);
  });
});

describe("an hour before", () => {
  const f = family({ visits: [visit("2026-03-10", "10:30", { title: "PT with Ms. Rivera" })] });

  it("comes within the hour before a visit with a time", () => {
    expect(dueReminders([f], at("2026-03-10T09:29"))).toEqual([]);
    expect(dueReminders([f], at("2026-03-10T09:31"))).toEqual([
      {
        device_id: "dev-1",
        key: "soon:v-2026-03-10-10:30",
        title: "PT with Ms. Rivera at 10:30 AM",
        body: "Coming up for Josiah in about an hour.",
        url: "/f/fam/visits/v-2026-03-10-10%3A30",
      },
    ]);
    expect(dueReminders([f], at("2026-03-10T10:10"))[0].body).toBe("Coming up for Josiah in 20 minutes.");
    expect(dueReminders([f], at("2026-03-10T10:30"))).toEqual([]);
  });

  it("is never sent for a visit with no time", () => {
    expect(dueReminders([family({ visits: [visit("2026-03-10", null)] })], at("2026-03-10T09:31"))).toEqual([]);
  });
});

describe("the night feed", () => {
  const on = device({ night_feed: true, night_feed_at: "21:00" });

  it("comes at the chosen time until someone logs tonight's night feed", () => {
    const f = family({ devices: [on] });
    expect(dueReminders([f], at("2026-03-10T20:59"))).toEqual([]);
    const [r] = dueReminders([f], at("2026-03-10T21:02"));
    expect(r).toMatchObject({ key: "night:2026-03-10:josiah", title: "Ready for Josiah’s night feed?" });
    expect(r.url).toContain("/f/fam/diary/new?type=night_feed&date=2026-03-10&child=josiah");
    expect(dueReminders([family({ devices: [on], night_feeds: [{ child_id: "josiah", date: "2026-03-10" }] })], at("2026-03-10T21:02"))).toEqual([]);
    // Last night's feed does not count for tonight.
    expect(dueReminders([family({ devices: [on], night_feeds: [{ child_id: "josiah", date: "2026-03-09" }] })], at("2026-03-10T21:02"))).toHaveLength(1);
  });

  it("stops a few hours after the chosen time", () => {
    expect(dueReminders([family({ devices: [on] })], at("2026-03-10T23:59"))).toHaveLength(1);
    expect(dueReminders([family({ devices: [device({ night_feed: true, night_feed_at: "19:00" })] })], at("2026-03-10T22:00"))).toEqual([]);
  });
});

describe("care areas", () => {
  const f = (d: ReminderDevice) =>
    family({ devices: [d], visits: [visit("2026-03-10", "21:30")] });

  it("a helper hears about visits only if they can see visits, and the night feed only if they can add to the diary", () => {
    const helper = (view: ReminderDevice["view_areas"], edit: ReminderDevice["edit_areas"]) =>
      device({ role: "helper", view_areas: view, edit_areas: edit, night_feed: true });
    expect(dueReminders([f(helper(["diary"], ["diary"]))], at("2026-03-10T21:05")).map((r) => r.key)).toEqual(["night:2026-03-10:josiah"]);
    expect(dueReminders([f(helper(["visits", "diary"], []))], at("2026-03-10T21:05")).map((r) => r.key)).toEqual(["soon:v-2026-03-10-21:30"]);
  });

  it("a viewer can be reminded of visits but not asked to log the night feed", () => {
    expect(dueReminders([f(device({ role: "viewer", night_feed: true }))], at("2026-03-10T21:05")).map((r) => r.key)).toEqual(["soon:v-2026-03-10-21:30"]);
  });
});

it("never puts notes, places or who is going on the lock screen", () => {
  const f = family({ visits: [visit("2026-03-11", "10:30", { notes: "Bring the echo results", location: "Clinic 4" })] });
  const text = JSON.stringify(dueReminders([f], at("2026-03-10T19:30")));
  expect(text).not.toMatch(/echo|Clinic/);
});
