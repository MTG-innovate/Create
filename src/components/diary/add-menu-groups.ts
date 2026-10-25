import { canEdit } from "@/lib/access";
import { MOMENTS, type MomentType } from "@/lib/moments";
import type { Member } from "@/lib/types";
import type { AddItem } from "./add-menu";
import { newMomentHref } from "./day-tiles";

const DAY: MomentType[] = ["meal", "night_feed", "diaper", "nap", "playtime", "medicine_given", "weigh_in", "note"];

/** The "Add a moment" menu, limited to what this person can add. */
export function addMenuGroups(opts: { familyId: string; me: Member; childName: string; childId: string; date: string; next: string }) {
  const { familyId, me, childName, childId, date, next } = opts;
  const moment = (t: MomentType): AddItem[] =>
    canEdit(me, MOMENTS[t].area)
      ? [{ label: MOMENTS[t].label, icon: t, color: MOMENTS[t].color, href: newMomentHref(familyId, t, date, childId, next) }]
      : [];
  const capture = (mode: string) => `/f/${familyId}/capture/${mode}?${new URLSearchParams({ child: childId, next })}`;
  return [
    { title: `${childName}'s day`, items: DAY.flatMap(moment) },
    {
      title: `From ${childName}'s helpers`,
      items: [
        ...(canEdit(me, "nurse_notes") ? [{ label: "Nurse text", icon: "nurse_note", color: "--nurse", href: capture("nurse") }] : []),
        ...(canEdit(me, "visits")
          ? [
              { label: "Therapy handoff", icon: "therapy", color: "--exercise", href: capture("therapy") },
              { label: "Doctor visit", icon: "visit", color: "--weight", href: capture("visit") },
              { label: "Plan a visit", icon: "visit", color: "--accent", href: `/f/${familyId}/visits/new?${new URLSearchParams({ date, next })}` },
            ]
          : []),
      ],
    },
    {
      title: "Good things",
      items: [
        ...(canEdit(me, "wins")
          ? [{ label: "A win", icon: "win", color: "--accent", href: `/f/${familyId}/journey/wins/new?${new URLSearchParams({ child: childId, next })}` }]
          : []),
        ...(canEdit(me, "questions")
          ? [{ label: "A question", icon: "question", color: "--sleep", href: `/f/${familyId}/helpers/questions/new?${new URLSearchParams({ child: childId, next })}` }]
          : []),
      ],
    },
  ];
}
