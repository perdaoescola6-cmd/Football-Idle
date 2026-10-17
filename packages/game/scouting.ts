import type {
  Athlete,
  ScoutingConfig,
  ScoutCondition,
} from "../contracts/index.js";
import { naturalOvr, birthOvr } from "../contracts/roster.ts";
export function defaultScouting(): ScoutingConfig {
  return {
    enabled: true,
    fallback: "DEPOT",
    rareWarningPotential: 85,
    rules: [
      {
        id: "rare-safety",
        name: "Talentos P4 e P5",
        enabled: true,
        mode: "ANY",
        conditions: [
          { field: "rarity", op: "EQ", value: "P4" },
          { field: "rarity", op: "EQ", value: "P5" },
        ],
        destination: "COLLECTION",
        protect: true,
      },
      {
        id: "natural-70",
        name: "Teto natural de 70+",
        enabled: true,
        mode: "ALL",
        conditions: [{ field: "potential", op: "GTE", value: "70" }],
        destination: "COLLECTION",
        protect: false,
      },
    ],
  };
}
function satisfies(a: Athlete, c: ScoutCondition) {
  const value =
    c.field === "potential"
      ? naturalOvr(a)
      : c.field === "birthOvr"
        ? birthOvr(a)
        : c.field === "rarity"
          ? a.rarity
          : c.field === "position"
            ? a.position
            : a.caps[c.field];
  if (c.op === "EQ") return String(value) === c.value;
  return (
    typeof value === "number" &&
    (c.op === "GTE" ? value >= Number(c.value) : value <= Number(c.value))
  );
}
export function organizeDrop(a: Athlete, config: ScoutingConfig): string {
  if (a.rarity === "P5") {
    a.storage = "COLLECTION";
    a.protected = true;
    return (a.scoutReason = "Segurança obrigatória: talento P5");
  }
  if (!config.enabled) {
    a.storage = "COLLECTION";
    return (a.scoutReason = "Avaliador desativado: Coleção");
  }
  const rule = config.rules.find(
    (r) =>
      r.enabled &&
      r.conditions.length > 0 &&
      (r.mode === "ALL"
        ? r.conditions.every((c) => satisfies(a, c))
        : r.conditions.some((c) => satisfies(a, c))),
  );
  a.storage = rule?.destination ?? config.fallback;
  if (rule?.protect) a.protected = true;
  return (a.scoutReason = rule
    ? `Regra: ${rule.name}`
    : `Destino padrão: ${a.storage === "COLLECTION" ? "Coleção" : "Depósito"}`);
}
