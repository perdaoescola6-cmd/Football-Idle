import type { CardEdition, CardAttributes } from "./brasfoot.js";
import { attributeNames, ovrWeights, roleNames } from "./card-model.ts";
const labels: Record<string, Partial<Record<keyof CardAttributes, string>>> = {
  GOL: {
    reflexes: "Goleiro de reflexos",
    handling: "Goleiro seguro",
    positioning: "Goleiro posicional",
    diving: "Defensor acrobático",
    kicking: "Iniciador de jogadas",
  },
  LAT: {
    pace: "Lateral de profundidade",
    passing: "Lateral apoiador",
    defending: "Lateral marcador",
    dribbling: "Lateral de condução",
    physical: "Lateral de força",
  },
  ZAG: {
    defending: "Zagueiro de cobertura",
    physical: "Zagueiro de imposição",
    passing: "Zagueiro construtor",
    pace: "Zagueiro de recuperação",
  },
  VOL: {
    defending: "Volante de proteção",
    passing: "Volante organizador",
    physical: "Volante de combate",
    dribbling: "Volante de condução",
    pace: "Volante de mobilidade",
  },
  MEI: {
    passing: "Meia armador",
    dribbling: "Meia criativo",
    finishing: "Meia finalizador",
    pace: "Meia de chegada",
    physical: "Meia de sustentação",
  },
  PON: {
    pace: "Ponta veloz",
    dribbling: "Ponta driblador",
    finishing: "Ponta finalizador",
    passing: "Ponta criador",
  },
  ATA: {
    finishing: "Atacante finalizador",
    pace: "Atacante de profundidade",
    physical: "Atacante de referência",
    dribbling: "Atacante de mobilidade",
    passing: "Atacante associativo",
  },
};
export function playerArchetype(card: CardEdition) {
  const role =
    card.role ??
    (card.position === "GOL"
      ? "GOL"
      : card.position === "DEF"
        ? "ZAG"
        : card.position === "MEI"
          ? "MEI"
          : "ATA");
  const keys = Object.keys(ovrWeights[role]) as (keyof CardAttributes)[];
  if (!card.attributes)
    return {
      label: roleNames[role],
      strengths: [] as { label: string; value: number }[],
      development: null as { label: string; value: number } | null,
    };
  const sorted = [...keys].sort(
    (a, b) => card.attributes![b] - card.attributes![a],
  );
  const weakest = sorted.at(-1)!;
  return {
    label: labels[role]?.[sorted[0]] ?? roleNames[role],
    strengths: sorted
      .slice(0, 2)
      .map((k) => ({ label: attributeNames[k], value: card.attributes![k] })),
    development: {
      label: attributeNames[weakest],
      value: card.attributes[weakest],
    },
  };
}
/** Descriptive labels derived from existing game attributes, not extra modifiers or real-world claims. */
export function playerSpecialties(card: CardEdition): string[] {
  const keys: (keyof CardAttributes)[] =
    card.position === "GOL"
      ? ["reflexes", "handling", "positioning", "diving", "kicking"]
      : card.position === "DEF"
        ? ["defending", "physical", "pace", "passing"]
        : card.position === "MEI"
          ? ["passing", "dribbling", "pace", "finishing"]
          : ["finishing", "pace", "physical", "dribbling"];
  if (!card.attributes) return [];
  return keys
    .sort((a, b) => card.attributes![b] - card.attributes![a])
    .slice(0, 2)
    .map((key) => attributeNames[key]);
}
