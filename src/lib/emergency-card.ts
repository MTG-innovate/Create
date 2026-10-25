import { ageText, correctedAgeText, fmtDay, fmtTime } from "./dates";
import { fmtWeight } from "./moments";
import type { VisitSheet } from "./visit-sheet";

// The emergency card: what a sitter, an ER nurse or EMS needs to know about the
// child, on one screen. Only facts the family entered, in the same order every
// time. Sections the person opening it may not see are left out by the caller.

export type CardInput = {
  name: string;
  birthDate: string | null;
  dueDate: string | null;
  conditions: string | null;
  allergies: string | null;
  emergencyPlan: string | null;
  hospital: string | null;
  /** Latest weight in ounces and its date, when the person may see growth. */
  weight: { oz: number; date: string } | null;
  medicines: { name: string; dose: string | null; times: string[]; when_to_give: string | null }[] | null;
  equipment: { name: string; details: string | null }[] | null;
  team: { name: string; role: string | null; phone: string | null }[] | null;
  today: Date;
};

export function buildEmergencyCard(c: CardInput): VisitSheet {
  const sections: VisitSheet["sections"] = [];
  const add = (title: string, items: (string | null | undefined)[], none: string) => {
    const real = items.filter((i): i is string => Boolean(i && i.trim()));
    sections.push({ title, items: real.length ? real : [none] });
  };
  const lines = (text: string | null) => (text ?? "").split(/\n+/);

  add("Allergies", lines(c.allergies), "None known");
  add("Conditions", lines(c.conditions), "None listed");
  if (c.medicines) {
    add(
      "Medicines",
      c.medicines.map((m) => [m.name, m.dose, m.times.map(fmtTime).join(" and "), m.when_to_give].filter(Boolean).join(", ")),
      "None listed",
    );
  }
  if (c.equipment) add("Equipment", c.equipment.map((e) => [e.name, e.details].filter(Boolean).join(": ")), "None listed");
  add("If something happens", lines(c.emergencyPlan), "Call 911.");
  add("Preferred hospital", [c.hospital], "Not chosen yet");
  if (c.team) {
    add("Doctors and care team", c.team.filter((t) => t.phone).map((t) => `${t.name}${t.role ? ` (${t.role})` : ""}: ${t.phone}`), "None added yet");
  }

  const age = [ageText(c.birthDate, c.today), correctedAgeText(c.birthDate, c.dueDate, c.today)].filter(Boolean).join(" · ");
  return {
    title: `${c.name}: emergency card`,
    sub: [
      c.birthDate ? `Born ${fmtDay(c.birthDate, { month: "long", day: "numeric", year: "numeric" })}` : "",
      age,
      c.weight ? `${fmtWeight(c.weight.oz)} on ${fmtDay(c.weight.date, { month: "short", day: "numeric" })}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    sections,
  };
}
