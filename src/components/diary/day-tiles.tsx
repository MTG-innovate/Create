import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Bubble } from "@/components/icons";
import { fmtDay, fmtTime } from "@/lib/dates";
import type { DayTile } from "@/lib/journeys";
import { ago, fmtAmount, type DaySummary, type MomentType, type Unit } from "@/lib/moments";
import styles from "./diary.module.css";

export const newMomentHref = (familyId: string, type: MomentType, date: string, childId: string, next: string) =>
  `/f/${familyId}/diary/new?${new URLSearchParams({ type, date, child: childId, next })}`;

/** The person's day as friendly tiles (the prototype's dayTiles). Tapping a tile adds that kind of moment. */
export function DayTiles({
  tiles,
  summary,
  unit,
  childName,
  lastMealMinutes,
  addHref,
}: {
  /** Which tiles, in order: the person's journey decides. */
  tiles: readonly DayTile[];
  summary: DaySummary;
  unit: Unit;
  childName: string;
  lastMealMinutes: number | null;
  /** Where tapping a tile goes, or null when this person cannot add that kind of moment. */
  addHref: (type: MomentType) => string | null;
}) {
  const { meals, nightFeed: nf, lastMeal, diapers, naps, play } = summary;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const tile: Record<DayTile, ReactNode> = {
    meals: (
      <Tile href={addHref("meal")} icon="meal" color="--feed" label="Meals"
        value={meals.total ? fmtAmount(meals.total, unit) : "Nothing yet"}
        detail={meals.total ? (meals.fromNurse ? `From ${childName}'s nurse` : plural(meals.count, "meal")) : "Tap to add one"} />
    ),
    night_feed: (
      <Tile href={addHref("night_feed")} icon="night_feed" color="--sleep" label="Night feed"
        value={nf ? (nf.details.total ? `${nf.details.total} ${nf.details.unit ?? "ml"}` : "Logged") : "Not yet"}
        detail={nf ? String(nf.details.went ?? (nf.time ? `Started ${fmtTime(nf.time)}` : "")) : "Tap when it starts"} />
    ),
    last_meal: (
      <Tile href={addHref("meal")} icon="meal" color="--feed" label="Last meal"
        value={lastMeal ? fmtTime(lastMeal.time) || fmtDay(lastMeal.date) : "Not yet"}
        detail={lastMealMinutes != null ? ago(lastMealMinutes) : ""} />
    ),
    diapers: (
      <Tile href={addHref("diaper")} icon="diaper" color="--diaper" label="Diapers"
        value={diapers.count ? String(diapers.count) : "Not yet"}
        detail={diapers.count ? `${diapers.wet} wet, ${diapers.dirty} dirty` : ""} />
    ),
    naps: (
      <Tile href={addHref("nap")} icon="nap" color="--sleep" label="Naps"
        value={naps.count ? (naps.hours ? `${Math.round(naps.hours * 10) / 10} hours` : String(naps.count)) : "Not yet"}
        detail="" />
    ),
    playtime: (
      <Tile href={addHref("playtime")} icon="playtime" color="--exercise" label="Playtime"
        value={play.count ? (play.minutes ? `${play.minutes} min` : String(play.count)) : "Not yet"}
        detail={play.count ? plural(play.count, "time") : ""} />
    ),
  };

  return (
    <div className={styles.tiles}>
      {tiles.map((t) => (
        <Fragment key={t}>{tile[t]}</Fragment>
      ))}
    </div>
  );
}

function Tile(props: { href: string | null; icon: string; color: string; label: string; value: string; detail: string }) {
  const body: ReactNode = (
    <>
      <Bubble name={props.icon} color={props.color} size={32} />
      <span className={styles.tk}>{props.label}</span>
      <span className={styles.tv}>{props.value}</span>
      {props.detail ? <span className={styles.td}>{props.detail}</span> : null}
    </>
  );
  return props.href ? (
    <Link className={styles.tile} href={props.href} aria-label={`${props.label}: ${props.value}. Add one`}>
      {body}
    </Link>
  ) : (
    <div className={styles.tile}>{body}</div>
  );
}
