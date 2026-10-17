import type {
  Athlete,
  MatchView,
  Region,
  RewardSummary,
  Gameplay,
} from "../contracts/index.js";
import {
  addAthleteXp,
  DENOMINATOR,
  LEASE_MS,
  MATCH_MS,
  OFFLINE_MS,
  RENEW_MS,
  RULES_VERSION,
  rarityForRoll,
} from "./rules.js";
import { derivedId, deriveSeed, randomStream } from "./random.js";
import { makeAthlete, makeNpc, simulate, opponentName } from "./simulation.js";
import { regionInfo } from "../contracts/world.js";
import { defaultScouting, organizeDrop } from "./scouting.js";

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
interface OnlineInterval {
  start: number;
  end: number;
}
interface Budget {
  coveredOffline?: OnlineInterval[];
  trainingUsedMs?: number;
  openedAt: number;
  closedAt: number | null;
  usedMs: number;
  intervalStart: number;
}
export interface Runtime {
  brasfoot?: import("../contracts/brasfoot.js").FootballState;
  career?: {
    matches: string;
    wins: string;
    draws: string;
    losses: string;
    goals: string;
    coins: string;
    drops: string;
  };
  trainingClock?: {
    through: number;
    timeline: { start: number; end: number; online: boolean }[];
  };
  gameplay?: Gameplay;
  testClock?: {
    speed: 1 | 10 | 60;
    realAnchor: number;
    gameAnchor: number;
    used: boolean;
  };
  secret: string;
  clubXp: string;
  regionalUnlocked: boolean;
  balance: string;
  walletVersion: number;
  commonSupply: string;
  lineup: string[];
  lineupVersion: number;
  athleteOrdinal: number;
  farm: {
    running: boolean;
    region: Region;
    version: number;
    sequence: number;
    nextAt: number;
  };
  presence: {
    generation: number;
    owner: string | null;
    sequence: number;
    validUntil: number;
    intervals: OnlineInterval[];
  };
  budgets: Budget[];
  carry: Record<string, string>;
}
export interface ActiveMatch {
  view: MatchView;
  seed: string;
}
export interface State {
  reservedCoins?: string;
  materialJournal?: { id: string; delta: string; at: number; reason: string }[];
  lockedAthletes?: string[];
  journal?: {
    id: string;
    delta: string;
    balanceAfter: string;
    version: number;
    at: number;
    reason: string;
  }[];
  id: string;
  name: string;
  runtime: Runtime;
  athletes: Athlete[];
  current: ActiveMatch | null;
}
export interface Settlement {
  match: MatchView;
  balanceAfter: string;
  walletVersion: number;
}

export function createClub(
  id: string,
  name: string,
  seed: string,
  now: number,
): State {
  const athletes = Array.from({ length: 5 }, (_, i) =>
    makeAthlete(seed, i + 1, "P1", true),
  );
  return {
    id,
    name,
    athletes,
    current: null,
    runtime: {
      career: {
        matches: "0",
        wins: "0",
        draws: "0",
        losses: "0",
        goals: "0",
        coins: "0",
        drops: "0",
      },
      secret: seed,
      clubXp: "0",
      regionalUnlocked: false,
      balance: "0",
      walletVersion: 0,
      commonSupply: "0",
      lineup: athletes.map((a) => a.id),
      lineupVersion: 1,
      athleteOrdinal: 5,
      farm: {
        running: false,
        region: "VARZEA",
        version: 1,
        sequence: 0,
        nextAt: now,
      },
      presence: {
        generation: 0,
        owner: null,
        sequence: 0,
        validUntil: 0,
        intervals: [],
      },
      budgets: [],
      carry: {},
    },
  };
}
export function ensureRenewals(s: State, through: number) {
  for (const interval of s.runtime.presence.intervals) {
    const at = interval.start + RENEW_MS;
    if (
      at <= Math.min(interval.end, through) &&
      !s.runtime.budgets.some((b) => b.intervalStart === interval.start)
    ) {
      const previous = s.runtime.budgets.at(-1);
      if (previous) previous.closedAt = at;
      s.runtime.budgets.push({
        openedAt: at,
        closedAt: null,
        usedMs: 0,
        intervalStart: interval.start,
      });
    }
  }
}
export function isOnline(s: State, at: number) {
  return s.runtime.presence.intervals.some((i) => i.start <= at && at < i.end);
}
function budgetAt(s: State, at: number) {
  return s.runtime.budgets.find(
    (b) => b.openedAt <= at && (b.closedAt === null || at < b.closedAt),
  );
}
function eligible(s: State, at: number) {
  const b = budgetAt(s, at);
  return (
    isOnline(s, at) ||
    Boolean(
      b &&
      (b.usedMs < OFFLINE_MS ||
        b.coveredOffline?.some((i) => i.start <= at && at < i.end)),
    )
  );
}
export function acquirePresence(s: State, owner: string, now: number) {
  const p = s.runtime.presence,
    last = p.intervals.at(-1);
  const leaseMs = LEASE_MS * (s.runtime.testClock?.speed ?? 1);
  if (last && last.end >= now) last.end = now + leaseMs;
  else p.intervals.push({ start: now, end: now + leaseMs });
  p.generation++;
  p.owner = owner;
  p.sequence = 0;
  p.validUntil = now + leaseMs;
  ensureRenewals(s, now);
  return {
    generation: p.generation,
    sequence: p.sequence,
    validUntil: p.validUntil,
  };
}
export function assertController(
  s: State,
  owner: string,
  generation: number,
  now: number,
) {
  const p = s.runtime.presence;
  if (p.owner !== owner || p.generation !== generation)
    throw new GameError(
      "PRESENCE_LEASE_REPLACED",
      "Outra aba assumiu o controle do clube.",
      409,
    );
  if (p.validUntil <= now)
    throw new GameError(
      "PRESENCE_EXPIRED",
      "Sua presença expirou. Reconecte para continuar.",
      409,
    );
}
export function heartbeat(
  s: State,
  owner: string,
  generation: number,
  sequence: number,
  now: number,
) {
  assertController(s, owner, generation, now);
  const p = s.runtime.presence;
  if (sequence < p.sequence)
    throw new GameError(
      "STALE_HEARTBEAT",
      "Sinal de presença desatualizado.",
      409,
    );
  if (sequence > p.sequence) {
    p.sequence = sequence;
    p.validUntil = now + LEASE_MS * (s.runtime.testClock?.speed ?? 1);
    p.intervals.at(-1)!.end = p.validUntil;
  }
  ensureRenewals(s, now);
  return {
    generation: p.generation,
    sequence: p.sequence,
    validUntil: p.validUntil,
  };
}
export function releasePresence(
  s: State,
  owner: string,
  generation: number,
  now: number,
) {
  const p = s.runtime.presence;
  if (p.owner !== owner || p.generation !== generation) return;
  const last = p.intervals.at(-1);
  if (last) last.end = Math.min(last.end, now);
  p.validUntil = Math.min(p.validUntil, now);
  p.owner = null;
}
export function coverage(
  s: State,
  start: number,
  end: number,
  training = false,
) {
  const timeline: { start: number; end: number; online: boolean }[] = [];
  const boundaries = new Set([start, end]);
  for (const i of s.runtime.presence.intervals) {
    if (i.start > start && i.start < end) boundaries.add(i.start);
    if (i.end > start && i.end < end) boundaries.add(i.end);
  }
  for (const b of s.runtime.budgets) {
    if (b.openedAt > start && b.openedAt < end) boundaries.add(b.openedAt);
    if (b.closedAt !== null && b.closedAt > start && b.closedAt < end)
      boundaries.add(b.closedAt);
    for (const range of b.coveredOffline ?? []) {
      if (range.start > start && range.start < end) boundaries.add(range.start);
      if (range.end > start && range.end < end) boundaries.add(range.end);
    }
  }
  const times = [...boundaries].sort((a, b) => a - b);
  let online = 0,
    offline = 0,
    uncovered = 0;
  for (let i = 0; i < times.length - 1; i++) {
    const at = times[i],
      duration = times[i + 1] - at;
    if (isOnline(s, at)) {
      online += duration;
      timeline.push({ start: at, end: at + duration, online: true });
    } else {
      const budget = budgetAt(s, at);
      const covered =
        budget?.coveredOffline?.some((r) => r.start <= at && at < r.end) ??
        false;
      const used = budget
        ? covered
          ? duration
          : Math.max(0, Math.min(duration, OFFLINE_MS - budget.usedMs))
        : 0;
      if (budget) {
        if (training)
          budget.trainingUsedMs = (budget.trainingUsedMs ?? 0) + used;
        if (!covered && used) {
          budget.usedMs += used;
          const ranges = [
            ...(budget.coveredOffline ?? []),
            { start: at, end: at + used },
          ].sort((a, b) => a.start - b.start);
          budget.coveredOffline = [];
          for (const r of ranges) {
            const last = budget.coveredOffline.at(-1);
            if (last && last.end >= r.start)
              last.end = Math.max(last.end, r.end);
            else budget.coveredOffline.push({ ...r });
          }
        }
      }
      if (used) timeline.push({ start: at, end: at + used, online: false });
      offline += used;
      uncovered += duration - used;
    }
  }
  return { online, offline, uncovered, timeline };
}
function rewardAmount(
  s: State,
  key: string,
  base: bigint,
  weightedMs: bigint,
): bigint {
  const units = base * weightedMs + BigInt(s.runtime.carry[key] ?? "0");
  s.runtime.carry[key] = (units % DENOMINATOR).toString();
  return units / DENOMINATOR;
}
export function startMatch(s: State, at: number) {
  const r = s.runtime;
  r.farm.sequence++;
  const seed = deriveSeed(r.secret, `match:${r.farm.sequence}`),
    id = derivedId(r.secret, `match:${r.farm.sequence}`);
  const home = r.lineup.map((id) => s.athletes.find((a) => a.id === id)!);
  if (home.length !== 5 || home.some((a) => !a) || new Set(r.lineup).size !== 5)
    throw new Error("Corrupt lineup");
  s.current = {
    seed,
    view: {
      id,
      homeName: s.name,
      awayName: opponentName(seed),
      testRun: r.testClock?.used ?? false,
      sequence: r.farm.sequence,
      state: "RUNNING",
      regionId: r.farm.region,
      startAt: at,
      endAt: at + MATCH_MS,
      rulesVersion: RULES_VERSION,
      lineupVersion: r.lineupVersion,
      home: structuredClone(home),
      away: makeNpc(seed, r.farm.region),
      result: null,
      events: [],
      reward: null,
    },
  };
}
function settle(s: State): Settlement {
  const current = s.current!,
    m = current.view,
    sim = simulate(m, current.seed),
    r = s.runtime;
  const c = coverage(s, m.startAt, m.endAt),
    weight = BigInt(c.online * 2 + c.offline);
  const base = regionInfo(m.regionId).coins;
  const coinTable =
    m.regionId === "VARZEA"
      ? { LOSS: 10, DRAW: 12, WIN: 15 }
      : m.regionId === "REGIONAL"
        ? { LOSS: 12, DRAW: 15, WIN: 18 }
        : { LOSS: base, DRAW: base + 4, WIN: base + 8 };
  const coins = rewardAmount(
    s,
    "coins",
    BigInt(coinTable[sim.result.outcome]),
    weight,
  );
  const clubXp = rewardAmount(s, "clubXp", 28n, weight);
  const athleteXp = m.home.map((snapshot) => {
    const amount = rewardAmount(s, `xp:${snapshot.id}`, 20n, weight);
    const athlete = s.athletes.find((a) => a.id === snapshot.id);
    if (!athlete) throw new Error("Snapshot owner missing");
    addAthleteXp(athlete, amount);
    return { athleteId: athlete.id, amount: amount.toString() };
  });
  r.balance = (BigInt(r.balance) + coins).toString();
  if (coins > 0n) r.walletVersion++;
  r.clubXp = (BigInt(r.clubXp) + clubXp).toString();
  if (BigInt(r.clubXp) >= 1100n) r.regionalUnlocked = true;
  const online = c.online === MATCH_MS;
  const material =
    c.uncovered === 0 &&
    randomStream(current.seed, "material")(100) < (online ? 80 : 50)
      ? 1
      : 0;
  r.commonSupply = (BigInt(r.commonSupply) + BigInt(material)).toString();
  let athlete: Athlete | null = null;
  if (online && randomStream(current.seed, "athlete-occurrence")(100) < 20) {
    const rarity = rarityForRoll(
      randomStream(current.seed, "athlete-rarity")(100000),
    );
    athlete = makeAthlete(current.seed, ++r.athleteOrdinal, rarity);
    athlete.birthRegion = m.regionId;
    const config = r.gameplay?.scouting ?? defaultScouting();
    const reason = organizeDrop(athlete, config);
    if (r.gameplay) {
      const log = (r.gameplay.discoveries ??= []);
      log.unshift({
        athleteId: athlete.id,
        name: athlete.displayName,
        rarity: athlete.rarity,
        storage: athlete.storage!,
        reason,
        at: m.endAt,
      });
      r.gameplay.discoveries = log.slice(0, 200);
    }
    s.athletes.push(athlete);
  }
  const reward: RewardSummary = {
    coins: coins.toString(),
    clubXp: clubXp.toString(),
    athleteXp,
    material,
    athlete,
    mode: online
      ? "ONLINE"
      : c.offline === MATCH_MS
        ? "OFFLINE"
        : c.online + c.offline === 0
          ? "INELIGIBLE"
          : "MIXED",
    onlineMs: c.online,
    offlineMs: c.offline,
    ineligibleMs: c.uncovered,
  };
  m.state = "SETTLED";
  m.events = sim.events;
  m.result = sim.result;
  m.reward = reward;
  if (r.career) {
    const c = r.career;
    c.matches = String(BigInt(c.matches) + 1n);
    const field =
      sim.result.outcome === "WIN"
        ? "wins"
        : sim.result.outcome === "DRAW"
          ? "draws"
          : "losses";
    c[field] = String(BigInt(c[field]) + 1n);
    c.goals = String(BigInt(c.goals) + BigInt(sim.result.homeGoals));
    c.coins = String(BigInt(c.coins) + coins);
    c.drops = String(BigInt(c.drops) + (athlete ? 1n : 0n));
  }
  const league = r.gameplay?.league;
  if (m.leagueSeasonId && league?.id === m.leagueSeasonId) {
    league.games++;
    league.goalsFor += sim.result.homeGoals;
    league.goalsAgainst += sim.result.awayGoals;
    if (sim.result.outcome === "WIN") {
      league.wins++;
      league.points += 3;
    } else if (sim.result.outcome === "DRAW") {
      league.draws++;
      league.points++;
    } else league.losses++;
    league.records.push({
      matchId: m.id,
      outcome: sim.result.outcome,
      score: `${sim.result.homeGoals} × ${sim.result.awayGoals}`,
    });
  }
  r.farm.nextAt = m.endAt;
  s.current = null;
  return { match: m, balanceAfter: r.balance, walletVersion: r.walletVersion };
}
export function advance(
  s: State,
  now: number,
  limit = 32,
): { settlements: Settlement[]; pending: boolean } {
  if (s.runtime.brasfoot) return { settlements: [], pending: false };
  ensureRenewals(s, now);
  const settlements: Settlement[] = [];
  for (;;) {
    if (s.current) {
      if (s.current.view.endAt > now) break;
      if (settlements.length >= limit) return { settlements, pending: true };
      settlements.push(settle(s));
    }
    if (!s.runtime.farm.running) break;
    let at = s.runtime.farm.nextAt;
    if (!eligible(s, at)) {
      const next = s.runtime.presence.intervals.find(
        (i) => i.end > at && i.start <= now,
      );
      if (!next) break;
      at = Math.max(at, next.start);
    }
    if (at > now) break;
    startMatch(s, at);
  }
  return { settlements, pending: false };
}
export function setLineup(s: State, ids: string[], expectedVersion: number) {
  if (expectedVersion !== s.runtime.lineupVersion)
    throw new GameError(
      "VERSION_CONFLICT",
      "A escalação mudou. Atualize antes de salvar.",
      412,
    );
  if (
    ids.length !== 5 ||
    new Set(ids).size !== 5 ||
    ids.some((id) => !s.athletes.some((a) => a.id === id))
  )
    throw new GameError(
      "INVALID_LINEUP",
      "Escolha cinco atletas diferentes do seu clube.",
    );
  if (
    ids.some(
      (id) =>
        s.lockedAthletes?.includes(id) ||
        s.runtime.gameplay?.training.some((t) => t.athleteId === id),
    )
  )
    throw new GameError(
      "ATHLETE_BUSY",
      "Retire o atleta do treino ou do mercado antes de escalar.",
    );
  s.runtime.lineup = [...ids];
  s.runtime.lineupVersion++;
}
export function setFarm(
  s: State,
  running: boolean,
  region: Region,
  now: number,
) {
  if (1n + BigInt(s.runtime.clubXp) / 100n < BigInt(regionInfo(region).level))
    throw new GameError(
      "REGION_LOCKED",
      `${regionInfo(region).name} exige nível ${regionInfo(region).level} permanente do clube.`,
    );
  const f = s.runtime.farm;
  if (running && s.current?.view.leagueSeasonId)
    throw new GameError(
      "LEAGUE_MATCH_ACTIVE",
      "Aguarde o jogo da liga terminar.",
      409,
    );
  if (running && f.running && f.region !== region)
    throw new GameError(
      "FARM_ALREADY_RUNNING",
      "Pare o farm antes de trocar de região.",
      409,
    );
  if (f.running === running && f.region === region) return;
  if (!f.running && running && !s.current) f.nextAt = now;
  f.running = running;
  f.region = region;
  f.version++;
  if (running) advance(s, now, 0);
}
export function offlineView(s: State, now: number, pending = false) {
  const p = s.runtime.presence,
    interval = p.intervals.find((i) => i.start <= now && now < i.end),
    budget = s.runtime.budgets.at(-1);
  return {
    remainingMs: budget ? OFFLINE_MS - budget.usedMs : 0,
    qualifyingOnlineMs: interval
      ? Math.min(RENEW_MS, Math.max(0, now - interval.start))
      : 0,
    online: Boolean(interval),
    catchUpPending: pending,
  };
}
