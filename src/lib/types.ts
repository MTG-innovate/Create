import type { CareJourney } from "./journeys";
import type { CareArea, Role } from "./access";

// Row shapes for the step 1 tables, matching supabase/migrations. Replace with
// `supabase gen types` output once the full local stack is in use.

export type Family = {
  id: string;
  name: string;
  feed_unit: "oz" | "ml";
  encouragement: "scripture" | "gentle";
  time_zone: string;
};

export type Child = {
  id: string;
  family_id: string;
  name: string;
  birth_date: string | null;
  photo_path: string | null;
  journey: CareJourney;
};

export type Member = {
  family_id: string;
  user_id: string;
  role: Role;
  helper_label: string | null;
  view_areas: CareArea[];
  edit_areas: CareArea[];
  created_at: string;
};

export type Invitation = {
  id: string;
  family_id: string;
  email: string;
  role: Role;
  helper_label: string | null;
  view_areas: CareArea[];
  edit_areas: CareArea[];
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
