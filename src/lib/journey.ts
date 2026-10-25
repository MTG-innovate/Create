import { addDays, daysBetween } from "./dates";
import { summarizeDay, totalOunces, type Moment, type Unit } from "./moments";

// Josiah's journey, from the prototype's vJourney. The child is only ever
// compared to themself: no percentiles, no other babies. This is a firm
// product rule, so nothing here takes an age or sex, and nothing should.

export const WIN_CATEGORIES = [
  "A first",
  "Bright spot",
  "Feeding",
  "Growing",
  "Moving",
  "Sounds and talking",
  "Health",
  "Just because",
] as const;
export type WinCategory = (typeof WIN_CATEGORIES)[number];

export const WIN_COLOR: Record<WinCategory, string> = {
  "A first": "--accent",
  "Bright spot": "--feed",
  Feeding: "--feed",
  Growing: "--weight",
  Moving: "--exercise",
  "Sounds and talking": "--sleep",
  Health: "--nurse",
  "Just because": "--diaper",
};

export type Win = { id: string; child_id: string; title: string; happened_on: string; category: WinCategory; note: string | null };

export type WeighIn = { id: string; date: string; oz: number; length: number | null; head: number | null; note: string | null };

/** Weigh-ins with a weight, oldest first. */
export function weighIns(moments: Moment[]): WeighIn[] {
  return moments
    .filter((m) => m.type === "weigh_in" && totalOunces(m.details) > 0)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
    .map((m) => ({
      id: m.id,
      date: m.date,
      oz: totalOunces(m.details),
      length: Number(m.details.length) || null,
      head: Number(m.details.head) || null,
      note: m.note,
    }));
}

/** "1 lb 2 oz", "6.5 oz" (the prototype's fmtGain): the size of a change, without its sign. */
export function fmtGain(oz: number): string {
  const a = Math.abs(oz);
  const lb = Math.floor(a / 16);
  const rest = Math.round((a - lb * 16) * 10) / 10;
  return `${lb ? `${lb} lb ` : ""}${rest || !lb ? `${rest} oz` : ""}`.trim();
}

/** The badge on each weigh-in: the change since the one before it. */
export function gainLabel(list: WeighIn[], i: number): { text: string; up: boolean } {
  if (i === 0) return { text: "First", up: false };
  const d = list[i].oz - list[i - 1].oz;
  if (d > 0) return { text: `+${fmtGain(d)}`, up: true };
  if (d < 0) return { text: `−${fmtGain(d)}`, up: false };
  return { text: "Same", up: false };
}

/**
 * "Up 3 lb 4 oz since birth" for the Home hero, or null when there is no gain
 * to celebrate yet. "Since birth" when the first weigh-in is on the birthday
 * or is marked as the birth weight.
 */
export function upSince(list: WeighIn[], birthDate: string | null): { gain: string; since: "birth" | string } | null {
  if (list.length < 2) return null;
  const gain = list[list.length - 1].oz - list[0].oz;
  if (gain <= 0) return null;
  const first = list[0];
  const atBirth = first.date === birthDate || /birth/i.test(first.note ?? "");
  return { gain: fmtGain(gain), since: atBirth ? "birth" : first.date };
}

/** Growth in length or head size from the first measurement to the last. */
export function measureChange(list: WeighIn[], key: "length" | "head"): { latest: number; date: string; up: number; since: string } | null {
  const has = list.filter((w) => w[key]);
  if (!has.length) return null;
  const first = has[0];
  const last = has[has.length - 1];
  return { latest: last[key]!, date: last.date, up: Math.round((last[key]! - first[key]!) * 10) / 10, since: first.date };
}

/** One value per day for the last `days` days ending today: meals (in the family's unit) and playtime minutes. */
export function lastDays(moments: Moment[], today: string, days: number, unit: Unit) {
  return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1)).map((date) => {
    const s = summarizeDay(moments, date, unit, null);
    return { date, meals: s.meals.total, play: s.play.minutes };
  });
}

/** A round axis maximum at or above `v`, close enough that the bars use most of the chart. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((s) => s * p >= v)!;
  return step * p;
}

export type GrowthChart = {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  ticks: { y: number; label: string }[];
  points: { x: number; y: number; w: WeighIn }[];
  stars: { x: number; win: Win }[];
  first: string;
  last: string;
};

/**
 * Layout for the growth chart (the prototype's growthChart): weight over time
 * on one axis, with wins as stars along the bottom at the date they happened.
 */
export function growthChart(list: WeighIn[], wins: Win[]): GrowthChart {
  const width = 340;
  const height = 210;
  const plot = { left: 46, right: width - 18, top: 26, bottom: height - 40 };
  const t0 = list[0].date;
  const span = Math.max(daysBetween(t0, list[list.length - 1].date), 1);
  const one = list.length === 1;
  const xAt = (date: string) => (one ? (plot.left + plot.right) / 2 : plot.left + ((plot.right - plot.left) * daysBetween(t0, date)) / span);

  const values = list.map((w) => w.oz);
  const pad = Math.max(6, (Math.max(...values) - Math.min(...values)) * 0.2);
  const lo = Math.max(0, Math.floor((Math.min(...values) - pad) / 8) * 8);
  const hi = Math.ceil((Math.max(...values) + pad) / 8) * 8;
  const yAt = (oz: number) => plot.bottom - ((plot.bottom - plot.top) * (oz - lo)) / (hi - lo);

  const last = list[list.length - 1].date;
  return {
    width,
    height,
    plot,
    ticks: [lo, (lo + hi) / 2, hi].map((v) => ({ y: yAt(v), label: `${Math.round((v / 16) * 10) / 10} lb` })),
    points: list.map((w) => ({ x: xAt(w.date), y: yAt(w.oz), w })),
    stars: one ? [] : wins.filter((x) => x.happened_on >= t0 && x.happened_on <= last).map((win) => ({ x: xAt(win.happened_on), win })),
    first: t0,
    last,
  };
}

/** The points of a five-pointed star, for wins on the chart. */
export function starPoints(x: number, y: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}
