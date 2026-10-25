"use server";

import { canEdit } from "@/lib/access";
import {
  CAPTURE,
  MAX_PHOTO_BYTES,
  MAX_TEXT,
  PHOTO_TYPES,
  THERAPY_KINDS,
  isCaptureMode,
  nurseDraft,
  therapyDraft,
  visitDraft,
  type NurseDraft,
  type VisitDraft,
} from "@/lib/capture";
import { CaptureError, claudeReady, extract, type Photo } from "@/lib/claude";
import { todayIn } from "@/lib/dates";
import { journeyConfig } from "@/lib/journeys";
import { getFamily } from "@/lib/session";
import type { Visit } from "@/lib/visits";
import { loadVisits } from "@/lib/visits-data";

export type CaptureState = {
  error?: string;
  nurse?: NurseDraft;
  visit?: VisitDraft;
  /** The visit already planned for that day and kind, which the draft fills in. */
  match?: Visit | null;
};

const SORRY: Record<CaptureError["why"], string> = {
  busy: "Too many requests right now. Wait a minute and try again, or type it in.",
  photo: "That photo could not be read. Try a clearer photo or paste the text.",
  unreadable: "Could not sort that. Try again, or type it in.",
};

/** "Sort it for me": Claude drafts, and the person checks the draft before anything saves. */
export async function sortCapture(_: CaptureState, form: FormData): Promise<CaptureState> {
  const mode = form.get("mode");
  const familyId = String(form.get("familyId") ?? "");
  if (!isCaptureMode(mode)) return { error: "Something went wrong. Please try again." };
  const { family, children, me } = await getFamily(familyId);
  if (!canEdit(me, CAPTURE[mode].area)) return { error: "You can see this, but not add to it." };
  if (!claudeReady()) return { error: "Claude is not set up for JOSIA Care yet, so type it in instead." };

  const text = String(form.get("text") ?? "").trim().slice(0, MAX_TEXT);
  const file = form.get("photo");
  const hasPhoto = CAPTURE[mode].photo && file instanceof File && file.size > 0;
  if (!text && !hasPhoto) return { error: CAPTURE[mode].photo ? "Paste the text or add a photo first." : "Add what they told you first." };

  let photo: Photo | null = null; // passed straight to Claude, never stored
  if (hasPhoto) {
    const f = file as File;
    if (f.size > MAX_PHOTO_BYTES || !(PHOTO_TYPES as readonly string[]).includes(f.type)) {
      return { error: "That photo could not be read. Try a smaller photo or paste the text." };
    }
    photo = { mediaType: f.type as Photo["mediaType"], base64: Buffer.from(await f.arrayBuffer()).toString("base64") };
  }

  const today = todayIn(family.time_zone);
  const kindAsked = String(form.get("kind") ?? "");
  const child = children.find((c) => c.id === form.get("childId")) ?? children[0];
  const childId = child.id;
  const person = journeyConfig(child.journey).aiPerson;
  const raw = text || "(from a photo)";

  try {
    if (mode === "nurse") {
      const r = await extract("nurse", { text, photo, kind: "", today, person });
      return { nurse: nurseDraft(r, raw, { today, now: String(form.get("now") ?? ""), unit: family.feed_unit }) };
    }
    const draft =
      mode === "therapy"
        ? therapyDraft(await extract("therapy", { text, photo, kind: kindAsked, today, person }), (THERAPY_KINDS as readonly string[]).includes(kindAsked) ? kindAsked : THERAPY_KINDS[0], today)
        : visitDraft(await extract("visit", { text, photo, kind: kindAsked, today, person }), kindAsked, today);
    const { visits } = await loadVisits(family.id, draft.date, draft.date);
    const match = visits.find((v) => v.kind === draft.kind && v.child_id === childId) ?? null;
    // Keep the provider the family already has on the planned visit.
    if (match?.provider) delete draft.fields.provider;
    if (match) delete draft.fields.title;
    if (draft.next) {
      const planned = await loadVisits(family.id, draft.next.date, draft.next.date);
      if (planned.visits.some((v) => v.kind === draft.next!.kind)) draft.next = null;
      else if (!draft.next.provider && match?.provider) draft.next.provider = match.provider;
    }
    return { visit: draft, match };
  } catch (e) {
    if (e instanceof CaptureError) return { error: SORRY[e.why] };
    throw e;
  }
}
