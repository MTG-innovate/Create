"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refreshes the page when anyone in the family changes one of these tables,
 * so everyone sees the same week within seconds. Supabase Realtime only sends
 * changes this person is allowed to read.
 */
export function LiveRefresh({ familyId, tables }: { familyId: string; tables: string[] }) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase.channel(`family-${familyId}-${key}`);
    for (const table of key.split(",")) {
      // Every table names its family in family_id, except families itself (id).
      const column = table === "families" ? "id" : "family_id";
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `${column}=eq.${familyId}` }, refresh);
    }
    // Realtime reports a rejected subscription here, after the channel itself has joined.
    channel.on("system", {}, (message: { status?: string; message?: string }) => {
      if (message.status && message.status !== "ok") console.warn(`Live updates: ${message.message ?? message.status}`);
    });

    let stopped = false;
    // Realtime checks row level security as the signed-in person, so it needs
    // their token before subscribing. Without it, it quietly sends nothing.
    supabase.auth.getSession().then(({ data }) => {
      if (stopped) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status, err) => {
        // Closing on the way to another page is expected; anything else is worth a warning.
        if (status !== "SUBSCRIBED" && !stopped) console.warn(`Live updates: ${status}`, err?.message ?? "");
      });
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [familyId, key, router]);

  return null;
}
