/** "3 months old", "1 year, 2 months old". Empty when there is no birth date. */
export function ageText(birthDate: string | null | undefined, today: Date = new Date()): string {
  if (!birthDate) return "";
  const [y, m, d] = birthDate.split("-").map(Number);
  let months = (today.getFullYear() - y) * 12 + today.getMonth() - (m - 1);
  if (today.getDate() < d) months--;
  if (months < 0) return "";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (!years) return `${plural(rest, "month")} old`;
  return `${plural(years, "year")}${rest ? `, ${plural(rest, "month")}` : ""} old`;
}

export function greeting(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** The hour of day in a family's time zone. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
}

// Calendar days are "YYYY-MM-DD" strings in the family's time zone, so a day
// means the same thing to the server and to every phone in the family.

/** Today's date in a family's time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(now);
}

const utc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function addDays(day: string, n: number): string {
  const date = utc(day);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Whole days from a to b. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);
}

export function isDay(value: unknown): value is string {
  // The round trip rejects dates that do not exist, like 2026-02-30.
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

/** Formats a calendar day, e.g. { weekday: "short", month: "short", day: "numeric" } -> "Tue, Mar 3". */
export function fmtDay(day: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return utc(day).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

/** "14:30" or "14:30:00" -> "2:30 PM". */
export function fmtTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** "Today", "Tomorrow", "Yesterday" or a long date. */
export function dayLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fmtDay(day, { weekday: "long", month: "long", day: "numeric" });
}
