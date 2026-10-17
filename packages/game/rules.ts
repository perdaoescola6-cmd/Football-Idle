import {
  attributeKeys,
  type Athlete,
  type Attributes,
  type Rarity,
} from "../contracts/index.ts";
export const RULES_VERSION = "RETRO-E2";
export const MATCH_MS = 90_000;
export const LEASE_MS = 30_000;
export const RENEW_MS = 600_000;
export const OFFLINE_MS = 86_400_000;
export const DENOMINATOR = 180_000n;
export const rarityWeights = [74485, 20000, 5000, 500, 15] as const;
export const rarityCaps: Record<Rarity, [number, number]> = {
  P1: [45, 60],
  P2: [61, 72],
  P3: [73, 84],
  P4: [85, 93],
  P5: [94, 99],
};
export function rarityForRoll(roll: number): Rarity {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100000)
    throw new RangeError("Invalid rarity roll");
  let boundary = 0;
  for (let i = 0; i < rarityWeights.length; i++) {
    boundary += rarityWeights[i];
    if (roll < boundary) return `P${i + 1}` as Rarity;
  }
  throw new Error("Invalid weights");
}
export function threshold(level: bigint): bigint {
  return 100n * (level - 1n) + (25n * (level - 1n) * (level - 2n)) / 2n;
}
export function levelForXp(xp: bigint): bigint {
  if (xp < 0n) throw new RangeError("Negative XP");
  let low = 1n,
    high = 2n;
  while (threshold(high) <= xp) high *= 2n;
  while (low + 1n < high) {
    const mid = (low + high) / 2n;
    if (threshold(mid) <= xp) low = mid;
    else high = mid;
  }
  return low;
}
export function ovr(attributes: Attributes): number {
  return Math.floor(
    attributeKeys.reduce((sum, key) => sum + attributes[key], 0) / 6,
  );
}
export function addAthleteXp(athlete: Athlete, amount: bigint): void {
  const before = BigInt(athlete.level);
  athlete.xpTotal = (BigInt(athlete.xpTotal) + amount).toString();
  const level = levelForXp(BigInt(athlete.xpTotal));
  const growth = Number(level - before > 99n ? 99n : level - before);
  for (const key of attributeKeys)
    athlete.attributes[key] = Math.min(
      athlete.caps[key],
      athlete.attributes[key] + growth,
    );
  athlete.level = level.toString();
  athlete.ovr = ovr(athlete.attributes);
}
