import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Child, Family, Member } from "@/lib/types";

export type User = { id: string; email: string };

/** The signed-in person, verified from their session token, or null. */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return user;
}

export type FamilySummary = Pick<Family, "id" | "name"> & { children: Pick<Child, "id" | "name">[] };

/** Every family the signed-in person belongs to. The database returns no others. */
export const getMyFamilies = cache(async (): Promise<FamilySummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("families")
    .select("id, name, children (id, name)")
    .order("created_at")
    .order("created_at", { referencedTable: "children" });
  if (error) throw error;
  return data ?? [];
});

export type FamilyContext = { user: User; family: Family; children: Child[]; me: Member };

/**
 * One family, with its children and the signed-in person's own membership.
 * Shows "not found" for a family the person does not belong to, without
 * revealing whether it exists.
 */
export const getFamily = cache(async (familyId: string): Promise<FamilyContext> => {
  const user = await requireUser(`/f/${familyId}`);
  const supabase = await createClient();
  const [family, children, me] = await Promise.all([
    supabase.from("families").select("id, name, feed_unit, encouragement, time_zone").eq("id", familyId).maybeSingle(),
    supabase.from("children").select("id, family_id, name, birth_date, photo_path").eq("family_id", familyId).order("created_at"),
    supabase.from("family_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!family.data || !me.data) notFound();
  return { user, family: family.data, children: children.data ?? [], me: me.data as Member };
});
