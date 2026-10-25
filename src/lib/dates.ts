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
