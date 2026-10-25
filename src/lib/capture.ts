import { z } from "zod";
import { VISIT_KINDS, type VisitKind } from "./visits";

// AI capture, from the prototype's CAPTURE, PROMPTS and applyCapture: a nurse
// text, a therapy handoff or a doctor visit summary goes in, and a draft comes
// out for a person to check and save. Nothing here writes anything.

export const CAPTURE_MODES = ["nurse", "therapy", "visit"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];
export const isCaptureMode = (v: unknown): v is CaptureMode => (CAPTURE_MODES as readonly string[]).includes(String(v));

export const THERAPY_KINDS = ["Physical therapy", "Occupational therapy", "Speech therapy"] as const satisfies readonly VisitKind[];
export const DOCTOR_KINDS = VISIT_KINDS.filter((k) => k !== "In-home nurse" && !(THERAPY_KINDS as readonly string[]).includes(k));

export const MAX_TEXT = 15000;
export const MAX_PHOTO_BYTES = 3.5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const CAPTURE: Record<
  CaptureMode,
  { title: string; label: string; placeholder: string; photo: string | null; kinds: readonly string[] | null; hint: (name: string) => string; area: "nurse_notes" | "visits" }
> = {
  nurse: {
    title: "Nurse text",
    label: "The nurse’s text",
    placeholder: "In Messages, press and hold the text, tap Copy, then paste it here",
    photo: "Or a screenshot of the text",
    kinds: null,
    hint: () => "Claude pulls out meals, diapers, vitals, practice and anything to keep an eye on. You check it before it saves.",
    area: "nurse_notes",
  },
  therapy: {
    title: "Therapy handoff",
    label: "What the therapist told you",
    placeholder: "Tap the microphone on your keyboard and say what they told you at pickup",
    photo: null,
    kinds: THERAPY_KINDS,
    hint: () => "Say it the way they said it. Claude separates what they worked on from what to practice at home.",
    area: "visits",
  },
  visit: {
    title: "Doctor visit summary",
    label: "Text copied from MyChart",
    placeholder: "Open the visit in MyChart, copy the After Visit Summary, paste it here",
    photo: "Or a photo of the summary sheet",
    kinds: DOCTOR_KINDS,
    hint: () => "Claude pulls out what happened, what to do at home, medicine changes and the next appointment.",
    area: "visits",
  },
};

const text = () => z.string().nullable();

export const SCHEMAS = {
  nurse: z.object({
    date: text().describe("YYYY-MM-DD"),
    time: text().describe("HH:MM, 24 hour"),
    nurse: text().describe("the nurse's name"),
    intake: z.number().nullable().describe("total amount the baby took in"),
    unit: z.enum(["oz", "ml"]).nullable(),
    feeds: text().describe("short summary of feedings: times, amounts, how the baby took them"),
    wet: z.number().nullable(),
    dirty: z.number().nullable(),
    vitals: text().describe("weight, temperature, oxygen and other vitals"),
    activity: text().describe("exercises, therapy or tummy time done"),
    concerns: text().describe("anything to watch, report or follow up on"),
  }),
  therapy: z.object({
    summary: text().describe("what they worked on and how the baby did, in 1 to 3 plain sentences"),
    homework: text().describe("what to practice at home and how often"),
    therapist: text().describe("the therapist's name"),
    next: text().describe("next session date as YYYY-MM-DD"),
  }),
  visit: z.object({
    kind: z.enum(DOCTOR_KINDS as [string, ...string[]]).nullable(),
    provider: text().describe("doctor or clinic name"),
    date: text().describe("YYYY-MM-DD of the visit"),
    title: text().describe("reason for the visit in a few words"),
    summary: text().describe("what happened: findings, measurements such as weight, results, in plain words"),
    homework: text().describe("instructions for home"),
    medChanges: text().describe("medicines started, stopped or changed, with doses"),
    next: z
      .object({ date: text().describe("YYYY-MM-DD"), time: text().describe("HH:MM, 24 hour"), what: text().describe("what the next appointment is for") })
      .nullable(),
  }),
} as const;

export type Extracted<M extends CaptureMode> = z.infer<(typeof SCHEMAS)[M]>;

/** What Claude is asked. It gets only what was pasted or photographed, nothing else about the family. */
export function capturePrompt(mode: CaptureMode, opts: { today: string; kind?: string; photo?: boolean; hasText?: boolean }): string {
  const lead = opts.photo ? `The update is in the attached photo${opts.hasText ? " and the text below" : ""}.\n` : "";
  const rules = `Use null for anything it does not say. Copy facts only. Do not add advice. Today is ${opts.today}.`;
  switch (mode) {
    case "nurse":
      return `${lead}A family is logging the daily update from a home health nurse caring for their baby. Pull out the date, time, nurse, total intake, feedings, diapers, vitals, practice and play, and anything to keep an eye on. ${rules}`;
    case "therapy":
      return `${lead}A family member picked up a baby from ${opts.kind || "a therapy session"} and is recording the therapist's spoken handoff. The words may be dictated, with run-on sentences or transcription mistakes. Separate what they worked on from what to practice at home. ${rules}`;
    case "visit":
      return `${lead}A family is recording a baby's After Visit Summary from a doctor's appointment. Pull out the type of visit, provider, date, findings, home instructions, medicine changes and the next appointment. ${opts.kind ? `The family says this was a ${opts.kind} visit. ` : ""}${rules}`;
  }
}

const okDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const okTime = (v: unknown) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? String(v) : "");
const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** A nurse note ready for the diary form: the date, the time and the note's own fields. */
export type NurseDraft = { date: string; time: string; details: Record<string, string> };

/** A visit ready for the visit form, and the next appointment to offer after it saves. */
export type VisitDraft = {
  kind: string;
  date: string;
  fields: Partial<Record<"title" | "provider" | "summary" | "homework", string>>;
  next: { kind: string; date: string; time: string; provider: string; title: string } | null;
};

export function nurseDraft(r: Extracted<"nurse">, raw: string, ctx: { today: string; now: string; unit: "oz" | "ml" }): NurseDraft {
  return {
    date: okDate(r.date) ?? ctx.today,
    time: okTime(r.time) ?? ctx.now,
    details: {
      nurse: str(r.nurse),
      intake: num(r.intake),
      unit: r.unit === "oz" || r.unit === "ml" ? r.unit : ctx.unit,
      feeds: str(r.feeds),
      wet: num(r.wet),
      dirty: num(r.dirty),
      vitals: str(r.vitals),
      activity: str(r.activity),
      concerns: str(r.concerns),
      text: raw,
    },
  };
}

export function therapyDraft(r: Extracted<"therapy">, kind: string, today: string): VisitDraft {
  const provider = str(r.therapist);
  const next = okDate(r.next);
  return {
    kind,
    date: today,
    fields: { title: `${kind} session`, provider, summary: str(r.summary), homework: str(r.homework) },
    next: next && next > today ? { kind, date: next, time: "", provider, title: `${kind} session` } : null,
  };
}

/** Medicine changes go into the visit notes for a person to act on. The medicine list is never touched. */
export function visitDraft(r: Extracted<"visit">, kind: string, today: string): VisitDraft {
  const k = r.kind && (DOCTOR_KINDS as readonly string[]).includes(r.kind) ? r.kind : kind || DOCTOR_KINDS[0];
  const provider = str(r.provider);
  const homework = [str(r.homework), r.medChanges ? `Medicine changes: ${str(r.medChanges)}` : ""].filter(Boolean).join("\n");
  const nextDate = okDate(r.next?.date);
  return {
    kind: k,
    date: okDate(r.date) ?? today,
    fields: { title: str(r.title), provider, summary: str(r.summary), homework },
    next:
      nextDate && nextDate > today
        ? { kind: k, date: nextDate, time: okTime(r.next?.time) ?? "", provider, title: str(r.next?.what) || `${k} follow up` }
        : null,
  };
}

/** The draft when someone chooses "Type it in myself": their words, in the right box. */
export function typedDraft(mode: CaptureMode, raw: string, kind: string, ctx: { today: string; now: string; unit: "oz" | "ml" }) {
  if (mode === "nurse") return { date: ctx.today, time: ctx.now, details: { unit: ctx.unit, text: raw } } satisfies NurseDraft;
  const k = kind || (mode === "therapy" ? THERAPY_KINDS[0] : DOCTOR_KINDS[0]);
  return { kind: k, date: ctx.today, fields: { summary: raw, ...(mode === "therapy" ? { title: `${k} session` } : {}) }, next: null } satisfies VisitDraft;
}
