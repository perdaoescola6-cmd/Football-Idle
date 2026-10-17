import type {
  CardAttributes,
  CardEdition,
  OwnedCard,
  PlayerRole,
} from "./brasfoot.js";
export const attributeNames: Record<keyof CardAttributes, string> = {
  pace: "Velocidade",
  finishing: "Finalização",
  passing: "Passe",
  dribbling: "Drible",
  defending: "Defesa",
  physical: "Físico",
  diving: "Mergulho",
  handling: "Segurança",
  reflexes: "Reflexos",
  kicking: "Reposição",
  positioning: "Posicionamento",
};
export const roleNames: Record<PlayerRole, string> = {
  GOL: "Goleiro",
  LAT: "Lateral",
  ZAG: "Zagueiro",
  VOL: "Volante",
  MEI: "Meia",
  PON: "Ponta",
  ATA: "Atacante",
};
export const ovrWeights: Record<
  PlayerRole,
  Partial<Record<keyof CardAttributes, number>>
> = {
  GOL: {
    diving: 0.2,
    handling: 0.2,
    reflexes: 0.25,
    kicking: 0.1,
    positioning: 0.25,
  },
  LAT: {
    pace: 0.25,
    passing: 0.2,
    dribbling: 0.1,
    defending: 0.3,
    physical: 0.15,
  },
  ZAG: { defending: 0.5, physical: 0.25, passing: 0.1, pace: 0.15 },
  VOL: {
    defending: 0.3,
    passing: 0.3,
    physical: 0.2,
    dribbling: 0.1,
    pace: 0.1,
  },
  MEI: {
    passing: 0.4,
    dribbling: 0.3,
    finishing: 0.1,
    pace: 0.1,
    physical: 0.1,
  },
  PON: { pace: 0.3, dribbling: 0.3, finishing: 0.25, passing: 0.15 },
  ATA: {
    finishing: 0.5,
    pace: 0.15,
    dribbling: 0.15,
    physical: 0.15,
    passing: 0.05,
  },
};
export function ovr(attributes: CardAttributes, role: PlayerRole) {
  return Math.round(
    Object.entries(ovrWeights[role]).reduce(
      (sum, [key, weight]) =>
        sum + attributes[key as keyof CardAttributes] * weight!,
      0,
    ),
  );
}
export function stableNumber(text: string) {
  let n = 2166136261;
  for (const char of text) {
    n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return n;
}
export function gameAttributes(
  rating: number,
  role: PlayerRole,
  seed: number,
): CardAttributes {
  const base = Math.max(25, rating - 18);
  const attrs: CardAttributes = {
    pace: base,
    finishing: base,
    passing: base,
    dribbling: base,
    defending: base,
    physical: base,
    diving: Math.max(15, base - 20),
    handling: Math.max(15, base - 20),
    reflexes: Math.max(15, base - 20),
    kicking: Math.max(15, base - 20),
    positioning: Math.max(15, base - 20),
  };
  const keys = Object.keys(ovrWeights[role]) as (keyof CardAttributes)[];
  for (const [i, key] of keys.entries())
    attrs[key] = Math.max(
      20,
      Math.min(99, rating + ((seed >>> (i * 4)) % 11) - 5),
    );
  const priority = [...keys].sort(
    (a, b) => (ovrWeights[role][b] ?? 0) - (ovrWeights[role][a] ?? 0),
  );
  for (let step = 0; step < 1000 && ovr(attrs, role) !== rating; step++) {
    const delta = ovr(attrs, role) < rating ? 1 : -1;
    const key = priority.find((k) =>
      delta > 0 ? attrs[k] < 99 : attrs[k] > 1,
    );
    if (!key) break;
    attrs[key] += delta;
  }
  return attrs;
}
export function effectiveCard(
  card: CardEdition,
  owned?: OwnedCard,
): CardEdition {
  if (!owned?.upgrades || !card.attributes) return card;
  const attributes = { ...card.attributes };
  for (const key of Object.keys(attributes) as (keyof CardAttributes)[])
    attributes[key] = Math.min(99, attributes[key] + owned.upgrades);
  return {
    ...card,
    attributes,
    rating: ovr(
      attributes,
      card.role ??
        (card.position === "DEF"
          ? "ZAG"
          : card.position === "GOL"
            ? "GOL"
            : card.position === "MEI"
              ? "MEI"
              : "ATA"),
    ),
  };
}
export function playerIdentity(card: CardEdition) {
  return card.playerId ?? card.id;
}
