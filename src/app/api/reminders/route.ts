import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { pushReady, sendPush } from "@/lib/push";
import { dueReminders, type ReminderFamily } from "@/lib/reminders";

// Sends the reminders that are due. A scheduler calls this every five minutes
// with "Authorization: Bearer <REMINDER_SECRET>" (see the README). It runs with
// no signed-in person: the secret lets the database hand over only what
// reminders need (public.reminder_data and public.claim_reminders).

export const dynamic = "force-dynamic";

function allowed(request: NextRequest, secret: string | undefined): secret is string {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: NextRequest) {
  const secret = process.env.REMINDER_SECRET;
  if (!allowed(request, secret)) return new Response("Not allowed", { status: 401 });
  if (!pushReady()) return Response.json({ due: 0, sent: 0, note: "Push keys are not set up" });

  const db = createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, { auth: { persistSession: false } });
  const data = await db.rpc("reminder_data", { secret });
  if (data.error) return new Response("Could not read reminders", { status: 500 });

  const due = dueReminders(data.data as ReminderFamily[], new Date());
  if (!due.length) return Response.json({ due: 0, sent: 0 });

  const claimed = await db.rpc("claim_reminders", { secret, claims: due.map(({ device_id, key }) => ({ device_id, key })) });
  if (claimed.error) return new Response("Could not claim reminders", { status: 500 });

  const byKey = new Map(due.map((r) => [`${r.device_id} ${r.key}`, r]));
  const gone: string[] = [];
  let sent = 0;
  for (const target of claimed.data as { device_id: string; key: string; endpoint: string; p256dh: string; auth_key: string }[]) {
    const r = byKey.get(`${target.device_id} ${target.key}`)!;
    const result = await sendPush(target, { title: r.title, body: r.body, url: r.url, tag: r.key });
    if (result === "sent") sent++;
    if (result === "gone") gone.push(target.device_id);
  }
  if (gone.length) await db.rpc("forget_push_devices", { secret, ids: [...new Set(gone)] });
  return Response.json({ due: due.length, sent });
}

export const GET = run;
export const POST = run;
