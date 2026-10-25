"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** After an error, what the person typed comes back so the form keeps it. */
export type WelcomeState = { error?: string; values?: Record<string, string> };

const Welcome = z.object({
  yourName: z.string().trim().max(80),
  childName: z.string().trim().min(1, "Please add your little one's name.").max(60),
  birthDate: z.iso.date().or(z.literal("")),
  timeZone: z.string().min(1),
  pilotCode: z.string().trim().max(60).optional(),
});

export async function startFamily(_prev: WelcomeState, form: FormData): Promise<WelcomeState> {
  const user = await requireUser("/welcome");
  const typed = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
  const input = Welcome.safeParse(typed);
  if (!input.success) return { error: input.error.issues[0].message, values: typed };
  const { yourName, childName, birthDate, timeZone, pilotCode } = input.data;

  const supabase = await createClient();
  if (yourName) await supabase.from("profiles").update({ display_name: yourName }).eq("id", user.id);

  const { data: familyId, error } = await supabase.rpc("create_family", {
    family_name: `${childName}'s Care Circle`,
    child_name: childName,
    child_birth_date: birthDate || null,
    family_time_zone: isTimeZone(timeZone) ? timeZone : "America/New_York",
    pilot_code: pilotCode || null,
  });
  if (error) return { error: friendlyError(error), values: typed };
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
