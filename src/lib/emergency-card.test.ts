import { describe, expect, it } from "vitest";
import { buildEmergencyCard, type CardInput } from "./emergency-card";
import { sheetAsText } from "./visit-sheet";

const base: CardInput = {
  name: "Josiah",
  birthDate: "2025-04-12",
  dueDate: "2025-06-21",
  conditions: "Heart murmur\nG-tube",
  allergies: "Penicillin",
  emergencyPlan: "Call 911, then his mother.\nBring the go bag.",
  hospital: "Example Children's Hospital",
  weight: { oz: 290, date: "2026-10-20" },
  medicines: [{ name: "Iron drops", dose: "0.5 ml", times: ["08:00:00", "20:00:00"], when_to_give: null }],
  equipment: [{ name: "Feeding pump", details: "Kangaroo Joey, 30 ml/hr" }],
  team: [
    { name: "Dr. Example", role: "Pediatrician", phone: "404-555-0100" },
    { name: "No phone", role: null, phone: null },
  ],
  today: new Date("2026-10-25T12:00:00"),
};

describe("the emergency card", () => {
  it("puts allergies first, then everything a sitter or the ER needs", () => {
    const card = buildEmergencyCard(base);
    expect(card.title).toBe("Josiah: emergency card");
    expect(card.sub).toBe("Born April 12, 2025 · 1 year, 6 months old · 1 year, 4 months corrected · 18 lb 2 oz on Oct 20");
    expect(card.sections.map((s) => s.title)).toEqual([
      "Allergies",
      "Conditions",
      "Medicines",
      "Equipment",
      "If something happens",
      "Preferred hospital",
      "Doctors and care team",
    ]);
    expect(card.sections[1].items).toEqual(["Heart murmur", "G-tube"]);
    expect(card.sections[2].items).toEqual(["Iron drops, 0.5 ml, 8:00 AM and 8:00 PM"]);
    expect(card.sections[6].items).toEqual(["Dr. Example (Pediatrician): 404-555-0100"]);
  });

  it("says something calm when a section is empty, and leaves out what the person may not see", () => {
    const card = buildEmergencyCard({ ...base, allergies: null, conditions: "", emergencyPlan: null, hospital: null, medicines: null, equipment: null, team: null, weight: null });
    expect(card.sections).toEqual([
      { title: "Allergies", items: ["None known"] },
      { title: "Conditions", items: ["None listed"] },
      { title: "If something happens", items: ["Call 911."] },
      { title: "Preferred hospital", items: ["Not chosen yet"] },
    ]);
  });

  it("copies as plain text", () => {
    expect(sheetAsText(buildEmergencyCard(base))).toContain("ALLERGIES\n• Penicillin");
  });
});
