import { describe, expect, it } from "vitest";
import { CARE_AREAS, HELPER_PRESETS, canEdit, canView, normalizeAreas, type CareArea } from "./access";

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

describe("canView and canEdit", () => {
  const nurse = { role: "helper" as const, view_areas: ["visits", "diary"] as CareArea[], edit_areas: ["diary"] as CareArea[] };
  it("follow the helper's areas", () => {
    expect([canView(nurse, "visits"), canEdit(nurse, "visits"), canEdit(nurse, "diary"), canView(nurse, "wins")]).toEqual([true, false, true, false]);
  });
  it("let viewers see but not change, and family do both", () => {
    const viewer = { role: "viewer" as const, view_areas: [], edit_areas: [] };
    const family = { role: "family" as const, view_areas: [], edit_areas: [] };
    expect([canView(viewer, "medicines"), canEdit(viewer, "medicines"), canEdit(family, "medicines")]).toEqual([true, false, true]);
  });
});
