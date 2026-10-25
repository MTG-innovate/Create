import { describe, expect, it } from "vitest";
import {
  MOMENTS,
  ago,
  fmtAmount,
  fmtWeight,
  nightFeedTotal,
  parseMomentFields,
  summarizeDay,
  toUnit,
  type Moment,
} from "./moments";

const ctx = { name: "Josiah", unit: "oz" as const };
let n = 0;
const m = (type: Moment["type"], date: string, time: string | null, details: Record<string, unknown> = {}): Moment => ({
  id: `m${++n}`,
  child_id: "c1",
  type,
  date,
  time,
  details,
  note: null,
  created_by: null,
});

describe("night feed total", () => {
  it("multiplies the pump rate by the hours it ran", () => {
    expect(nightFeedTotal("22:00", "06:00", 30)).toBe(240);
    expect(nightFeedTotal("20:30", "23:00", 40)).toBe(100);
  });

  it("runs past midnight into the next morning", () => {
    expect(nightFeedTotal("23:45", "05:15", 25)).toBe(138); // 5.5 h × 25 = 137.5
  });

  it("treats the same start and end as a full night", () => {
    expect(nightFeedTotal("21:00", "21:00", 10)).toBe(240);
  });

  it("needs a start, an end and a rate", () => {
    expect(nightFeedTotal(null, "06:00", 30)).toBeNull();
    expect(nightFeedTotal("22:00", "", 30)).toBeNull();
    expect(nightFeedTotal("22:00", "06:00", 0)).toBeNull();
  });
});

describe("amounts and weights", () => {
  it("converts between ounces and milliliters", () => {
    expect(Math.round(toUnit(4, "oz", "ml"))).toBe(118);
    expect(toUnit(90, "ml", "oz")).toBeCloseTo(3.04, 2);
    expect(toUnit("3", undefined, "oz")).toBe(3);
  });

  it("shows amounts warmly rounded", () => {
    expect(fmtAmount(3.3, "oz")).toBe("3.5 oz");
    expect(fmtAmount(97.6, "ml")).toBe("98 ml");
  });

  it("shows weight in pounds and ounces", () => {
    expect(fmtWeight(16 * 9 + 4.25)).toBe("9 lb 4.3 oz");
    expect(fmtWeight(0)).toBe("");
  });

  it("says how long ago", () => {
    expect([ago(5), ago(125), ago(60 * 50), ago(-1)]).toEqual(["5 min ago", "2h 5m ago", "2d ago", ""]);
  });
});

describe("the day at a glance", () => {
  const day = "2026-03-10";

  it("adds up meals and that night's feed in the family's unit", () => {
    const list = [
      m("meal", day, "08:00", { amount: 3, unit: "oz" }),
      m("meal", day, "12:00", { amount: 90, unit: "ml" }),
      m("night_feed", day, "22:00", { total: 240, unit: "ml" }),
      m("meal", "2026-03-09", "20:00", { amount: 4, unit: "oz" }),
    ];
    const s = summarizeDay(list, day, "oz", null);
    expect(s.meals.count).toBe(2);
    expect(s.meals.total).toBeCloseTo(3 + 90 / 29.5735 + 240 / 29.5735, 3);
    expect(s.meals.fromNurse).toBe(false);
  });

  it("uses the nurse's total when nobody logged meals", () => {
    const s = summarizeDay([m("nurse_note", day, "15:00", { intake: 24, unit: "oz" })], day, "oz", null);
    expect(s.meals).toEqual({ total: 24, count: 0, fromNurse: true });
  });

  it("shows last night's feed in the morning", () => {
    const lastNight = m("night_feed", "2026-03-09", "21:30", { total: 200 });
    expect(summarizeDay([lastNight], day, "ml", null).nightFeed).toBe(lastNight);
    expect(summarizeDay([lastNight], "2026-03-11", "ml", null).nightFeed).toBeNull();
  });

  it("counts diapers, naps and playtime", () => {
    const list = [
      m("diaper", day, "07:00", { kind: "Wet" }),
      m("diaper", day, "09:00", { kind: "Both" }),
      m("diaper", day, "11:00", { kind: "Dirty" }),
      m("nap", day, "10:00", { hours: 1.5 }),
      m("nap", day, "14:00", { hours: 0.75 }),
      m("playtime", day, "16:00", { minutes: 10 }),
    ];
    const s = summarizeDay(list, day, "oz", null);
    expect(s.diapers).toEqual({ count: 3, wet: 2, dirty: 2 });
    expect(s.naps).toEqual({ count: 2, hours: 2.25 });
    expect(s.play).toEqual({ count: 1, minutes: 10 });
  });
});

describe("moment forms", () => {
  it("use the child's name, not pronouns", () => {
    const labels = Object.values(MOMENTS).flatMap((k) => k.fields(ctx).map((f) => `${f.label} ${f.placeholder ?? ""}`));
    expect(labels.join(" ")).not.toMatch(/\b(he|him|his|she|her)\b/i);
    expect(labels).toContain("How Josiah ate ");
  });

  it("keep only the fields a moment has, as numbers where they are numbers", () => {
    const r = parseMomentFields("meal", { amount: "3.5", unit: "oz", method: "Bottle", note: "Took it well", sneaky: "x" }, ctx);
    expect(r).toEqual({ details: { amount: 3.5, unit: "oz", method: "Bottle" }, note: "Took it well" });
  });

  it("leave out empty fields", () => {
    expect(parseMomentFields("diaper", { kind: "", note: "" }, ctx)).toEqual({ details: {}, note: null });
  });

  it("refuse impossible values", () => {
    expect(parseMomentFields("meal", { amount: "-2" }, ctx)).toHaveProperty("error");
    expect(parseMomentFields("diaper", { kind: "Purple" }, ctx)).toHaveProperty("error");
    expect(parseMomentFields("night_feed", { end: "25:99x" }, ctx)).toHaveProperty("error");
  });
});
