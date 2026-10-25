import { addDays, daysBetween, fmtDay } from "./dates";

// "Reorder soon" for equipment and supplies: due a week before the next order
// date, worked out from the last order and how often it is reordered.

export type Reorder = { due: string; soon: boolean; text: string } | null;

export function reorderStatus(lastOrdered: string | null, everyDays: number | null, today: string): Reorder {
  if (!lastOrdered || !everyDays) return null;
  const due = addDays(lastOrdered, everyDays);
  const left = daysBetween(today, due);
  if (left <= 0) return { due, soon: true, text: "Time to reorder" };
  if (left <= 7) return { due, soon: true, text: `Reorder by ${fmtDay(due, { weekday: "short", month: "short", day: "numeric" })}` };
  return { due, soon: false, text: `Next order ${fmtDay(due, { month: "short", day: "numeric" })}` };
}
