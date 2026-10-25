import { expect, it } from "vitest";
import { RECORDS, RECORD_KINDS, parseRecord } from "./records";
import { reorderStatus } from "./supplies";

it("says when to reorder, and gets gently louder in the last week", () => {
  expect(reorderStatus("2026-10-01", 30, "2026-10-20")).toEqual({ due: "2026-10-31", soon: false, text: "Next order Oct 31" });
  expect(reorderStatus("2026-10-01", 30, "2026-10-25")).toEqual({ due: "2026-10-31", soon: true, text: "Reorder by Sat, Oct 31" });
  expect(reorderStatus("2026-10-01", 30, "2026-11-02")).toMatchObject({ soon: true, text: "Time to reorder" });
  expect(reorderStatus(null, 30, "2026-10-25")).toBeNull();
  expect(reorderStatus("2026-10-01", null, "2026-10-25")).toBeNull();
});

it("checks a supply before saving", () => {
  expect(parseRecord("supplies", { name: "Pump bags", category: "Supply", reorder_days: "30", active: "on" })).toEqual({
    row: expect.objectContaining({ name: "Pump bags", category: "Supply", reorder_days: 30, active: true, last_ordered: null }),
  });
  expect(parseRecord("supplies", { name: "Pump bags", category: "", reorder_days: "" })).toEqual({ error: "Please choose type." });
  expect(parseRecord("supplies", { name: "Pump bags", category: "Supply", reorder_days: "45" })).toEqual({ error: "Please choose how often." });
});

it("keeps medicine times in order, without repeats", () => {
  expect(parseRecord("medicines", { name: "Iron", times: ["20:00", "08:00", "", "08:00"] })).toEqual({ row: expect.objectContaining({ times: ["08:00", "20:00"] }) });
});

it("no record field shares a name with the form's own fields", () => {
  const reserved = ["familyId", "kind", "id", "childId", "next"];
  for (const kind of RECORD_KINDS) for (const f of RECORDS[kind].fields("Josiah")) expect(reserved).not.toContain(f.key);
});
