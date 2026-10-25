import { z } from "zod";
import type { CareArea } from "./access";
import { isDay } from "./dates";

// The care team, practice at home, the medicine list and questions to ask,
// from the prototype's CFG.team, CFG.plan, CFG.meds and CFG.questions: one
// definition drives each form and the checks on save.

export const RECORD_KINDS = ["team", "practice", "medicines", "questions"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const FREQUENCIES = ["Every day", "Several times a day", "A few times a week", "Weekly", "As needed"] as const;
export const TEAM_ROLES = [
  "Pediatrician",
  "Cardiologist",
  "Pulmonologist",
  "GI doctor",
  "Ophthalmologist",
  "Physical therapist",
  "Occupational therapist",
  "Speech therapist",
  "Home health nurse",
  "Nurse case manager",
  "Pharmacy",
  "Developmental clinic",
];

export type RecordField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "tel" | "select" | "date" | "checkbox";
  required?: boolean;
  half?: boolean;
  placeholder?: string;
  options?: readonly string[];
  suggest?: "team" | "roles";
  /** "today" for the family's today. */
  initial?: string | boolean;
};

export const RECORDS: Record<
  RecordKind,
  { table: string; area: CareArea; title: string; perChild: boolean; fields: (name: string) => RecordField[] }
> = {
  team: {
    table: "team_contacts",
    area: "team",
    title: "Helper",
    perChild: false,
    fields: () => [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "role", label: "Role", kind: "text", suggest: "roles" },
      { key: "phone", label: "Phone", kind: "tel" },
      { key: "notes", label: "Notes", kind: "textarea", placeholder: "Office hours, after hours line, portal" },
    ],
  },
  practice: {
    table: "practice_items",
    area: "practice",
    title: "Practice at home",
    perChild: true,
    fields: () => [
      { key: "instruction", label: "What to practice", kind: "textarea", required: true, placeholder: "Tummy time 3 times a day, 5 minutes each" },
      { key: "provider", label: "Who asked for it", kind: "text", suggest: "team", half: true },
      { key: "frequency", label: "How often", kind: "select", options: FREQUENCIES, half: true },
      { key: "since", label: "Started", kind: "date", half: true, initial: "today" },
      { key: "active", label: "Still doing this", kind: "checkbox", initial: true },
    ],
  },
  medicines: {
    table: "medicines",
    area: "medicines",
    title: "Medicine",
    perChild: true,
    fields: () => [
      { key: "name", label: "Medicine", kind: "text", required: true },
      { key: "dose", label: "Dose", kind: "text", half: true },
      { key: "when_to_give", label: "When to give", kind: "text", half: true, placeholder: "8 AM and 8 PM" },
      { key: "prescriber", label: "Prescribed by", kind: "text", suggest: "team" },
      { key: "pharmacy", label: "Pharmacy", kind: "text" },
      { key: "notes", label: "Notes", kind: "textarea", placeholder: "How to measure, side effects to watch" },
    ],
  },
  questions: {
    table: "questions",
    area: "questions",
    title: "Question",
    perChild: true,
    fields: () => [
      { key: "text", label: "Question", kind: "textarea", required: true },
      { key: "for_whom", label: "For", kind: "text", suggest: "team", placeholder: "Who to ask, or leave empty for anyone" },
      { key: "done", label: "Asked and answered", kind: "checkbox", initial: false },
      { key: "answer", label: "What they said", kind: "textarea" },
    ],
  },
};

export const isRecordKind = (v: unknown): v is RecordKind => (RECORD_KINDS as readonly string[]).includes(String(v));

/** Checks submitted form values for one kind of record and returns the columns to save. */
export function parseRecord(kind: RecordKind, values: Record<string, unknown>) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of RECORDS[kind].fields("")) {
    if (f.kind === "checkbox") {
      shape[f.key] = z.preprocess((v) => v === "on" || v === true, z.boolean());
    } else if (f.kind === "select") {
      shape[f.key] = z.preprocess((v) => v || null, z.enum(f.options as [string, ...string[]]).nullable());
    } else if (f.kind === "date") {
      shape[f.key] = z.preprocess((v) => v || null, z.string().refine(isDay, `Please check ${f.label.toLowerCase()}.`).nullable());
    } else {
      const text = z.string().trim().max(f.kind === "textarea" ? 4000 : 300);
      shape[f.key] = f.required
        ? text.min(1, `Please fill in ${f.label.toLowerCase()}.`)
        : z.preprocess((v) => (typeof v === "string" && v.trim() ? v : null), text.nullable());
    }
  }
  const parsed = z.object(shape).safeParse(values);
  return parsed.success ? ({ row: parsed.data as Record<string, unknown> } as const) : ({ error: parsed.error.issues[0].message } as const);
}
