import { attributeKeys, type Athlete, type AthleteFilter } from "./index.ts";
export const naturalOvr = (a: Athlete) =>
  Math.floor(attributeKeys.reduce((s, k) => s + a.caps[k], 0) / 6);
export const birthOvr = (a: Athlete) =>
  a.birthOvr ??
  (a.origin === "STARTER"
    ? 20
    : Math.floor(
        attributeKeys.reduce((s, k) => s + Math.floor(a.caps[k] * 0.35), 0) / 6,
      ));
export const npcPrice = (a: Athlete) =>
  a.npcValue ?? String(12 + birthOvr(a) + Number(a.rarity.slice(1)) * 8);
export interface RosterContext {
  lineup: string[];
  training: string[];
  locked: string[];
  active: string[];
}
export function unavailableReason(a: Athlete, c: RosterContext): string | null {
  if (a.protected) return "Protegido";
  if (c.lineup.includes(a.id)) return "Titular";
  if (c.training.includes(a.id)) return "Em treinamento";
  if (c.locked.includes(a.id)) return "Anunciado no P2P";
  if (c.active.includes(a.id)) return "Em partida";
  return null;
}
export function matchesFilter(
  a: Athlete,
  f: AthleteFilter,
  c: RosterContext,
): boolean {
  const pot = naturalOvr(a);
  return (
    (!f.search ||
      a.displayName
        .toLocaleLowerCase("pt-BR")
        .includes(f.search.toLocaleLowerCase("pt-BR"))) &&
    (!f.position || a.position === f.position) &&
    (!f.rarity || a.rarity === f.rarity) &&
    (!f.storage || (a.storage ?? "COLLECTION") === f.storage) &&
    (!f.role ||
      f.role === "ALL" ||
      (f.role === "STARTER"
        ? c.lineup.includes(a.id)
        : !c.lineup.includes(a.id))) &&
    (f.minOvr === undefined || a.ovr >= f.minOvr) &&
    (f.maxOvr === undefined || a.ovr <= f.maxOvr) &&
    (f.minPotential === undefined || pot >= f.minPotential) &&
    (f.maxPotential === undefined || pot <= f.maxPotential) &&
    (!f.minLevel || BigInt(a.level) >= BigInt(f.minLevel)) &&
    (!f.maxLevel || BigInt(a.level) <= BigInt(f.maxLevel)) &&
    (!f.region || a.birthRegion === f.region) &&
    (f.protected === undefined || !!a.protected === f.protected) &&
    (!f.eligibleOnly || !unavailableReason(a, c))
  );
}
