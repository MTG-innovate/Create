"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type WelcomeState = { error?: string };

const Welcome = z.object({
  yourName: z.string().trim().max(80),
  childName: z.string().trim().min(1, "Please add your little one's name.").max(60),
  birthDate: z.iso.date().or(z.literal("")),
  timeZone: z.string().min(1),
});

export async function startFamily(_prev: WelcomeState, form: FormData): Promise<WelcomeState> {
  const user = await requireUser("/welcome");
  const input = Welcome.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { yourName, childName, birthDate, timeZone } = input.data;

  const supabase = await createClient();
  if (yourName) await supabase.from("profiles").update({ display_name: yourName }).eq("id", user.id);

  const { data: familyId, error } = await supabase.rpc("create_family", {
    family_name: `${childName}'s family`,
    child_name: childName,
    child_birth_date: birthDate || null,
    family_time_zone: isTimeZone(timeZone) ? timeZone : "America/New_York",
  });
  if (error) return { error: friendlyError(error) };
  redirect(`/f/${familyId}`);
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
