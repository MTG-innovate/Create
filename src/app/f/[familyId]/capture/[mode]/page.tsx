import { notFound } from "next/navigation";
import { canEdit } from "@/lib/access";
import { CAPTURE, isCaptureMode } from "@/lib/capture";
import { claudeReady } from "@/lib/claude";
import { todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { suggestions } from "@/lib/moments-data";
import { visitKindsFor } from "@/lib/journeys";
import { getFamily } from "@/lib/session";
import { teamNames } from "@/lib/visits-data";
import { CaptureFlow } from "../capture-flow";

export default async function CapturePage({ params, searchParams }: PageProps<"/f/[familyId]/capture/[mode]">) {
  const { familyId, mode } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!isCaptureMode(mode) || !canEdit(me, CAPTURE[mode].area)) notFound();
  const child = children.find((c) => c.id === query.child) ?? children[0];
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: family.time_zone }).format(new Date());

  return (
    <>
      <h1>{CAPTURE[mode].title}</h1>
      <CaptureFlow
        familyId={family.id}
        mode={mode}
        kids={children.map((c) => ({ id: c.id, name: c.name }))}
        kinds={visitKindsFor(children.map((c) => c.journey))}
        childId={child.id}
        unit={family.feed_unit}
        today={todayIn(family.time_zone)}
        now={now}
        next={safeNext(query.next, mode === "nurse" ? `/f/${family.id}` : `/f/${family.id}/visits`)}
        claude={claudeReady()}
        team={await teamNames(family.id)}
        suggest={mode === "nurse" ? await suggestions(family.id) : { practice: [], medicines: [], team: [] }}
      />
    </>
  );
}
