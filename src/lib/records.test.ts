import { describe, expect, it } from "vitest";
import { parseRecord } from "./records";

describe("records", () => {
  it("save a helper with empty fields left empty", () => {
    expect(parseRecord("team", { name: " Dr. Example ", role: "Pediatrician", phone: "", notes: "" })).toEqual({
      row: { name: "Dr. Example", role: "Pediatrician", phone: null, notes: null },
    });
  });

  it("need the required field", () => {
    expect(parseRecord("medicines", { name: "  " })).toEqual({ error: "Please fill in medicine." });
  });

  it("read the 'Still doing this' checkbox, which browsers leave out when unticked", () => {
    const on = parseRecord("practice", { instruction: "Tummy time", active: "on", frequency: "Every day", since: "2026-03-01" });
    const off = parseRecord("practice", { instruction: "Tummy time", frequency: "", since: "" });
    expect(on).toEqual({ row: { instruction: "Tummy time", provider: null, frequency: "Every day", since: "2026-03-01", active: true } });
    expect(off).toEqual({ row: { instruction: "Tummy time", provider: null, frequency: null, since: null, active: false } });
  });

  it("refuse values that are not on the list", () => {
    expect(parseRecord("practice", { instruction: "x", frequency: "Hourly" })).toHaveProperty("error");
    expect(parseRecord("practice", { instruction: "x", since: "2026-02-30" })).toHaveProperty("error");
  });
});
