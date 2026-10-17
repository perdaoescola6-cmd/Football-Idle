export const attributeKeys = [
  "finishing",
  "passing",
  "control",
  "pace",
  "marking",
  "defending",
] as const;
export type AttributeKey = (typeof attributeKeys)[number];
export const attributeLabels: Record<AttributeKey, string> = {
  finishing: "Finalização",
  passing: "Passe",
  control: "Controle",
  pace: "Velocidade",
  marking: "Marcação",
  defending: "Defesa",
};
export type Rarity = "P1" | "P2" | "P3" | "P4" | "P5";
export type Region = (typeof import("./world.js").regions)[number]["id"];
export type Attributes = Record<AttributeKey, number>;
export interface Athlete {
  protected?: boolean;
  storage?: "COLLECTION" | "DEPOT";
  birthRegion?: Region;
  birthOvr?: number;
  npcValue?: string;
  scoutReason?: string;
  position?: "GOL" | "ZAG" | "MEI" | "ATA";
  number?: number;
  portrait?: number;
  tradeEligible?: boolean;
  id: string;
  displayName: string;
  rarity: Rarity;
  origin: "STARTER" | "ONLINE_DROP" | "SCOUT" | "MARKET";
  xpTotal: string;
  level: string;
  ovr: number;
  attributes: Attributes;
  caps: Attributes;
}
export interface MatchEvent {
  sequence: number;
  offsetMs: number;
  type:
    | "MATCH_STARTED"
    | "POSSESSION_CHANGED"
    | "PASS_COMPLETED"
    | "TACKLE"
    | "GOALKEEPER_SAVE"
    | "RESTART"
    | "CHANCE_CREATED"
    | "SHOT_RESOLVED"
    | "MATCH_ENDED";
  payload: {
    stage?: {
      from: { x: number; y: number };
      to: { x: number; y: number };
      durationMs: number;
    };
    team?: "HOME" | "AWAY";
    actorId?: string;
    sourceActorId?: string;
    outcome?: string;
    homeGoals?: number;
    awayGoals?: number;
  };
}
export interface MatchView {
  homeName?: string;
  awayName?: string;
  awayClubId?: string;
  liveScore?: { homeGoals: number; awayGoals: number };
  leagueSeasonId?: string;
  testRun?: boolean;
  id: string;
  sequence: number;
  state: "RUNNING" | "SETTLED";
  regionId: Region;
  startAt: number;
  endAt: number;
  rulesVersion: string;
  lineupVersion: number;
  home: Athlete[];
  away: Athlete[];
  result: {
    homeGoals: number;
    awayGoals: number;
    outcome: "WIN" | "DRAW" | "LOSS";
  } | null;
  events: MatchEvent[];
  reward: RewardSummary | null;
}
export interface RewardSummary {
  coins: string;
  clubXp: string;
  athleteXp: { athleteId: string; amount: string }[];
  material: number;
  athlete: Athlete | null;
  mode: "ONLINE" | "OFFLINE" | "MIXED" | "INELIGIBLE";
  onlineMs: number;
  offlineMs: number;
  ineligibleMs: number;
}
export interface LedgerEntry {
  id: string;
  matchId: string | null;
  reason?: string;
  delta: string;
  balanceAfter: string;
  version: number;
  createdAt: number;
}
export interface GameView {
  brasfoot?: import("./brasfoot.js").FootballView;
  career?: {
    matches: string;
    wins: string;
    draws: string;
    losses: string;
    goals: string;
    coins: string;
    drops: string;
  };
  rosterRevision?: string;
  rosterOmitted?: boolean;
  marketHistory?: {
    listingId: string;
    athleteName: string;
    total: string;
    commission: string;
    buyerName: string;
    sellerName: string;
    createdAt: number;
    direction: "BUY" | "SELL";
  }[];
  marketRecords?: MarketListing[];
  revision: string;
  gameplay: Gameplay;
  market: MarketListing[];
  testMode: { speed: 1 | 10 | 60; used: boolean };
  club: {
    id: string;
    name: string;
    xpTotal: string;
    level: string;
    regionalUnlocked: boolean;
  };
  wallet: {
    balance: string;
    version: number;
    reserved?: string;
    available?: string;
  };
  athletes: Athlete[];
  lineup: { athleteIds: string[]; version: number };
  inventory: { commonSupply: string };
  farm: {
    running: boolean;
    regionId: Region;
    version: number;
    status: "READY" | "OFFLINE_EXHAUSTED" | "STOPPED";
  };
  currentMatch: MatchView | null;
  recentMatches: MatchView[];
  ledger: LedgerEntry[];
  offline: {
    remainingMs: number;
    qualifyingOnlineMs: number;
    online: boolean;
    catchUpPending: boolean;
  };
  serverTime: number;
  rulesVersion: string;
}
export interface Gameplay {
  scouting?: ScoutingConfig;
  discoveries?: {
    athleteId: string;
    name: string;
    rarity: Rarity;
    storage: string;
    reason: string;
    at: number;
  }[];
  trainingSlots: number;
  training: {
    athleteId: string;
    lastAt: number;
    paidSteps: number;
    paused?: boolean;
    status?: "ACTIVE" | "PAUSED" | "NO_COINS" | "CAPPED";
  }[];
  scout: { id: string; readyAt: number; athlete?: Athlete } | null;
  scoutSequence: number;
  league: {
    id: string;
    endsAt: number;
    division: number;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
    records: { matchId: string; outcome: string; score: string }[];
  } | null;
}
export interface AthleteFilter {
  search?: string;
  position?: string;
  rarity?: string;
  storage?: string;
  role?: "ALL" | "STARTER" | "BENCH";
  minOvr?: number;
  maxOvr?: number;
  minPotential?: number;
  maxPotential?: number;
  minLevel?: string;
  maxLevel?: string;
  region?: string;
  protected?: boolean;
  eligibleOnly?: boolean;
}
export interface ScoutCondition {
  field:
    | "rarity"
    | "position"
    | "potential"
    | "birthOvr"
    | "finishing"
    | "passing"
    | "control"
    | "pace"
    | "marking"
    | "defending";
  op: "EQ" | "GTE" | "LTE";
  value: string;
}
export interface ScoutRule {
  id: string;
  name: string;
  enabled: boolean;
  mode: "ALL" | "ANY";
  conditions: ScoutCondition[];
  destination: "COLLECTION" | "DEPOT";
  protect: boolean;
}
export interface ScoutingConfig {
  enabled: boolean;
  fallback: "COLLECTION" | "DEPOT";
  rules: ScoutRule[];
  rareWarningPotential: number;
}
export interface SaleQuote {
  id: string;
  expiresAt: number;
  athletes: { id: string; name: string; price: string; warning: boolean }[];
  excluded: { id: string; reason: string }[];
  total: string;
  warnings: number;
}
export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  athlete: Athlete;
  price: string;
  expiresAt: number;
  status: "OPEN" | "SOLD" | "CANCELLED" | "EXPIRED";
  offers: {
    id: string;
    buyerId: string;
    buyerName: string;
    amount: string;
    expiresAt: number;
    status: "OPEN" | "ACCEPTED" | "REJECTED";
  }[];
}
export interface Bootstrap {
  devTools: { godMode: boolean };
  account: { id: string } | null;
  game: GameView | null;
}
export interface PresenceReply {
  generation: number;
  sequence: number;
  validUntil: number;
}
