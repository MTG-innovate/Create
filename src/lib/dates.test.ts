import { describe, expect, it } from "vitest";
import { ageText, greeting, hourIn } from "./dates";

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
