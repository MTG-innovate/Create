import { describe, expect, it } from "vitest";
import { capturePrompt } from "./capture";
import { CARE_JOURNEYS, LITTLE_STEPS, journeyConfig, visitKindsFor, type JourneyConfig } from "./journeys";
import { buildVisitSheet, type SheetInput } from "./visit-sheet";
import { VISIT_KINDS } from "./visits";

// Little Steps must keep doing exactly what the app did before journeys
// existed. These are the lists that used to be written into each screen.

describe("Little Steps is unchanged", () => {
  it("keeps the same Home and diary tiles, + menu and visit types", () => {
    expect(LITTLE_STEPS.dayTiles).toEqual(["meals", "night_feed", "last_meal", "diapers", "naps", "playtime"]);
    expect(LITTLE_STEPS.dayMoments).toEqual(["meal", "night_feed", "diaper", "nap", "playtime", "medicine_given", "weigh_in", "note"]);
    expect(LITTLE_STEPS.visitKinds).toEqual(VISIT_KINDS);
    expect(LITTLE_STEPS.visitSheet).toEqual({ weight: true, meals: true, nightFeeds: true });
  });

  it("asks Claude the same questions, word for word", () => {
    const today = "2026-10-27";
    expect(capturePrompt("nurse", { today })).toContain("daily update from a home health nurse caring for their baby.");
    expect(capturePrompt("therapy", { today, kind: "Physical therapy" })).toContain("A family member picked up a baby from Physical therapy");
    expect(capturePrompt("visit", { today })).toContain("A family is recording a baby's After Visit Summary");
    for (const mode of ["nurse", "therapy", "visit"] as const) {
      expect(capturePrompt(mode, { today, person: LITTLE_STEPS.aiPerson })).toBe(capturePrompt(mode, { today }));
    }
  });

  it("is what everyone gets until the other journeys are built", () => {
    for (const j of [...CARE_JOURNEYS, null, undefined]) expect(journeyConfig(j)).toBe(LITTLE_STEPS);
  });

  it("offers every visit type", () => {
    expect(visitKindsFor(["little_steps"])).toEqual([...VISIT_KINDS]);
    expect(visitKindsFor([])).toEqual([]);
  });
});

describe("a journey decides the visit sheet", () => {
  const input: SheetInput = {
    childName: "Josiah",
    visit: { kind: "Cardiology", title: null, provider: null, date: "2026-10-28", time: null },
    today: "2026-10-27",
    unit: "oz",
    medicines: [],
    moments: [],
    notes: [],
    practice: [],
    questions: [],
  };
  const titles = (journey?: JourneyConfig) => buildVisitSheet({ ...input, journey }).sections.map((s) => s.title);

  it("Little Steps keeps weight, meals and night feeds", () => {
    expect(titles(LITTLE_STEPS)).toEqual(titles(undefined));
    expect(titles(LITTLE_STEPS)).toEqual(
      expect.arrayContaining(["Weight, last 60 days", "Meals, last 7 days (including night feeds)", "Night feeds, last 7 nights"]),
    );
  });

  it("a journey without feeding leaves those sections out", () => {
    const adult = { ...LITTLE_STEPS, visitSheet: { weight: false, meals: false, nightFeeds: false } };
    expect(titles(adult)).not.toEqual(expect.arrayContaining(["Night feeds, last 7 nights"]));
    expect(titles(adult)[0]).toBe("Current medicines");
    expect(titles(adult)).toContain("Our questions");
  });
});
