import { describe, expect, it } from "vitest";
import { CARE_AREAS, HELPER_PRESETS, normalizeAreas } from "./access";

describe("helper presets", () => {
  it.each(HELPER_PRESETS)("$label only edits what it can see", (preset) => {
    expect(preset.edit.every((a) => preset.view.includes(a))).toBe(true);
    expect(preset.view.every((a) => (CARE_AREAS as readonly string[]).includes(a))).toBe(true);
  });
});

describe("normalizeAreas", () => {
  it("adds edit areas to view areas and drops unknown ones", () => {
    expect(normalizeAreas(["visits", "nonsense"], ["diary"])).toEqual({ view: ["visits", "diary"], edit: ["diary"] });
  });
});
