import { describe, expect, it } from "vitest";
import { addDays, ageText, dayLabel, daysBetween, fmtTime, greeting, hourIn, isDay, minutesSince, todayIn } from "./dates";

describe("ageText", () => {
  const on = (s: string) => new Date(`${s}T12:00:00`);
  it.each([
    ["2026-01-15", "2026-01-15", "0 months old"],
    ["2026-01-15", "2026-02-14", "0 months old"],
    ["2026-01-15", "2026-02-15", "1 month old"],
    ["2025-01-31", "2026-03-31", "1 year, 2 months old"],
    ["2024-06-01", "2026-06-01", "2 years old"],
  ])("born %s, on %s: %s", (born, today, text) => {
    expect(ageText(born, on(today))).toBe(text);
  });

  it("is empty without a birth date or before birth", () => {
    expect(ageText(null)).toBe("");
    expect(ageText("2030-01-01", on("2026-01-01"))).toBe("");
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect([greeting(6), greeting(13), greeting(20)]).toEqual(["Good morning", "Good afternoon", "Good evening"]);
  });
});

describe("hourIn", () => {
  it("uses the family's time zone, not the server's", () => {
    const noonUtc = new Date("2026-07-01T12:00:00Z");
    expect(hourIn("UTC", noonUtc)).toBe(12);
    expect(hourIn("America/New_York", noonUtc)).toBe(8);
  });
});

describe("calendar days", () => {
  it("knows today in the family's time zone", () => {
    const lateEvening = new Date("2026-07-02T02:30:00Z");
    expect(todayIn("America/New_York", lateEvening)).toBe("2026-07-01");
    expect(todayIn("UTC", lateEvening)).toBe("2026-07-02");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-03-01", "2026-03-15")).toBe(14);
  });

  it("checks for real dates", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("tomorrow")).toBe(false);
  });

  it("formats times and day names warmly", () => {
    expect(fmtTime("14:30:00")).toBe("2:30 PM");
    expect(fmtTime("00:05")).toBe("12:05 AM");
    expect(fmtTime(null)).toBe("");
    expect(dayLabel("2026-03-10", "2026-03-10")).toBe("Today");
    expect(dayLabel("2026-03-11", "2026-03-10")).toBe("Tomorrow");
    expect(dayLabel("2026-03-12", "2026-03-10")).toBe("Thursday, March 12");
  });
});

describe("minutesSince", () => {
  it("counts in the family's time zone, across midnight", () => {
    const now = new Date("2026-07-02T04:30:00Z"); // 12:30 AM on July 2 in New York
    expect(minutesSince("2026-07-01", "23:45:00", "America/New_York", now)).toBe(45);
    expect(minutesSince("2026-07-02", "00:10", "America/New_York", now)).toBe(20);
    expect(minutesSince("2026-07-02", null, "America/New_York", now)).toBeNull();
  });
});
