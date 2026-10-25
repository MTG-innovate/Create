import type { MomentType } from "./moments";
import { VISIT_KINDS, type VisitKind } from "./visits";

// JOSIA Care's care journeys. Each person receiving care follows one journey
// (children.journey), and the journey decides what the app offers for them:
// the Home tiles, the diary kinds, the visit types, the visit sheet and how the
// AI capture describes the person. Everything else is shared.
//
// Only Little Steps is built so far. Its settings are exactly what the app did
// before journeys existed, and src/lib/journeys.test.ts keeps it that way.

export const CARE_JOURNEYS = ["little_steps", "everyday_progress", "care_together"] as const;
export type CareJourney = (typeof CARE_JOURNEYS)[number];

export const DAY_TILES = ["meals", "night_feed", "last_meal", "diapers", "naps", "playtime", "pumping"] as const;
export type DayTile = (typeof DAY_TILES)[number];

export type JourneyConfig = {
  id: CareJourney;
  name: string;
  /** How the AI capture refers to the person: "a baby", "their baby". */
  aiPerson: { a: string; their: string };
  /** The tiles on Home and in the diary, in order. */
  dayTiles: readonly DayTile[];
  /** Tiles shown only once someone has logged that kind of moment lately, so they never clutter Home for families who do not need them. */
  whenUsed: readonly { tile: DayTile; moment: MomentType }[];
  /** The "<name>'s day" group of the + menu, in order. */
  dayMoments: readonly MomentType[];
  visitKinds: readonly VisitKind[];
  visitSheet: { weight: boolean; meals: boolean; nightFeeds: boolean };
};

export const LITTLE_STEPS: JourneyConfig = {
  id: "little_steps",
  name: "Little Steps",
  aiPerson: { a: "a baby", their: "their baby" },
  dayTiles: ["meals", "night_feed", "last_meal", "diapers", "naps", "playtime"],
  whenUsed: [{ tile: "pumping", moment: "pumping" }],
  dayMoments: ["meal", "night_feed", "diaper", "nap", "playtime", "medicine_given", "weigh_in", "pumping", "note"],
  visitKinds: VISIT_KINDS,
  visitSheet: { weight: true, meals: true, nightFeeds: true },
};

const BUILT: Partial<Record<CareJourney, JourneyConfig>> = { little_steps: LITTLE_STEPS };

/** The settings for a journey. Journeys not built yet use Little Steps until they are. */
export function journeyConfig(journey: CareJourney | null | undefined): JourneyConfig {
  return (journey && BUILT[journey]) || LITTLE_STEPS;
}

/** The day tiles for a person: the journey's own, plus any "when used" tile whose kind of moment was logged lately. */
export function dayTilesFor(journey: JourneyConfig, recent: readonly { type: MomentType }[]): DayTile[] {
  return [...journey.dayTiles, ...journey.whenUsed.filter((w) => recent.some((m) => m.type === w.moment)).map((w) => w.tile)];
}

/** Visit types for a family with these people: every type any of their journeys offers, in the usual order. */
export function visitKindsFor(journeys: (CareJourney | null | undefined)[]): VisitKind[] {
  const offered = new Set(journeys.flatMap((j) => journeyConfig(j).visitKinds));
  return VISIT_KINDS.filter((k) => offered.has(k));
}
