export const rarities = [
  "Bronze",
  "Prata",
  "Ouro",
  "Lendário",
  "Fenômeno",
] as const;
export type CardRarity = (typeof rarities)[number];
export type Position = "GOL" | "DEF" | "MEI" | "ATA";
export interface CardEdition {
  id: string;
  player: string;
  position: Position;
  rarity: CardRarity;
  rating: number;
  edition: string;
  source: string;
  playerId?: string;
  profile?: PlayerProfile;
  role?: PlayerRole;
  secondaryRoles?: PlayerRole[];
  attributes?: CardAttributes;
  potential?: number;
  portraitSeed?: number;
}
export type PlayerRole = "GOL" | "LAT" | "ZAG" | "VOL" | "MEI" | "PON" | "ATA";
export interface PlayerProfile {
  fullName: string | null;
  knownName: string;
  country: string;
  countryCode: string;
  flag: string;
  birthDate: string | null;
  club: string | null;
  referenceYear: number;
  heightCm: number | null;
  preferredFoot: string | null;
  factualPosition: string;
  sourcePage?: number;
  source?: string;
  sources?: string[];
  verifiedAt?: string;
  roleNote: string;
}
export interface CardAttributes {
  pace: number;
  finishing: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  diving: number;
  handling: number;
  reflexes: number;
  kicking: number;
  positioning: number;
}
export interface PlayerPerformance {
  playerId: string;
  editionId: string;
  name: string;
  position: Position;
  role?: PlayerRole;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  passes: number;
  shots: number;
  ratingTotal: number;
  ratedMatches: number;
  lastClub: string;
  seasons: Record<
    string,
    {
      appearances: number;
      goals: number;
      assists: number;
      cleanSheets: number;
      minutes?: number;
      saves?: number;
      passes?: number;
      shots?: number;
      ratingTotal?: number;
      ratedMatches?: number;
    }
  >;
}
export interface OwnedCard {
  id: string;
  editionId: string;
  locked: boolean;
  storage: "COLLECTION" | "DEPOT";
  acquiredAt: number;
  upgrades?: number;
  clubHistory?: {
    clubId: string;
    name: string;
    at: number;
    kind: "ACQUIRED" | "TRANSFER";
  }[];
}
export interface PackDefinition {
  id: string;
  name: string;
  price: number;
  floors: number[];
  weights: number[];
}
export const PACK_VERSION = "packs-experimental-v1";
// Integer basis points: each table sums to exactly 10,000. Floors promote,
// never reroll or demote, so every slot retains its Fenômeno probability.
export const packs: PackDefinition[] = [
  {
    id: "basic",
    name: "Básico",
    price: 5000,
    floors: [1, 0, 0, 0, 0],
    weights: [7000, 2300, 600, 90, 10],
  },
  {
    id: "professional",
    name: "Profissional",
    price: 15000,
    floors: [2, 0, 0, 0, 0],
    weights: [5300, 3100, 1380, 200, 20],
  },
  {
    id: "premium",
    name: "Premium",
    price: 40000,
    floors: [2, 2, 0, 0, 0],
    weights: [3500, 3700, 2300, 460, 40],
  },
  {
    id: "stars",
    name: "Estrelas",
    price: 110000,
    floors: [3, 2, 0, 0, 0],
    weights: [2400, 3100, 3700, 730, 70],
  },
  {
    id: "superstars",
    name: "Superestrelas",
    price: 300000,
    floors: [3, 3, 2, 0, 0],
    weights: [1200, 2500, 4700, 1450, 150],
  },
];
export function validatePackDefinition(pack: PackDefinition) {
  if (
    !Number.isSafeInteger(pack.price) ||
    pack.price <= 0 ||
    pack.weights.length !== rarities.length ||
    Array.from(pack.weights).some(
      (weight) => !Number.isSafeInteger(weight) || weight < 0,
    ) ||
    pack.weights.reduce((sum, weight) => sum + weight, 0) !== 10000 ||
    pack.floors.length !== 5 ||
    Array.from(pack.floors).some(
      (floor) =>
        !Number.isInteger(floor) || floor < 0 || floor >= rarities.length,
    )
  )
    throw new RangeError("Invalid pack definition");
}
function validatePackSlot(pack: PackDefinition, slot: number) {
  validatePackDefinition(pack);
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5)
    throw new RangeError("Invalid pack slot");
}
export function packRarityIndex(
  pack: PackDefinition,
  slot: number,
  roll: number,
) {
  validatePackSlot(pack, slot);
  if (!Number.isInteger(roll) || roll < 0 || roll >= 10000)
    throw new RangeError("Invalid pack roll");
  let total = 0;
  const rolled = pack.weights.findIndex((weight) => (total += weight) > roll);
  return Math.max(pack.floors[slot], rolled);
}
export function slotOdds(pack: PackDefinition, slot: number) {
  validatePackSlot(pack, slot);
  return pack.weights.map((_, rarity) =>
    pack.weights.reduce(
      (sum, weight, rolled) =>
        sum + (Math.max(rolled, pack.floors[slot]) === rarity ? weight : 0),
      0,
    ),
  );
}
export function phenomenonChance(pack: PackDefinition) {
  validatePackDefinition(pack);
  if (pack.floors.includes(rarities.length - 1)) return 1;
  return 1 - (1 - pack.weights[4] / 10000) ** 5;
}
export interface Standing {
  id: string;
  name: string;
  ai: boolean;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
}
export interface Fixture {
  id: string;
  round: number;
  home: string;
  away: string;
  score?: [number, number];
  engineVersion?: string;
  statistics?: { home: TeamMatchStats; away: TeamMatchStats };
}
export interface Season {
  number: number;
  division: number;
  rulesVersion: string;
  round: number;
  table: Standing[];
  fixtures: Fixture[];
}
export interface FootballEvent {
  minute: number;
  type:
    | "KICKOFF"
    | "PASS"
    | "SAVE"
    | "GOAL"
    | "FULLTIME"
    | "SHOT"
    | "DRIBBLE"
    | "SUBSTITUTION";
  side: "HOME" | "AWAY";
  actor: string;
  x: number;
  y: number;
  actorId?: string;
  assistId?: string;
  assistName?: string;
  receiverId?: string;
  receiverName?: string;
  from?: { x: number; y: number };
  players?: {
    home: { x: number; y: number }[];
    away: { x: number; y: number }[];
  };
  narration?: string;
}
export interface FootballMatch {
  captainId?: string;
  pausedAt?: number;
  totalPausedMs?: number;
  substitutions?: {
    minute: number;
    outId: string;
    inId: string;
    side: "HOME" | "AWAY";
  }[];
  participants?: {
    card: CardEdition;
    ownedId?: string;
    side: "HOME" | "AWAY";
    from: number;
    to?: number;
  }[];
  id: string;
  fixtureId: string;
  startAt: number;
  endAt: number;
  home: CardEdition[];
  away: CardEdition[];
  homeName: string;
  awayName: string;
  homeAI: boolean;
  awayAI: boolean;
  formation: Formation;
  tactic: Tactic;
  events: FootballEvent[];
  score?: [number, number];
  reward?: number;
  engineVersion?: string;
  homeOwnedIds?: string[];
  awayOwnedIds?: string[];
  statistics?: { home: TeamMatchStats; away: TeamMatchStats };
}
export interface TeamMatchStats {
  shots: number;
  shotsOnTarget: number;
  saves: number;
  passes: number;
  possession: number;
  goals: number;
}
export type Formation = "4-4-2" | "4-3-3" | "3-5-2" | "4-2-3-1";
export type Tactic = "BALANCED" | "ATTACK" | "DEFEND";
export interface PackReceipt {
  focus?: import("./pack-focus.js").PackFocus;
  fallbackSlots?: number[];
  id: string;
  packId: string;
  version: string;
  at: number;
  price: number;
  weights: number[];
  floors: number[];
  rolls: number[];
  cardIds: string[];
  editionIds: string[];
}
export interface FootballState {
  managementVersion?: 1;
  roundMatches?: FootballMatch[];
  lastRound?: { season: number; round: number; matches: FootballMatch[] };
  version: 1;
  cards: OwnedCard[];
  lineup: string[];
  bench: string[];
  formation: Formation;
  tactic: Tactic;
  welcomeClaimed: boolean;
  receipts: PackReceipt[];
  season: Season;
  match: FootballMatch | null;
  history: FootballMatch[];
  seasons: {
    number: number;
    division: number;
    position: number;
    nextDivision: number;
    table?: Standing[];
    fixtures?: Fixture[];
    rulesVersion?: string;
  }[];
  performance?: Record<string, PlayerPerformance>;
  captain?: string;
  listed?: string[];
  careerV2?: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
    ga: number;
    points: number;
    titles: number;
    promotions: number;
    form: string[];
    sinceSeason: number;
  };
  organizer: { enabled: boolean; duplicateToDepot: boolean; lockAt: number };
}
export interface FootballView extends Omit<FootballState, "match"> {
  match: FootballMatch | null;
  catalog: CardEdition[];
  packs: PackDefinition[];
  serverTime: number;
  packVersion: string;
}
