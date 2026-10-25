import { addDays, daysBetween } from "./dates";

// Visit kinds, colors and friendly names, from the prototype (APPT_KINDS,
// KIND_COLOR, FRIENDLY). The database accepts exactly these kinds.
export const VISIT_KINDS = [
  "Primary care",
  "Cardiology",
  "GI",
  "Advanced feeding",
  "Ophthalmology",
  "Other specialist",
  "Physical therapy",
  "Occupational therapy",
  "Speech therapy",
  "In-home nurse",
  "Lab or test",
  "Other",
] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

export const KIND_COLOR: Record<VisitKind, string> = {
  "Primary care": "--accent",
  Cardiology: "--weight",
  GI: "--feed",
  "Advanced feeding": "--feed",
  Ophthalmology: "--sleep",
  "Other specialist": "--weight",
  "Physical therapy": "--exercise",
  "Occupational therapy": "--diaper",
  "Speech therapy": "--sleep",
  "In-home nurse": "--nurse",
  "Lab or test": "--note",
  Other: "--note",
};

const FRIENDLY: Partial<Record<VisitKind, string>> = {
  "Speech therapy": "Speech",
  "In-home nurse": "Nurse visit",
  "Primary care": "Checkup",
};

export const friendlyKind = (kind: VisitKind) => FRIENDLY[kind] ?? kind;

/** The prototype's repeat choices: how many weekly visits in a new series. */
export const REPEAT_CHOICES = [
  [1, "Does not repeat"],
  [4, "Weekly for 4 weeks"],
  [8, "Weekly for 8 weeks"],
  [12, "Weekly for 12 weeks"],
] as const;

/** "Keep it going" adds this many weeks to a series. */
export const KEEP_GOING_WEEKS = 12;

export type VisitFields = {
  kind: VisitKind;
  title: string | null;
  provider: string | null;
  location: string | null;
  who: string | null;
  bring: string | null;
  notes: string | null;
};

export type VisitRow = VisitFields & {
  id: string;
  child_id: string;
  series_id: string | null;
  occurrence_date: string | null;
  date: string;
  time: string | null;
  summary: string | null;
  homework: string | null;
  cancelled: boolean;
};

export type SeriesRow = VisitFields & {
  id: string;
  child_id: string;
  starts_on: string;
  start_time: string | null;
  every_weeks: number;
  ends_on: string | null;
  end_confirmed_at: string | null;
};

/** One visit on the calendar: a one-off visit, or one date in a weekly series. */
export type Visit = VisitFields & {
  /** Stable key for links: the row id, or "<series id>~<date>" for a series date with no row of its own. */
  key: string;
  id: string | null;
  child_id: string;
  series_id: string | null;
  occurrence_date: string | null;
  date: string;
  time: string | null;
  summary: string | null;
  homework: string | null;
};

export const occurrenceKey = (seriesId: string, date: string) => `${seriesId}~${date}`;

export function parseVisitKey(key: string): { id: string } | { seriesId: string; date: string } {
  const [a, b] = key.split("~");
  return b ? { seriesId: a, date: b } : { id: a };
}

/** Every date a series lands on, from `from` to `to` inclusive. */
export function seriesDates(series: Pick<SeriesRow, "starts_on" | "every_weeks" | "ends_on">, from: string, to: string): string[] {
  const step = 7 * series.every_weeks;
  const last = series.ends_on && series.ends_on < to ? series.ends_on : to;
  const offset = Math.max(0, daysBetween(series.starts_on, from));
  let day = addDays(series.starts_on, Math.ceil(offset / step) * step);
  const out: string[] = [];
  while (day <= last) {
    out.push(day);
    day = addDays(day, step);
  }
  return out;
}

/** Whether `date` is one of the series' own dates. */
export function isSeriesDate(series: Pick<SeriesRow, "starts_on" | "every_weeks" | "ends_on">, date: string): boolean {
  const diff = daysBetween(series.starts_on, date);
  return diff >= 0 && diff % (7 * series.every_weeks) === 0 && (!series.ends_on || date <= series.ends_on);
}

export function visitFromRow(row: VisitRow): Visit {
  return {
    key: row.id,
    id: row.id,
    child_id: row.child_id,
    series_id: row.series_id,
    occurrence_date: row.occurrence_date,
    kind: row.kind,
    title: row.title,
    provider: row.provider,
    location: row.location,
    who: row.who,
    bring: row.bring,
    notes: row.notes,
    date: row.date,
    time: row.time,
    summary: row.summary,
    homework: row.homework,
  };
}

export function visitFromSeries(series: SeriesRow, date: string): Visit {
  return {
    key: occurrenceKey(series.id, date),
    id: null,
    child_id: series.child_id,
    series_id: series.id,
    occurrence_date: date,
    kind: series.kind,
    title: series.title,
    provider: series.provider,
    location: series.location,
    who: series.who,
    bring: series.bring,
    notes: series.notes,
    date,
    time: series.start_time,
    summary: null,
    homework: null,
  };
}

/**
 * All visits from `from` to `to`, in time order. Series dates come from the
 * weekly rule; a visits row for a series date (notes added, moved or
 * cancelled) replaces that date. Cancelled visits are left out.
 */
export function visitsBetween(rows: VisitRow[], series: SeriesRow[], from: string, to: string): Visit[] {
  const replaced = new Set(rows.filter((r) => r.series_id).map((r) => occurrenceKey(r.series_id!, r.occurrence_date!)));
  const fromRule = series.flatMap((s) =>
    seriesDates(s, from, to)
      .filter((d) => !replaced.has(occurrenceKey(s.id, d)))
      .map((d) => visitFromSeries(s, d)),
  );
  const fromRows = rows.filter((r) => !r.cancelled && r.date >= from && r.date <= to).map(visitFromRow);
  return [...fromRows, ...fromRule].sort(byTime);
}

export const byTime = (a: Visit, b: Visit) =>
  (a.date + (a.time ?? "99:99")).localeCompare(b.date + (b.time ?? "99:99")) || a.key.localeCompare(b.key);

/**
 * Series that end within `days` days and nobody has answered for yet. The
 * prototype asks "Is it still happening?" before the last visit.
 */
export function endingSoon(series: SeriesRow[], today: string, days: number): SeriesRow[] {
  return series.filter(
    (s) => s.ends_on && !s.end_confirmed_at && s.ends_on >= today && s.ends_on <= addDays(today, days),
  );
}

/** The last date of a new series of `count` visits. */
export const seriesEnd = (startsOn: string, count: number, everyWeeks = 1) => addDays(startsOn, 7 * everyWeeks * (count - 1));

/** The last series date before `date`, or null if `date` is the first. */
export function previousSeriesDate(series: Pick<SeriesRow, "starts_on" | "every_weeks">, date: string): string | null {
  const before = addDays(date, -7 * series.every_weeks);
  return before >= series.starts_on ? before : null;
}
