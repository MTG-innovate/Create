import { addDays, fmtDay, fmtTime } from "./dates";
import { LITTLE_STEPS, type JourneyConfig } from "./journeys";
import { MOMENTS, fmtAmount, fmtWeight, newestFirst, summarizeDay, totalOunces, type Moment, type Unit } from "./moments";
import type { VisitKind } from "./visits";

// The visit sheet (the prototype's buildVisitSheet): everything the next
// doctor or therapist should know, gathered from the family's own records.
// No AI. Only facts the family entered, arranged in the same order every time.

export type SheetVisit = { kind: VisitKind; title: string | null; provider: string | null; date: string; time: string | null };
export type SheetNote = { kind: string; provider: string | null; date: string; summary: string | null; homework: string | null };

export type SheetInput = {
  childName: string;
  /** Which sections the person's journey includes. Little Steps when not given. */
  journey?: JourneyConfig;
  visit: SheetVisit;
  today: string;
  unit: Unit;
  medicines: { name: string; dose: string | null; when_to_give: string | null; times?: string[] }[];
  /** Weigh-ins and the last 14 days of moments, for this child. */
  moments: Moment[];
  /** Visits with notes from the last 90 days, for this child. */
  notes: SheetNote[];
  practice: { instruction: string; provider: string | null }[];
  /** Equipment the child uses (a feeding pump, oxygen), when the person may see it. */
  equipment?: { name: string; details: string | null }[];
  questions: { text: string; for_whom: string | null }[];
};

export type VisitSheet = { title: string; sub: string; sections: { title: string; items: string[] }[] };

const short = (d: string) => fmtDay(d, { month: "short", day: "numeric" });
const said = (n: SheetNote) => [n.summary, n.homework ? `At home: ${n.homework}` : ""].filter(Boolean).join(" ");

export function buildVisitSheet(s: SheetInput): VisitSheet {
  const { visit, today } = s;
  const include = (s.journey ?? LITTLE_STEPS).visitSheet;
  const sections: VisitSheet["sections"] = [];
  const add = (title: string, items: string[], none: string) => sections.push({ title, items: items.length ? items : [none] });

  add(
    "Current medicines",
    s.medicines.map((m) => [m.name, m.dose, (m.times ?? []).map(fmtTime).join(" and "), m.when_to_give].filter(Boolean).join(", ")),
    "None listed",
  );
  if (s.equipment?.length) sections.push({ title: "Equipment", items: s.equipment.map((e) => [e.name, e.details].filter(Boolean).join(": ")) });

  const weights = s.moments
    .filter((m) => m.type === "weigh_in" && totalOunces(m.details) > 0 && m.date >= addDays(today, -60))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => `${short(m.date)}: ${fmtWeight(totalOunces(m.details))}${m.note ? ` (${m.note})` : ""}`);
  if (include.weight) add("Weight, last 60 days", weights, "No weigh ins logged");

  if (include.meals) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7));
    sections.push({
      title: "Meals, last 7 days (including night feeds)",
      items: days.map((d) => {
        const total = summarizeDay(s.moments, d, s.unit, null).meals.total;
        return `${fmtDay(d)}: ${total ? fmtAmount(total, s.unit) : "not logged"}`;
      }),
    });
  }

  if (include.nightFeeds) {
    const nights = newestFirst(s.moments.filter((m) => m.type === "night_feed" && m.date >= addDays(today, -7))).map(
      (m) => `${short(m.date)}: ${MOMENTS.night_feed.line(m)}`,
    );
    add("Night feeds, last 7 nights", nights, "None logged");
  }

  const watch = newestFirst(s.moments.filter((m) => m.type === "nurse_note" && m.details.concerns && m.date >= addDays(today, -14))).map(
    (m) => `${short(m.date)}: ${m.details.concerns}`,
  );
  add("Keep an eye on, from the nurse, last 14 days", watch, "Nothing noted");

  const recent = [...s.notes]
    .filter((n) => n.date <= today && n.date >= addDays(today, -90) && (n.summary || n.homework))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestPerKind = new Map<string, SheetNote>();
  for (const n of recent) if (n.kind !== visit.kind && !latestPerKind.has(n.kind)) latestPerKind.set(n.kind, n);
  add(
    `What ${s.childName}'s other helpers said recently`,
    [...latestPerKind.values()].map((n) => `${n.kind}${n.provider ? ` (${n.provider})` : ""}, ${short(n.date)}: ${said(n)}`),
    "No other visit notes yet",
  );

  const lastSame = recent.find((n) => n.kind === visit.kind && n.date < today);
  if (lastSame) sections.push({ title: `Last ${visit.kind} visit, ${short(lastSame.date)}`, items: [said(lastSame)] });

  add("Practice at home right now", s.practice.map((p) => `${p.instruction}${p.provider ? ` (${p.provider})` : ""}`), "None listed");

  // Questions meant for this helper or this kind of visit, plus ones not meant for anyone in particular.
  const matches = (forWhom: string) =>
    [visit.provider, visit.kind].some((v) => v && (forWhom.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(forWhom.toLowerCase())));
  add("Our questions", s.questions.filter((q) => !q.for_whom || matches(q.for_whom)).map((q) => q.text), "None yet. Add them on Home.");

  return {
    title: `${s.childName}: ${visit.title || visit.kind}`,
    sub: [fmtDay(visit.date, { weekday: "long", month: "long", day: "numeric" }), visit.time ? fmtTime(visit.time) : "", visit.provider]
      .filter(Boolean)
      .join(" · "),
    sections,
  };
}

/** The sheet as plain text, for pasting into a text, an email or a portal message. */
export function sheetAsText(sheet: VisitSheet): string {
  return [sheet.title, sheet.sub, "", ...sheet.sections.flatMap((sec) => [sec.title.toUpperCase(), ...sec.items.map((i) => `• ${i}`), ""])]
    .join("\n")
    .trimEnd();
}
