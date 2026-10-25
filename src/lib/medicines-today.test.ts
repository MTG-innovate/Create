import { expect, it } from "vitest";
import { dosesToday } from "./medicines-today";

const iron = { id: "iron", child_id: "j", name: "Iron drops", dose: "0.5 ml", times: ["20:00:00", "08:00:00"] };
const vitd = { id: "vitd", child_id: "j", name: "Vitamin D", dose: "1 ml", times: ["08:00:00"] };

it("lists every dose for today in time order", () => {
  const rows = dosesToday([iron, vitd], [], 7 * 60);
  expect(rows.map((r) => `${r.label} ${r.name}`)).toEqual(["8:00 AM Iron drops", "8:00 AM Vitamin D", "8:00 PM Iron drops"]);
  expect(rows.every((r) => !r.given && !r.waiting)).toBe(true);
});

it("shows who gave a dose, and which ones are still waiting once their time has passed", () => {
  const rows = dosesToday([iron, vitd], [{ id: "m1", medicine_id: "iron", slot: "08:00", time: "08:05:00", created_by: "grandma" }], 9 * 60);
  expect(rows[0]).toMatchObject({ name: "Iron drops", given: { momentId: "m1", at: "8:05 AM", by: "grandma" }, waiting: false });
  expect(rows[1]).toMatchObject({ name: "Vitamin D", given: null, waiting: true });
  expect(rows[2]).toMatchObject({ label: "8:00 PM", given: null, waiting: false });
});

it("leaves out medicines with no times", () => {
  expect(dosesToday([{ ...iron, times: [] }], [], 0)).toEqual([]);
});
