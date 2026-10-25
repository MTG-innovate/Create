"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { ROLES, normalizeAreas } from "@/lib/access";
import { friendlyError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type InviteState = FormState & { link?: string; email?: string };

const Access = z.object({
  familyId: z.uuid(),
  role: z.enum(ROLES, "Choose what they can do."),
  helperLabel: z.string().trim().max(60).optional().default(""),
});

function readAccess(form: FormData) {
  const parsed = Access.safeParse({
    familyId: form.get("familyId"),
    role: form.get("role"),
    helperLabel: form.get("helperLabel") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const isHelper = parsed.data.role === "helper";
  const areas = isHelper
    ? normalizeAreas(form.getAll("view").map(String), form.getAll("edit").map(String))
    : { view: [], edit: [] };
  if (isHelper && !areas.view.length) return { error: "Choose at least one thing this helper can see." } as const;
  return { ...parsed.data, helperLabel: isHelper ? parsed.data.helperLabel || null : null, ...areas } as const;
}

export async function invitePerson(_prev: InviteState, form: FormData): Promise<InviteState> {
  await requireUser();
  const access = readAccess(form);
  if ("error" in access) return { error: access.error };
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Please check the email address." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_invitation", {
      family: access.familyId,
      invitee_email: email.data,
      invitee_role: access.role,
      helper_label: access.helperLabel,
      view_areas: access.view,
      edit_areas: access.edit,
    })
    .single<{ invitation_id: string; token: string }>();
  if (error || !data) return { error: friendlyError(error) };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  revalidatePath(`/f/${access.familyId}/people`);
  return { link: `${origin}/invite/${data.token}`, email: email.data };
}

export async function changeMember(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const access = readAccess(form);
  if ("error" in access) return { error: access.error };
  const userId = z.uuid().safeParse(form.get("userId"));
  if (!userId.success) return { error: "Something went wrong. Reload and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .update({ role: access.role, helper_label: access.helperLabel, view_areas: access.view, edit_areas: access.edit })
    .eq("family_id", access.familyId)
    .eq("user_id", userId.data)
    .select("user_id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only an owner can change what people can do." };
  revalidatePath(`/f/${access.familyId}`, "layout");
  return { done: "Saved" };
}

export async function removeMember(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const ids = z.object({ familyId: z.uuid(), userId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!ids.success) return { error: "Something went wrong. Reload and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .delete()
    .eq("family_id", ids.data.familyId)
    .eq("user_id", ids.data.userId)
    .select("user_id");
  if (error) return { error: friendlyError(error) };
  if (!data.length) return { error: "Only an owner can remove people." };
  if (ids.data.userId === me.id) redirect("/");
  revalidatePath(`/f/${ids.data.familyId}/people`);
  return { done: "Removed" };
}

export async function cancelInvitation(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const ids = z.object({ familyId: z.uuid(), invitationId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!ids.success) return { error: "Something went wrong. Reload and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { invitation: ids.data.invitationId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/f/${ids.data.familyId}/people`);
  return { done: "Cancelled" };
}
