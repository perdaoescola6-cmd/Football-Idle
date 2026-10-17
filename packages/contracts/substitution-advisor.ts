import type { FootballView } from "./brasfoot.js";
import { effectiveCard } from "./card-model.ts";
import { playerEnergy, conditionMultiplier } from "./match-management.ts";
export function substitutionAdvice(f: FootballView, minute: number) {
  const m = f.match;
  if (!m || m.pausedAt === undefined || (m.substitutions?.length ?? 0) >= 5)
    return [];
  const team = m.homeAI ? m.away : m.home,
    ids = (m.homeAI ? m.awayOwnedIds : m.homeOwnedIds) ?? [],
    catalog = new Map(f.catalog.map((c) => [c.id, c]));
  const options: {
    outId: string;
    inId: string;
    outName: string;
    inName: string;
    energy: number;
    before: number;
    after: number;
    gain: number;
    sector: string;
  }[] = [];
  for (const [i, out] of team.entries()) {
    if (!ids[i]) continue;
    const entry =
      m.participants?.find((p) => p.ownedId === ids[i] && p.to === undefined)
        ?.from ?? 0;
    const energy = playerEnergy(out, minute, entry),
      before = out.rating * conditionMultiplier(energy);
    for (const id of f.bench) {
      if (
        f.listed?.includes(id) ||
        m.participants?.some((p) => p.ownedId === id)
      )
        continue;
      const owned = f.cards.find((c) => c.id === id),
        base = owned ? catalog.get(owned.editionId) : undefined;
      if (!owned || !base || base.position !== out.position) continue;
      const incoming = effectiveCard(base, owned),
        gain = incoming.rating - before;
      if (gain <= 0) continue;
      options.push({
        outId: ids[i],
        inId: id,
        outName: out.player,
        inName: incoming.player,
        energy,
        before,
        after: incoming.rating,
        gain,
        sector: out.position,
      });
    }
  }
  const usedOut = new Set<string>(),
    usedIn = new Set<string>();
  return options
    .sort(
      (a, b) =>
        b.gain - a.gain ||
        a.energy - b.energy ||
        a.outId.localeCompare(b.outId) ||
        a.inId.localeCompare(b.inId),
    )
    .filter((x) => {
      if (usedOut.has(x.outId) || usedIn.has(x.inId)) return false;
      usedOut.add(x.outId);
      usedIn.add(x.inId);
      return true;
    })
    .slice(0, Math.min(3, 5 - (m.substitutions?.length ?? 0)));
}
