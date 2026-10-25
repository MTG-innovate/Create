import { describe, expect, it } from "vitest";
import { ALL_GENTLE_WORDS, SCRIPTURE, encouragement, selfCareToday } from "./daily-words";

describe("daily words", () => {
  it("change once a day and repeat each week", () => {
    const a = encouragement("gentle", "2026-03-10", "Josiah");
    expect(encouragement("gentle", "2026-03-10", "Josiah")).toEqual(a);
    expect(encouragement("gentle", "2026-03-11", "Josiah")).not.toEqual(a);
    expect(encouragement("gentle", "2026-03-17", "Josiah")).toEqual(a);
  });

  it("give scripture with its reference when the family chose it", () => {
    const s = encouragement("scripture", "2026-03-10", "Josiah");
    expect(s.reference).toBeTruthy();
    expect(SCRIPTURE.map(([t]) => t)).toContain(s.text);
  });

  it("capitalize divine pronouns in scripture", () => {
    const all = SCRIPTURE.map(([t]) => t).join(" ");
    expect(all).toContain("Thee");
    expect(all).toContain("upon Him; for He careth");
    expect(all).not.toMatch(/\b(thee|him|he|his)\b/); // lowercase would mean an uncapitalized divine pronoun
  });

  it("use the child's name, not pronouns", () => {
    const words = ALL_GENTLE_WORDS("Josiah").join(" ");
    expect(words).toContain("Josiah");
    expect(words).not.toMatch(/\b(he|him|his|she|her)\b/i);
    expect(selfCareToday("2026-03-10", "Josiah")).toBeTruthy();
  });
});
