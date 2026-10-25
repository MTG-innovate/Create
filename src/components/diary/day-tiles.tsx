import Link from "next/link";
import type { ReactNode } from "react";
import { Bubble } from "@/components/icons";
import { fmtDay, fmtTime } from "@/lib/dates";
import { ago, fmtAmount, type DaySummary, type MomentType, type Unit } from "@/lib/moments";
import styles from "./diary.module.css";

export const newMomentHref = (familyId: string, type: MomentType, date: string, childId: string, next: string) =>
  `/f/${familyId}/diary/new?${new URLSearchParams({ type, date, child: childId, next })}`;

/** The child's day as friendly tiles (the prototype's dayTiles). Tapping a tile adds that kind of moment. */
export function DayTiles({
  summary,
  unit,
  childName,
  lastMealMinutes,
  addHref,
}: {
  summary: DaySummary;
  unit: Unit;
  childName: string;
  lastMealMinutes: number | null;
  /** Where tapping a tile goes, or null when this person cannot add that kind of moment. */
  addHref: (type: MomentType) => string | null;
}) {
  const { meals, nightFeed: nf, lastMeal, diapers, naps, play } = summary;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className={styles.tiles}>
      <Tile href={addHref("meal")} icon="meal" color="--feed" label="Meals"
        value={meals.total ? fmtAmount(meals.total, unit) : "Nothing yet"}
        detail={meals.total ? (meals.fromNurse ? `From ${childName}'s nurse` : plural(meals.count, "meal")) : "Tap to add one"} />
      <Tile href={addHref("night_feed")} icon="night_feed" color="--sleep" label="Night feed"
        value={nf ? (nf.details.total ? `${nf.details.total} ${nf.details.unit ?? "ml"}` : "Logged") : "Not yet"}
        detail={nf ? String(nf.details.went ?? (nf.time ? `Started ${fmtTime(nf.time)}` : "")) : "Tap when it starts"} />
      <Tile href={addHref("meal")} icon="meal" color="--feed" label="Last meal"
        value={lastMeal ? fmtTime(lastMeal.time) || fmtDay(lastMeal.date) : "Not yet"}
        detail={lastMealMinutes != null ? ago(lastMealMinutes) : ""} />
      <Tile href={addHref("diaper")} icon="diaper" color="--diaper" label="Diapers"
        value={diapers.count ? String(diapers.count) : "Not yet"}
        detail={diapers.count ? `${diapers.wet} wet, ${diapers.dirty} dirty` : ""} />
      <Tile href={addHref("nap")} icon="nap" color="--sleep" label="Naps"
        value={naps.count ? (naps.hours ? `${Math.round(naps.hours * 10) / 10} hours` : String(naps.count)) : "Not yet"}
        detail="" />
      <Tile href={addHref("playtime")} icon="playtime" color="--exercise" label="Playtime"
        value={play.count ? (play.minutes ? `${play.minutes} min` : String(play.count)) : "Not yet"}
        detail={play.count ? plural(play.count, "time") : ""} />
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
