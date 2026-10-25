import { fmtTime } from "./dates";

// "Medicines today" on Home: one row per medicine per time of day. Ticking a
// dose adds a "medicine given" diary moment that remembers which medicine and
// which time it was for; unticking removes it. Nothing here changes the
// medicine list or a dose.

export type ScheduledMedicine = { id: string; child_id: string; name: string; dose: string | null; times: string[] };
export type GivenDose = { id: string; medicine_id: string; slot: string; time: string | null; created_by: string | null };
export type DoseRow = {
  medicineId: string;
  childId: string;
  name: string;
  dose: string | null;
  slot: string;
  label: string;
  given: { momentId: string; at: string | null; by: string | null } | null;
  /** True when the time has passed and the dose is not ticked yet. */
  waiting: boolean;
};

const hhmm = (t: string) => t.slice(0, 5);

export function dosesToday(medicines: ScheduledMedicine[], given: GivenDose[], nowMinutes: number): DoseRow[] {
  return medicines
    .flatMap((m) =>
      m.times.map((t): DoseRow => {
        const slot = hhmm(t);
        const g = given.find((d) => d.medicine_id === m.id && d.slot === slot);
        const [h, min] = slot.split(":").map(Number);
        return {
          medicineId: m.id,
          childId: m.child_id,
          name: m.name,
          dose: m.dose,
          slot,
          label: fmtTime(slot),
          given: g ? { momentId: g.id, at: g.time ? fmtTime(g.time) : null, by: g.created_by } : null,
          waiting: !g && h * 60 + min <= nowMinutes,
        };
      }),
    )
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}
