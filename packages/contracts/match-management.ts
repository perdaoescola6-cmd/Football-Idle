import type { CardEdition, FootballMatch } from "./brasfoot.js";
/** Server and presentation share the clock; the browser never supplies elapsed time. */
export function playingMinute(match: FootballMatch, now: number): number {
  return Math.max(
    0,
    Math.min(
      90,
      ((match.pausedAt ?? now) - match.startAt - (match.totalPausedMs ?? 0)) /
        1000,
    ),
  );
}
/** Experimental, match-local condition. Every next fixture starts at 100%. */
export function playerEnergy(
  card: CardEdition,
  minute: number,
  entered = 0,
): number {
  const rate =
    card.position === "GOL"
      ? 0.18
      : 0.5 + (100 - (card.attributes?.physical ?? card.rating)) * 0.004;
  return Math.max(35, Math.round(100 - Math.max(0, minute - entered) * rate));
}
export function conditionMultiplier(energy: number) {
  return 0.75 + (0.25 * Math.max(35, Math.min(100, energy))) / 100;
}
