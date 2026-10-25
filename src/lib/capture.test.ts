import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { capturePrompt, nurseDraft, therapyDraft, typedDraft, visitDraft, DOCTOR_KINDS, SCHEMAS } from "./capture";

const today = "2026-10-25";
const ctx = { today, now: "14:05", unit: "oz" as const };

describe("nurse text", () => {
  it("fills the nurse note's fields and keeps the whole text", () => {
    const d = nurseDraft(
      { date: "2026-10-24", time: "9:30", nurse: " Pat ", intake: 22.5, unit: "ml", feeds: "4 bottles", wet: 6, dirty: 2, vitals: "98.6", activity: "Tummy time", concerns: "Cough after naps" },
      "the whole text",
      ctx,
    );
    expect(d).toEqual({
      date: "2026-10-24",
      time: "09:30",
      details: { nurse: "Pat", intake: "22.5", unit: "ml", feeds: "4 bottles", wet: "6", dirty: "2", vitals: "98.6", activity: "Tummy time", concerns: "Cough after naps", text: "the whole text" },
    });
  });

  it("falls back to today, now and the family's unit when the text does not say", () => {
    const d = nurseDraft(
      { date: "yesterday", time: null, nurse: null, intake: -3, unit: null, feeds: null, wet: null, dirty: null, vitals: null, activity: null, concerns: null },
      "x",
      ctx,
    );
    expect(d.date).toBe(today);
    expect(d.time).toBe("14:05");
    expect(d.details.unit).toBe("oz");
    expect(d.details.intake).toBe("");
  });
});

describe("therapy handoff", () => {
  it("separates what they worked on from practice at home, and offers the next session", () => {
    const d = therapyDraft({ summary: "Rolled both ways", homework: "Tummy time twice a day", therapist: "Ms. Lee", next: "2026-11-01" }, "Physical therapy", today);
    expect(d.kind).toBe("Physical therapy");
    expect(d.date).toBe(today);
    expect(d.fields).toEqual({ title: "Physical therapy session", provider: "Ms. Lee", summary: "Rolled both ways", homework: "Tummy time twice a day" });
    expect(d.next).toEqual({ kind: "Physical therapy", date: "2026-11-01", time: "", provider: "Ms. Lee", title: "Physical therapy session" });
  });

  it("does not offer a next session in the past", () => {
    expect(therapyDraft({ summary: null, homework: null, therapist: null, next: "2026-10-01" }, "Speech therapy", today).next).toBeNull();
  });
});

describe("doctor visit", () => {
  const base = { kind: "Cardiology", provider: "Dr. Example", date: "2026-10-23", title: "Heart check", summary: "Murmur quieter", homework: "Keep feeds the same", medChanges: null, next: null };

  it("puts medicine changes in the visit notes, never anywhere else", () => {
    const d = visitDraft({ ...base, medChanges: "Furosemide up to 1.2 ml" }, "", today);
    expect(d.fields.homework).toBe("Keep feeds the same\nMedicine changes: Furosemide up to 1.2 ml");
    expect(Object.keys(d)).not.toContain("medicines");
  });

  it("trusts the family's choice of visit when Claude's is not a doctor visit", () => {
    expect(visitDraft({ ...base, kind: "In-home nurse" }, "GI", today).kind).toBe("GI");
    expect(visitDraft({ ...base, kind: null }, "", today).kind).toBe(DOCTOR_KINDS[0]);
  });

  it("offers the next appointment it mentions", () => {
    const d = visitDraft({ ...base, next: { date: "2026-12-01", time: "9:15", what: null } }, "", today);
    expect(d.next).toEqual({ kind: "Cardiology", date: "2026-12-01", time: "09:15", provider: "Dr. Example", title: "Cardiology follow up" });
  });
});

it("Type it in myself puts their words in the right box", () => {
  expect(typedDraft("nurse", "hello", "", ctx)).toEqual({ date: today, time: "14:05", details: { unit: "oz", text: "hello" } });
  expect(typedDraft("therapy", "hello", "", ctx)).toMatchObject({ kind: "Physical therapy", fields: { summary: "hello", title: "Physical therapy session" } });
  expect(typedDraft("visit", "hello", "GI", ctx)).toMatchObject({ kind: "GI", fields: { summary: "hello" } });
});

it("asks only for facts, and tells Claude today's date and the visit the family chose", () => {
  const p = capturePrompt("visit", { today, kind: "GI", photo: true, hasText: false });
  expect(p).toContain("Do not add advice");
  expect(p).toContain(`Today is ${today}`);
  expect(p).toContain("this was a GI visit");
  expect(p.startsWith("The update is in the attached photo.")).toBe(true);
});

it("every field Claude returns can be left empty", () => {
  for (const schema of Object.values(SCHEMAS)) {
    for (const [key, field] of Object.entries(schema.shape)) expect(field.safeParse(null).success, key).toBe(true);
  }
});

it("the capture step only drafts: it never writes to the database or touches medicines", () => {
  for (const file of ["src/app/f/[familyId]/capture/actions.ts", "src/lib/claude.ts", "src/lib/capture.ts"]) {
    const source = readFileSync(file, "utf8");
    expect(source, file).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    expect(source, file).not.toMatch(/from\(["']medicines["']\)/);
  }
  // The Claude API is called only from server code.
  expect(readFileSync("src/lib/claude.ts", "utf8")).toMatch(/^import "server-only";/);
});
