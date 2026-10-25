// Roles and care areas, in the warm words the app shows people. The database
// enforces these (see supabase/migrations); this file only describes them.

export const ROLES = ["owner", "family", "helper", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  family: "Family",
  helper: "Helper",
  viewer: "Can view",
};

export const ROLE_HINT: Record<Role, string> = {
  owner: "Can do everything, including inviting people",
  family: "Sees and adds everything",
  helper: "Sees and helps with only the parts you choose",
  viewer: "Can look, but not change anything",
};

export const CARE_AREAS = [
  "visits",
  "diary",
  "nurse_notes",
  "growth",
  "practice",
  "medicines",
  "team",
  "wins",
  "questions",
] as const;
export type CareArea = (typeof CARE_AREAS)[number];

export const AREA_LABEL: Record<CareArea, string> = {
  visits: "Visits",
  diary: "Diary: meals, night feeds, diapers, naps, playtime, medicine given",
  nurse_notes: "Nurse notes",
  growth: "Weigh ins",
  practice: "Practice at home",
  medicines: "Medicines, equipment and supplies",
  team: "Helpers and phone numbers",
  wins: "Wins and bright spots",
  questions: "Questions to ask",
};

export type HelperPreset = { label: string; view: CareArea[]; edit: CareArea[] };

export const HELPER_PRESETS: HelperPreset[] = [
  {
    label: "Home nurse",
    view: ["visits", "diary", "nurse_notes", "growth", "practice", "medicines", "team"],
    edit: ["diary", "nurse_notes", "growth", "practice"],
  },
  {
    label: "Therapist",
    view: ["visits", "practice", "growth"],
    edit: ["visits", "practice"],
  },
  {
    label: "Sitter",
    view: ["diary", "practice", "medicines", "team"],
    edit: ["diary", "practice"],
  },
];

/** Keeps a helper's areas valid: anything they can edit, they can also see. */
export function normalizeAreas(view: readonly string[], edit: readonly string[]): { view: CareArea[]; edit: CareArea[] } {
  const known = (a: string): a is CareArea => (CARE_AREAS as readonly string[]).includes(a);
  const editSet = new Set(edit.filter(known));
  const viewSet = new Set([...view.filter(known), ...editSet]);
  const ordered = (s: Set<CareArea>) => CARE_AREAS.filter((a) => s.has(a));
  return { view: ordered(viewSet), edit: ordered(editSet) };
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

type Membership = { role: Role; view_areas: readonly CareArea[]; edit_areas: readonly CareArea[] };

// For showing or hiding buttons. The database makes the real decision.
export const canView = (me: Membership, area: CareArea) => me.role !== "helper" || me.view_areas.includes(area);
export const canEdit = (me: Membership, area: CareArea) =>
  me.role === "owner" || me.role === "family" || (me.role === "helper" && me.edit_areas.includes(area));
