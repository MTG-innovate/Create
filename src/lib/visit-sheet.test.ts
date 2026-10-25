import { describe, expect, it } from "vitest";
import type { Moment } from "./moments";
import { buildVisitSheet, sheetAsText, type SheetInput } from "./visit-sheet";

let n = 0;
const m = (type: Moment["type"], date: string, details: Record<string, unknown>, note: string | null = null, time = "10:00"): Moment => ({
  id: `m${++n}`,
  child_id: "c1",
  type,
  date,
  time,
  details,
  note,
  created_by: null,
});

const base: SheetInput = {
  childName: "Josiah",
  visit: { kind: "Cardiology", title: "Heart check", provider: "Dr. Example", date: "2026-03-12", time: "09:30:00" },
  today: "2026-03-10",
  unit: "oz",
  medicines: [{ name: "Iron drops", dose: "0.5 ml", when_to_give: "8 AM" }],
  moments: [
    m("weigh_in", "2025-12-01", { lb: 5, oz: 0 }), // older than 60 days: left out
    m("weigh_in", "2026-02-20", { lb: 8, oz: 2 }, "Pediatrician"),
    m("weigh_in", "2026-03-05", { lb: 8, oz: 10 }),
    m("meal", "2026-03-09", { amount: 3, unit: "oz" }),
    m("meal", "2026-03-09", { amount: 4, unit: "oz" }),
    m("night_feed", "2026-03-08", { total: 240, unit: "ml", rate: 30, end: "06:00", went: "Went well" }, null, "22:00"),
    m("nurse_note", "2026-03-07", { concerns: "A little congested after naps" }),
    m("nurse_note", "2026-02-01", { concerns: "Too old to include" }),
  ],
  notes: [
    { kind: "Physical therapy", provider: "Ms. Rivera", date: "2026-03-06", summary: "Rolled over", homework: "Tummy time" },
    { kind: "Physical therapy", provider: "Ms. Rivera", date: "2026-02-27", summary: "Older PT note", homework: null },
    { kind: "Cardiology", provider: "Dr. Example", date: "2026-01-15", summary: "Murmur softer", homework: "Recheck in 8 weeks" },
    { kind: "GI", provider: null, date: "2026-03-20", summary: "In the future", homework: null },
  ],
  practice: [{ instruction: "Tummy time, 5 minutes", provider: "Physical therapy" }],
  questions: [
    { text: "Can we stop the iron?", for_whom: "Dr. Example" },
    { text: "Is the cough normal?", for_whom: null },
    { text: "When can we try a sippy cup?", for_whom: "Speech" },
  ],
};

const section = (sheet: ReturnType<typeof buildVisitSheet>, starts: string) => sheet.sections.find((s) => s.title.startsWith(starts))?.items;

describe("the visit sheet", () => {
  const sheet = buildVisitSheet(base);

  it("names the child, the visit, the day, the time and who it is with", () => {
    expect(sheet.title).toBe("Josiah: Heart check");
    expect(sheet.sub).toBe("Thursday, March 12 · 9:30 AM · Dr. Example");
  });

  it("lists current medicines and the last 60 days of weight", () => {
    expect(section(sheet, "Current medicines")).toEqual(["Iron drops, 0.5 ml, 8 AM"]);
    expect(section(sheet, "Weight")).toEqual(["Feb 20: 8 lb 2 oz (Pediatrician)", "Mar 5: 8 lb 10 oz"]);
  });

  it("shows each of the last 7 days of meals, saying when a day was not logged", () => {
    const meals = section(sheet, "Meals")!;
    expect(meals).toHaveLength(7);
    expect(meals[0]).toBe("Tue, Mar 3: not logged");
    expect(meals[6]).toBe("Mon, Mar 9: 7 oz");
    expect(meals[5]).toMatch(/^Sun, Mar 8: 8 oz$/); // 240 ml night feed, in ounces
  });

  it("includes night feeds and the nurse's recent 'keep an eye on' notes", () => {
    expect(section(sheet, "Night feeds")).toEqual(["Mar 8: 240 ml · 10:00 PM to 6:00 AM · 30 ml/hr · Went well"]);
    expect(section(sheet, "Keep an eye on")).toEqual(["Mar 7: A little congested after naps"]);
  });

  it("gives the latest note from each other helper, and the last visit of this kind", () => {
    expect(section(sheet, "What Josiah's other helpers said")).toEqual(["Physical therapy (Ms. Rivera), Mar 6: Rolled over At home: Tummy time"]);
    expect(section(sheet, "Last Cardiology visit, Jan 15")).toEqual(["Murmur softer At home: Recheck in 8 weeks"]);
  });

  it("includes the home practice plan and the questions meant for this visit", () => {
    expect(section(sheet, "Practice at home")).toEqual(["Tummy time, 5 minutes (Physical therapy)"]);
    expect(section(sheet, "Our questions")).toEqual(["Can we stop the iron?", "Is the cough normal?"]);
  });

  it("says so calmly when there is nothing to share", () => {
    const empty = buildVisitSheet({ ...base, medicines: [], moments: [], notes: [], practice: [], questions: [] });
    expect(section(empty, "Current medicines")).toEqual(["None listed"]);
    expect(section(empty, "Weight")).toEqual(["No weigh ins logged"]);
    expect(section(empty, "Our questions")).toEqual(["None yet. Add them on Home."]);
    expect(empty.sections.some((s) => s.title.startsWith("Last Cardiology"))).toBe(false);
  });

  it("copies as plain text with headings and bullets", () => {
    const text = sheetAsText(sheet);
    expect(text.split("\n").slice(0, 4)).toEqual(["Josiah: Heart check", "Thursday, March 12 · 9:30 AM · Dr. Example", "", "CURRENT MEDICINES"]);
    expect(text).toContain("• Iron drops, 0.5 ml, 8 AM");
    expect(text.endsWith("• Is the cough normal?")).toBe(true);
  });
});
