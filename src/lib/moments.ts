import { z } from "zod";
import type { CareArea } from "./access";
import { addDays, fmtTime } from "./dates";

// Diary moments, ported from the prototype's LOG config: the same kinds,
// fields, words and one-line summaries. Words use the child's name, not "he".

export const MOMENT_TYPES = [
  "meal",
  "night_feed",
  "diaper",
  "nap",
  "playtime",
  "medicine_given",
  "weigh_in",
  "nurse_note",
  "note",
  "pumping",
] as const;
export type MomentType = (typeof MOMENT_TYPES)[number];

export type Unit = "oz" | "ml";

export type Moment = {
  id: string;
  child_id: string;
  type: MomentType;
  date: string;
  time: string | null;
  details: Record<string, unknown>;
  note: string | null;
  created_by: string | null;
};

type Option = string | readonly [value: string, label: string];

export type Field = {
  key: string;
  label: string;
  kind: "number" | "select" | "textarea" | "time" | "text";
  options?: readonly Option[];
  step?: string;
  half?: boolean;
  placeholder?: string;
  rows?: number;
  /** Default value, e.g. the family's feeding unit. */
  initial?: string;
  /** Suggestions from the family's own lists. */
  suggest?: "practice" | "medicines" | "team";
  max?: number;
};

type Ctx = { name: string; unit: Unit };

const note = (label = "Notes", placeholder?: string): Field => ({ key: "note", label, kind: "text", placeholder });
const unitField = (initial: Unit): Field => ({ key: "unit", label: "Unit", kind: "select", options: ["oz", "ml"], half: true, initial });

export const MOMENTS: Record<
  MomentType,
  { label: string; color: string; area: CareArea; fields: (c: Ctx) => Field[]; line: (m: Moment) => string }
> = {
  meal: {
    label: "Meal",
    color: "--feed",
    area: "diary",
    fields: (c) => [
      { key: "amount", label: "Amount", kind: "number", step: "0.5", half: true, max: 2000 },
      unitField(c.unit),
      { key: "method", label: `How ${c.name} ate`, kind: "select", options: ["Bottle", "Tube, bolus", "Tube, pump", "Bottle, then tube", "Breast", "Other"] },
      { ...note(), kind: "textarea", placeholder: "Spit up, fussy, took it well" },
    ],
    line: (m) => join(amountText(m.details.amount, m.details.unit), m.details.method),
  },
  night_feed: {
    label: "Night feed",
    color: "--sleep",
    area: "diary",
    fields: () => [
      { key: "end", label: "Ended", kind: "time", half: true },
      { key: "rate", label: "Pump rate, ml per hour", kind: "number", half: true, max: 500 },
      { key: "total", label: "Total given", kind: "number", half: true, max: 3000 },
      { key: "unit", label: "Unit", kind: "select", options: ["ml", "oz"], half: true, initial: "ml" },
      { key: "formula", label: "Formula or milk", kind: "text", placeholder: "Breast milk, formula name, calories" },
      {
        key: "went",
        label: "How the night went",
        kind: "select",
        options: ["Went well", "Some spit up", "Vomited", "Pump alarm or stopped", "Tube came out", "Other"],
      },
      { ...note(), kind: "textarea", placeholder: "Flushes, venting, anything for the morning" },
    ],
    line: (m) =>
      join(
        amountText(m.details.total, m.details.unit ?? "ml"),
        m.time && m.details.end ? `${fmtTime(m.time)} to ${fmtTime(String(m.details.end))}` : "",
        m.details.rate ? `${m.details.rate} ml/hr` : "",
        m.details.went,
      ),
  },
  diaper: {
    label: "Diaper",
    color: "--diaper",
    area: "diary",
    fields: () => [{ key: "kind", label: "Type", kind: "select", options: ["Wet", "Dirty", "Both"] }, note()],
    line: (m) => join(m.details.kind),
  },
  nap: {
    label: "Nap",
    color: "--sleep",
    area: "diary",
    fields: () => [{ key: "hours", label: "How long, in hours", kind: "number", step: "0.25", max: 24 }, note()],
    line: (m) => (m.details.hours ? `${m.details.hours} h` : ""),
  },
  playtime: {
    label: "Playtime",
    color: "--exercise",
    area: "diary",
    fields: (c) => [
      { key: "what", label: "What you practiced or played", kind: "text", suggest: "practice", placeholder: "Tummy time, reaching for toys" },
      { key: "minutes", label: "Minutes", kind: "number", max: 1440 },
      { ...note(`How ${c.name} did`), kind: "textarea" },
    ],
    line: (m) => join(m.details.what, m.details.minutes ? `${m.details.minutes} min` : ""),
  },
  pumping: {
    label: "Pumping",
    color: "--feed",
    area: "diary",
    fields: (c) => [
      { key: "amount", label: "Amount pumped", kind: "number", step: "0.25", half: true, max: 2000 },
      unitField(c.unit),
      { key: "side", label: "Side", kind: "select", options: ["Both", "Left", "Right"], half: true },
      { key: "minutes", label: "Minutes", kind: "number", half: true, max: 240 },
      { ...note("Notes", "Every drop counts. Anything to remember for next time"), kind: "textarea" },
    ],
    line: (m) => join(amountText(m.details.amount, m.details.unit), m.details.side, m.details.minutes ? `${m.details.minutes} min` : ""),
  },
  medicine_given: {
    label: "Medicine",
    color: "--med",
    area: "diary",
    fields: () => [
      { key: "name", label: "Medicine", kind: "text", suggest: "medicines" },
      { key: "dose", label: "Dose given", kind: "text" },
      note(),
    ],
    line: (m) => join(m.details.name, m.details.dose),
  },
  weigh_in: {
    label: "Weigh in",
    color: "--weight",
    area: "growth",
    fields: () => [
      { key: "lb", label: "Pounds", kind: "number", half: true, max: 100 },
      { key: "oz", label: "Ounces", kind: "number", step: "0.1", half: true, max: 15.9 },
      { key: "length", label: "Length, inches", kind: "number", step: "0.1", half: true, max: 60 },
      { key: "head", label: "Head, inches", kind: "number", step: "0.1", half: true, max: 30 },
      note("Where it was taken", "Pediatrician, home scale"),
    ],
    line: (m) => join(fmtWeight(totalOunces(m.details)), m.details.length ? `${m.details.length} in long` : ""),
  },
  nurse_note: {
    label: "Nurse note",
    color: "--nurse",
    area: "nurse_notes",
    fields: (c) => [
      { key: "nurse", label: "Nurse name", kind: "text", suggest: "team" },
      { key: "intake", label: "Ate and drank, total", kind: "number", step: "0.5", half: true, max: 3000 },
      unitField(c.unit),
      { key: "feeds", label: "Meals", kind: "textarea", rows: 2, placeholder: `Times, amounts, how ${c.name} took them` },
      { key: "wet", label: "Wet diapers", kind: "number", half: true, max: 50 },
      { key: "dirty", label: "Dirty diapers", kind: "number", half: true, max: 50 },
      { key: "vitals", label: `How ${c.name} is doing`, kind: "text", placeholder: "Weight, temperature, oxygen" },
      { key: "activity", label: "Practice and play", kind: "textarea", rows: 2 },
      { key: "concerns", label: "Keep an eye on", kind: "textarea", rows: 2 },
      { key: "text", label: "Full report", kind: "textarea", rows: 4, placeholder: "The whole message, word for word" },
    ],
    line: (m) => {
      const d = m.details;
      return join(
        d.intake ? `Took in ${amountText(d.intake, d.unit)}` : "",
        d.concerns ? `Keep an eye on: ${d.concerns}` : "",
        !d.intake && !d.concerns ? (d.feeds ?? d.text) : "",
      );
    },
  },
  note: {
    label: "Note",
    color: "--note",
    area: "diary",
    fields: () => [{ key: "note", label: "Note", kind: "textarea", rows: 4 }],
    line: (m) => m.note ?? "",
  },
};

export const isMomentType = (v: unknown): v is MomentType => (MOMENT_TYPES as readonly string[]).includes(String(v));

/** Turns submitted form values into { details, note } for one kind of moment, checked against its fields. */
export function parseMomentFields(type: MomentType, values: Record<string, unknown>, ctx: Ctx) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of MOMENTS[type].fields(ctx)) {
    const blank = (v: unknown) => (v === "" || v == null ? undefined : v);
    if (f.kind === "number") {
      shape[f.key] = z.preprocess(blank, z.coerce.number(`Please check ${f.label.toLowerCase()}.`).min(0, `Please check ${f.label.toLowerCase()}.`).max(f.max ?? 100000, `Please check ${f.label.toLowerCase()}.`).optional());
    } else if (f.kind === "select") {
      const values = (f.options ?? []).map((o) => (typeof o === "string" ? o : o[0]));
      shape[f.key] = z.preprocess(blank, z.enum(values as [string, ...string[]]).optional());
    } else if (f.kind === "time") {
      shape[f.key] = z.preprocess(blank, z.string().regex(/^\d{2}:\d{2}$/, `Please check ${f.label.toLowerCase()}.`).optional());
    } else {
      shape[f.key] = z.preprocess(blank, z.string().trim().max(f.rows && f.rows > 2 ? 15000 : 2000).optional());
    }
  }
  const parsed = z.object(shape).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const { note: noteText, ...rest } = parsed.data as Record<string, unknown>;
  const details = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== ""));
  return { details, note: (noteText as string | undefined) || null } as const;
}

/**
 * A night feed's total from its pump rate and times, when no total was
 * entered. Pumps run past midnight, so an end before the start means the
 * next morning.
 */
export function nightFeedTotal(start: string | null | undefined, end: string | null | undefined, rate: number | null | undefined): number | null {
  if (!start || !end || !rate) return null;
  const minutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let span = minutes(end) - minutes(start);
  if (span <= 0) span += 24 * 60;
  return Math.round((rate * span) / 60);
}

// ---- amounts, units and weights ----

const ML_PER_OZ = 29.5735;

/** An amount in the family's preferred unit. */
export function toUnit(amount: unknown, from: unknown, to: Unit): number {
  const n = Number(amount) || 0;
  if (!from || from === to) return n;
  return to === "ml" ? n * ML_PER_OZ : n / ML_PER_OZ;
}

export const fmtAmount = (v: number, unit: Unit) => (unit === "ml" ? `${Math.round(v)} ml` : `${Math.round(v * 2) / 2} oz`);

const amountText = (amount: unknown, unit: unknown) => (amount ? `${amount} ${unit ?? ""}`.trim() : "");

export const totalOunces = (d: Record<string, unknown>) => (Number(d.lb) || 0) * 16 + (Number(d.oz) || 0);

export function fmtWeight(oz: number): string {
  if (!oz) return "";
  const lb = Math.floor(oz / 16);
  const rest = Math.round((oz - lb * 16) * 10) / 10;
  return `${lb} lb ${rest} oz`;
}

// ---- the day at a glance (the prototype's dayTiles) ----

const byNewest = (a: Moment, b: Moment) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? ""));
export const newestFirst = (list: Moment[]) => [...list].sort(byNewest);

export type DaySummary = {
  meals: { total: number; count: number; fromNurse: boolean };
  nightFeed: Moment | null;
  lastMeal: Moment | null;
  diapers: { count: number; wet: number; dirty: number };
  naps: { count: number; hours: number };
  play: { count: number; minutes: number };
  /** Milk pumped this day, in the family's unit. Not counted as meals. */
  pumping: { total: number; count: number };
};

/**
 * Totals for one day. `moments` should cover the day and the day before (for
 * last night's feed); `lastMeal` is the newest meal on any day.
 */
export function summarizeDay(moments: Moment[], date: string, unit: Unit, lastMeal: Moment | null): DaySummary {
  const day = moments.filter((m) => m.date === date);
  const of = (t: MomentType) => day.filter((m) => m.type === t);
  const meals = of("meal");
  const fed = day
    .filter((m) => m.type === "meal" || m.type === "night_feed")
    .reduce(
      (sum, m) => sum + (m.type === "night_feed" ? toUnit(m.details.total, m.details.unit ?? "ml", unit) : toUnit(m.details.amount, m.details.unit, unit)),
      0,
    );
  // When nobody logged meals, the nurse's total for the day stands in.
  const fromNurse = of("nurse_note").reduce((max, m) => Math.max(max, toUnit(m.details.intake, m.details.unit, unit)), 0);
  const diapers = of("diaper");
  const naps = of("nap");
  const play = of("playtime");
  const nightFeed = newestFirst(moments.filter((m) => m.type === "night_feed" && (m.date === date || m.date === addDays(date, -1))))[0] ?? null;

  return {
    meals: { total: fed || fromNurse, count: meals.length, fromNurse: !fed && fromNurse > 0 },
    nightFeed,
    lastMeal,
    diapers: {
      count: diapers.length,
      wet: diapers.filter((d) => d.details.kind !== "Dirty").length,
      dirty: diapers.filter((d) => d.details.kind !== "Wet").length,
    },
    naps: { count: naps.length, hours: naps.reduce((s, n) => s + (Number(n.details.hours) || 0), 0) },
    play: { count: play.length, minutes: play.reduce((s, p) => s + (Number(p.details.minutes) || 0), 0) },
    pumping: { total: of("pumping").reduce((sum, m) => sum + toUnit(m.details.amount, m.details.unit, unit), 0), count: of("pumping").length },
  };
}

/** "12 min ago", "3h 5m ago", "2d ago" (the prototype's ago). */
export function ago(minutes: number): string {
  if (minutes < 0) return "";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ${minutes % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function join(...parts: unknown[]): string {
  return parts.filter((p) => p !== undefined && p !== null && p !== "").map(String).join(" · ");
}
