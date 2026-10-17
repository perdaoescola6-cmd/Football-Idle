import type {
  CardEdition,
  Position,
  PlayerRole,
  PlayerProfile,
} from "../contracts/brasfoot.js";
import roster from "./data/fifa-2022.json" with { type: "json" };
import supplements from "./data/brazil-profile-supplements.json" with { type: "json" };
import { gameAttributes, stableNumber } from "../contracts/card-model.js";
const source =
  "https://www.cbf.com.br/selecao-brasileira/noticias/detalhes/jogos-selecao-masculina/selecao-brasileira-e-convocada-para-jogos-contra-equador-e-paraguai-pelas-eliminatorias";
// Historical identity/position reference: Brazil call-up, 2024-08-23.
// Ratings and rarity are fictional game balance, not biographical assertions.
const entries: [string, Position, number, number][] = [
  ["Bento", "GOL", 0, 61],
  ["Danilo", "DEF", 0, 62],
  ["Wendell", "DEF", 0, 60],
  ["Beraldo", "DEF", 0, 63],
  ["Yan Couto", "DEF", 0, 62],
  ["André", "MEI", 0, 64],
  ["João Gomes", "MEI", 0, 63],
  ["Gerson", "MEI", 0, 64],
  ["Lucas Paquetá", "MEI", 0, 65],
  ["Luiz Henrique", "ATA", 0, 64],
  ["Pedro", "ATA", 0, 65],
  ["Guilherme Arana", "DEF", 1, 72],
  ["Gabriel Magalhães", "DEF", 1, 74],
  ["Estêvão", "ATA", 1, 73],
  ["Lucas Moura", "ATA", 1, 74],
  ["Ederson", "GOL", 2, 81],
  ["Éder Militão", "DEF", 2, 82],
  ["Bruno Guimarães", "MEI", 2, 82],
  ["Endrick", "ATA", 2, 80],
  ["Alisson", "GOL", 3, 89],
  ["Marquinhos", "DEF", 3, 88],
  ["Rodrygo", "ATA", 4, 94],
  ["Vinicius Junior", "ATA", 4, 96],
];
const rarities = ["Bronze", "Prata", "Ouro", "Lendário", "Fenômeno"] as const;
const legacy: CardEdition[] = entries.map(
  ([player, position, rarity, rating], i) => ({
    id: `BR24-${String(i + 1).padStart(3, "0")}`,
    player,
    position,
    rarity: rarities[rarity],
    rating,
    edition: "Seleção 2024 · edição experimental 1",
    source,
  }),
);
const iso2: Record<string, string> = {
  ARG: "AR",
  AUS: "AU",
  BEL: "BE",
  BRA: "BR",
  CMR: "CM",
  CAN: "CA",
  CRC: "CR",
  CRO: "HR",
  DEN: "DK",
  ECU: "EC",
  ENG: "GB",
  FRA: "FR",
  GER: "DE",
  GHA: "GH",
  IRN: "IR",
  JPN: "JP",
  KOR: "KR",
  MEX: "MX",
  MAR: "MA",
  NED: "NL",
  POL: "PL",
  POR: "PT",
  QAT: "QA",
  KSA: "SA",
  SEN: "SN",
  SRB: "RS",
  ESP: "ES",
  SUI: "CH",
  TUN: "TN",
  URU: "UY",
  USA: "US",
  WAL: "GB",
};
const flag = (code: string) =>
  [...(iso2[code] ?? "")]
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
const brazilMatches: Record<string, number> = {
  Danilo: 2,
  Pedro: 25,
  "Lucas Paquetá": 7,
  Ederson: 23,
  "Éder Militão": 14,
  "Bruno Guimarães": 17,
  Alisson: 1,
  Marquinhos: 4,
  Rodrygo: 21,
  "Vinicius Junior": 20,
};
const legacyRoles: PlayerRole[] = [
  "GOL",
  "LAT",
  "LAT",
  "ZAG",
  "LAT",
  "VOL",
  "VOL",
  "MEI",
  "MEI",
  "PON",
  "ATA",
  "LAT",
  "ZAG",
  "PON",
  "PON",
  "GOL",
  "ZAG",
  "VOL",
  "ATA",
  "GOL",
  "ZAG",
  "PON",
  "PON",
];
const title = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (c) => c.toLocaleUpperCase());
const displayName = (name: string) => {
  const words = name.split(" "),
    index = words.findIndex(
      (w) =>
        w !== w.toLocaleUpperCase() &&
        w.slice(1) === w.slice(1).toLocaleLowerCase(),
    );
  return title(
    index > 0
      ? [...words.slice(index), ...words.slice(0, index)].join(" ")
      : name,
  );
};
type SourcePlayer = (typeof roster)[number];
function profile(p: SourcePlayer): PlayerProfile {
  return {
    fullName: p.fullName,
    knownName: p.name,
    country: p.country,
    countryCode: p.countryCode,
    flag: flag(p.countryCode),
    birthDate: p.birthDate,
    club: p.club,
    referenceYear: 2022,
    heightCm: p.heightCm,
    preferredFoot: null,
    factualPosition: p.position,
    sourcePage: p.sourcePage,
    source: p.source,
    roleNote:
      "Posição ampla na fonte FIFA. Funções táticas e atributos são modelos do jogo; posições secundárias não documentadas.",
  };
}
const roleFor = (p: SourcePlayer): PlayerRole =>
  p.position === "GOL"
    ? "GOL"
    : p.position === "DEF"
      ? (p.heightCm ?? 185) < 180
        ? "LAT"
        : "ZAG"
      : p.position === "MEI"
        ? stableNumber(p.id) % 3 === 0
          ? "VOL"
          : "MEI"
        : stableNumber(p.id) % 2 === 0
          ? "PON"
          : "ATA";
const phenomenonIds = new Set([
  "WC22-ARG-10",
  "WC22-BRA-10",
  "WC22-FRA-10",
  "WC22-POR-07",
  "WC22-BEL-07",
  "WC22-CRO-10",
  "WC22-POL-09",
  "WC22-ENG-09",
  "WC22-SEN-10",
  "WC22-URU-09",
]);
export const catalog: CardEdition[] = [
  ...legacy.map((c, i) => {
    const original = brazilMatches[c.player]
      ? roster.find(
          (p) =>
            p.id ===
            `WC22-BRA-${String(brazilMatches[c.player]).padStart(2, "0")}`,
        )
      : undefined;
    const seed = stableNumber(c.id),
      role = legacyRoles[i];
    return {
      ...c,
      playerId: original?.id ?? c.id,
      profile: original
        ? profile(original)
        : {
            fullName: null,
            knownName: c.player,
            country: "Brasil",
            countryCode: "BRA",
            flag: flag("BRA"),
            birthDate: null,
            club: null,
            referenceYear: 2024,
            heightCm: null,
            preferredFoot: null,
            factualPosition: c.position,
            roleNote:
              "Posição ampla da convocação de 2024; função tática definida pelo jogo.",
          },
      role,
      secondaryRoles: [],
      attributes: gameAttributes(c.rating, role, seed),
      potential: Math.min(99, c.rating + 3),
      portraitSeed: seed,
    };
  }),
  ...roster.map((p) => {
    const seed = stableNumber(p.id),
      role = roleFor(p);
    const quality = phenomenonIds.has(p.id)
      ? 4
      : p.sourceCaps >= 80
        ? 3
        : p.sourceCaps >= 35
          ? 2
          : p.sourceCaps >= 12
            ? 1
            : 0;
    const rating =
      [60, 71, 81, 88, 94][quality] + (seed % [9, 8, 6, 5, 3][quality]);
    return {
      id: p.id,
      player: displayName(p.name),
      playerId: p.id,
      position: p.position as Position,
      rarity: rarities[quality],
      rating,
      edition: "Mundial 2022 · edição histórica V2",
      source: p.source,
      profile: profile(p),
      role,
      secondaryRoles: [],
      attributes: gameAttributes(rating, role, seed),
      potential: Math.min(99, rating + 3),
      portraitSeed: seed,
    };
  }),
];
const catalogById = new Map(catalog.map((c) => [c.id, c]));
const additional: Record<string, Partial<PlayerProfile>> = supplements;
for (const card of catalog) {
  const extra = additional[card.id];
  if (extra && card.profile) card.profile = { ...card.profile, ...extra };
}
export function edition(id: string) {
  const card = catalogById.get(id);
  if (!card) throw new Error("Unknown card edition");
  return card;
}
