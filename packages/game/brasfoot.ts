import { randomUUID } from "node:crypto";
import {
  packs,
  PACK_VERSION,
  rarities,
  packRarityIndex,
  validatePackDefinition,
  type PackDefinition,
  type Formation,
  type Tactic,
  type FootballMatch,
  type Season,
  type FootballView,
} from "../contracts/brasfoot.js";
import { catalog, edition } from "./card-catalog.js";
import { GameError, type State } from "./engine.js";
import { coins } from "./gameplay.js";
import { deriveSeed, randomStream } from "./random.js";
import { effectiveCard, playerIdentity } from "../contracts/card-model.js";
import { simulateFootball, matchStatistics } from "./football-simulation.js";
import { ensureCareer, recordPerformance } from "./football-career.js";

import { playingMinute } from "../contracts/match-management.ts";

import {
  FOCUS_PACK_VERSION,
  packFocuses,
  type PackFocus,
} from "../contracts/pack-focus.js";
import { focusedPool } from "./pack-pool.js";

export const SEASON_RULES = "BR-2024-compact-v1";
// Selected real participants from 2024; compact experimental regulation,
// not a reproduction of the CBF format. Seven AI clubs + the user's club.
export const divisionClubs = [
  [
    "Manaus-AM",
    "Brasiliense-DF",
    "Portuguesa-RJ",
    "América-RN",
    "Treze-PB",
    "Anápolis-GO",
    "Maringá-PR",
  ],
  [
    "Botafogo-PB",
    "São Bernardo-SP",
    "Volta Redonda-RJ",
    "Remo-PA",
    "Athletic-MG",
    "Ferroviária-SP",
    "Londrina-PR",
  ],
  [
    "Santos-SP",
    "Sport-PE",
    "Ceará-CE",
    "Goiás-GO",
    "Avaí-SC",
    "Coritiba-PR",
    "América-MG",
  ],
  [
    "Botafogo-RJ",
    "Palmeiras-SP",
    "Flamengo-RJ",
    "Fortaleza-CE",
    "Internacional-RS",
    "São Paulo-SP",
    "Corinthians-SP",
  ],
];
export function createSeason(s: State, division = 0, number = 1): Season {
  const table = [s.name, ...divisionClubs[division]].map((name, i) => ({
    id: i === 0 ? s.id : `AI-${division}-${i}`,
    name,
    ai: i !== 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }));
  const rotation = table.map((t) => t.id),
    fixtures: Season["fixtures"] = [];
  for (let round = 0; round < 7; round++) {
    for (let i = 0; i < 4; i++) {
      const pair =
        round % 2
          ? [rotation[7 - i], rotation[i]]
          : [rotation[i], rotation[7 - i]];
      fixtures.push({
        id: `${number}:${round + 1}:${i}`,
        round: round + 1,
        home: pair[0],
        away: pair[1],
      });
      fixtures.push({
        id: `${number}:${round + 8}:${i}`,
        round: round + 8,
        home: pair[1],
        away: pair[0],
      });
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return {
    number,
    division,
    rulesVersion: SEASON_RULES,
    round: 1,
    table,
    fixtures: fixtures.sort((a, b) => a.round - b.round),
  };
}
export function standings(season: Season) {
  return [...season.table].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.id.localeCompare(b.id),
  );
}
export function nextDivision(division: number, position: number) {
  return position <= 2
    ? Math.min(3, division + 1)
    : position >= 7
      ? Math.max(0, division - 1)
      : division;
}
export function football(s: State) {
  if (!s.runtime.brasfoot)
    throw new GameError("MODE_REQUIRED", "Ative o modo 11v11 primeiro.");
  ensureCareer(s.runtime.brasfoot, s.id);
  return s.runtime.brasfoot;
}
export function packRarity(pack: PackDefinition, slot: number, roll: number) {
  return rarities[packRarityIndex(pack, slot, roll)];
}
export function initializeFootball(s: State, now: number) {
  if (s.runtime.brasfoot) return; // one-time, regardless of command keys
  s.runtime.farm.running = false;
  if (s.current) return; // Finish and settle the existing snapshot without discarding it.
  if (s.runtime.gameplay)
    s.runtime.gameplay.training.forEach((t) => {
      t.paused = true;
    });
  const cards = catalog.slice(0, 11).map((c) => ({
    id: randomUUID(),
    editionId: c.id,
    locked: false,
    storage: "COLLECTION" as const,
    acquiredAt: now,
  }));
  s.runtime.brasfoot = {
    version: 1,
    cards,
    lineup: cards.map((c) => c.id),
    bench: [],
    formation: "4-4-2",
    tactic: "BALANCED",
    welcomeClaimed: false,
    receipts: [],
    season: createSeason(s),
    match: null,
    history: [],
    seasons: [],
    organizer: { enabled: false, duplicateToDepot: true, lockAt: 3 },
  };
  coins(s, 10000n, "BR_ONBOARDING_ONCE", now);
}
export function openPack(
  s: State,
  packId: string,
  now: number,
  welcome = false,
  focus: PackFocus = "GENERAL",
) {
  const f = football(s),
    pack = packs.find((p) => p.id === packId);
  if (!pack) throw new GameError("PACK_NOT_FOUND", "Pacote inexistente.");
  validatePackDefinition(pack);
  if (!packFocuses.includes(focus) || (welcome && focus !== "GENERAL"))
    throw new GameError(
      "INVALID_FOCUS",
      "Foco inválido; boas-vindas mantém o catálogo geral.",
    );
  const version = focus === "GENERAL" ? PACK_VERSION : FOCUS_PACK_VERSION;
  if (welcome && f.welcomeClaimed)
    throw new GameError("WELCOME_CLAIMED", "Boas-vindas já recebido.", 409);
  if (welcome && pack.id !== "basic")
    throw new GameError("INVALID_WELCOME", "Boas-vindas usa o pack Básico.");
  if (f.cards.length + 5 > 5000)
    throw new GameError("COLLECTION_FULL", "Venda cartas para liberar espaço.");
  const id = randomUUID(),
    rng = randomStream(deriveSeed(s.runtime.secret, id), "pack");
  const rolls: number[] = [],
    fallbackSlots: number[] = [],
    acquired = [],
    ownedEditions = new Set(f.cards.map((card) => card.editionId));
  for (let slot = 0; slot < 5; slot++) {
    const roll = rng(10000);
    rolls.push(roll);
    const rarity = packRarity(pack, slot, roll),
      pool = focusedPool(catalog, rarity, focus);
    if (!pool.cards.length)
      throw new GameError(
        "PACK_UNAVAILABLE",
        "Pacote indisponível: catálogo incompleto. Nenhuma moeda foi cobrada.",
        503,
      );
    if (pool.fallback) fallbackSlots.push(slot);
    const card = pool.cards[rng(pool.cards.length)],
      duplicate = ownedEditions.has(card.id);
    const owned = {
      id: randomUUID(),
      editionId: card.id,
      locked:
        f.organizer.enabled &&
        rarities.indexOf(card.rarity) >= f.organizer.lockAt,
      storage:
        f.organizer.enabled && duplicate && f.organizer.duplicateToDepot
          ? ("DEPOT" as const)
          : ("COLLECTION" as const),
      acquiredAt: now,
      clubHistory: [
        { clubId: s.id, name: s.name, at: now, kind: "ACQUIRED" as const },
      ],
    };
    acquired.push(owned);
    ownedEditions.add(card.id);
  }
  // Prepare all five cards before touching the wallet or collection. API persistence
  // remains transactional; direct engine calls also fail without partial delivery.
  if (!welcome)
    coins(
      s,
      -BigInt(pack.price),
      `PACK:${version}:${pack.id}${focus === "GENERAL" ? "" : ":" + focus}`,
      now,
    );
  f.cards.push(...acquired);
  if (welcome) f.welcomeClaimed = true;
  const receipt = {
    id,
    packId,
    version,
    focus,
    fallbackSlots,
    at: now,
    price: welcome ? 0 : pack.price,
    weights: [...pack.weights],
    floors: [...pack.floors],
    rolls,
    cardIds: acquired.map((c) => c.id),
    editionIds: acquired.map((c) => c.editionId),
  };
  f.receipts.push(receipt);
  return {
    message: "Cinco cartas adicionadas à coleção.",
    receipt,
    cards: acquired,
  };
}
const formations: Record<Formation, number[]> = {
  "4-4-2": [1, 4, 4, 2],
  "4-3-3": [1, 4, 3, 3],
  "3-5-2": [1, 3, 5, 2],
  "4-2-3-1": [1, 4, 5, 1],
};
export function setFootballLineup(
  s: State,
  ids: string[],
  bench: string[],
  formation: Formation,
  tactic: Tactic,
) {
  const f = football(s),
    all = [...ids, ...bench];
  if (f.match)
    throw new GameError(
      "MATCH_ACTIVE",
      "Altere a escalação após a partida.",
      409,
    );
  if (ids.length !== 11 || bench.length > 7 || new Set(all).size !== all.length)
    throw new GameError(
      "INVALID_LINEUP",
      "Escale onze cartas distintas e até sete reservas.",
    );
  const selected = all.map((id) => f.cards.find((c) => c.id === id));
  if (all.some((id) => f.listed?.includes(id)))
    throw new GameError(
      "CARD_LISTED",
      "Retire a carta do mercado antes de escalar.",
    );
  if (selected.some((c) => !c))
    throw new GameError("CARD_NOT_OWNED", "Carta não pertence ao clube.");
  const allPlayers = selected.map((c) => edition(c!.editionId));
  if (new Set(allPlayers.map(playerIdentity)).size !== all.length)
    throw new GameError(
      "DUPLICATE_PLAYER",
      "O mesmo jogador não pode ocupar dois lugares no elenco escalado.",
    );
  const players = allPlayers.slice(0, 11);
  if (
    ["GOL", "DEF", "MEI", "ATA"].some(
      (p, i) =>
        players.filter((c) => c.position === p).length !==
        formations[formation][i],
    )
  )
    throw new GameError(
      "POSITION_MISMATCH",
      "As posições precisam corresponder à formação.",
    );
  f.lineup = [...ids].sort(
    (a, b) =>
      ["GOL", "DEF", "MEI", "ATA"].indexOf(
        edition(f.cards.find((c) => c.id === a)!.editionId).position,
      ) -
      ["GOL", "DEF", "MEI", "ATA"].indexOf(
        edition(f.cards.find((c) => c.id === b)!.editionId).position,
      ),
  );
  f.bench = [...bench];
  f.formation = formation;
  f.tactic = tactic;
  if (f.captain && !ids.includes(f.captain)) delete f.captain;
}
export function suggestLineup(s: State, formation: Formation, tactic: Tactic) {
  const f = football(s),
    selected: string[] = [],
    identities = new Set<string>();
  for (const [index, position] of ["GOL", "DEF", "MEI", "ATA"].entries())
    for (let i = 0; i < formations[formation][index]; i++) {
      const candidate = f.cards
        .filter(
          (c) =>
            !f.listed?.includes(c.id) &&
            edition(c.editionId).position === position &&
            !identities.has(playerIdentity(edition(c.editionId))),
        )
        .sort(
          (a, b) =>
            effectiveCard(edition(b.editionId), b).rating -
              effectiveCard(edition(a.editionId), a).rating ||
            a.id.localeCompare(b.id),
        )[0];
      if (!candidate)
        throw new GameError(
          "INSUFFICIENT_POSITIONS",
          `Não há jogadores suficientes para ${formation}.`,
        );
      selected.push(candidate.id);
      identities.add(playerIdentity(edition(candidate.editionId)));
    }
  setFootballLineup(s, selected, [], formation, tactic);
  return {
    message:
      "Melhor escalação por OVR e posição aplicada. Escolha o banco antes de jogar.",
  };
}
export function trainCard(s: State, id: string, now: number) {
  const f = football(s),
    card = f.cards.find((c) => c.id === id);
  if (!card)
    throw new GameError("CARD_NOT_OWNED", "Carta não pertence ao clube.");
  if (
    f.listed?.includes(id) ||
    (f.match &&
      (f.match.homeOwnedIds?.includes(id) ||
        f.match.awayOwnedIds?.includes(id)))
  )
    throw new GameError(
      "CARD_BUSY",
      "Aguarde a partida terminar ou retire a carta do mercado.",
    );
  const level = card.upgrades ?? 0;
  if (level >= 3)
    throw new GameError(
      "POTENTIAL_REACHED",
      "Esta edição já atingiu seu limite de três evoluções.",
    );
  const cost = 2500 * (level + 1);
  coins(s, -BigInt(cost), "BR_CARD_TRAINING", now);
  card.upgrades = level + 1;
  return { message: `Treino concluído. Evolução ${card.upgrades}/3.`, cost };
}
export function previewFootball(s: State) {
  const copy = structuredClone(s),
    f = football(copy);
  if (!f.match) startFootballMatch(copy, 0);
  const m = f.match!,
    own = m.homeAI ? m.away : m.home,
    other = m.homeAI ? m.home : m.away,
    avg = (t: typeof own) =>
      Math.round(t.reduce((n, c) => n + c.rating, 0) / 11),
    gap = avg(own) - avg(other);
  return {
    home: m.home,
    away: m.away,
    homeName: m.homeName,
    awayName: m.awayName,
    homeAI: m.homeAI,
    awayAI: m.awayAI,
    formation: m.formation,
    tactic: m.tactic,
    ownOvr: avg(own),
    opponentOvr: avg(other),
    difficulty: gap > 7 ? "Favorável" : gap < -7 ? "Difícil" : "Equilibrado",
  };
}
export function sellCards(s: State, ids: string[], now: number) {
  const f = football(s);
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new GameError("INVALID_SALE", "Selecione cartas distintas.");
  const selected = ids.map((id) => f.cards.find((c) => c.id === id));
  if (
    selected.some(
      (c) =>
        !c ||
        c.locked ||
        f.lineup.includes(c.id) ||
        f.bench.includes(c.id) ||
        f.listed?.includes(c.id),
    )
  )
    throw new GameError(
      "CARD_PROTECTED",
      "Lote recusado: há cartas protegidas, escaladas ou ausentes.",
    );
  const prices = [200, 500, 1500, 6000, 20000],
    total = selected.reduce(
      (sum, c) => sum + prices[rarities.indexOf(edition(c!.editionId).rarity)],
      0,
    );
  coins(s, BigInt(total), "BR_NPC_BATCH_SALE", now);
  f.cards = f.cards.filter((c) => !ids.includes(c.id));
  return {
    message: `${ids.length} cartas vendidas por ${total} Coins.`,
    total,
  };
}
function aiLineup(seed: string, division: number) {
  const rng = randomStream(seed, "ai-lineup");
  const used = new Set<string>(),
    ai: import("../contracts/brasfoot.js").CardEdition[] = [];
  for (const position of [
    "GOL",
    "DEF",
    "DEF",
    "DEF",
    "DEF",
    "MEI",
    "MEI",
    "MEI",
    "MEI",
    "ATA",
    "ATA",
  ]) {
    const candidates = catalog
      .filter((c) => c.position === position && !used.has(playerIdentity(c)))
      .sort(
        (a, b) =>
          Math.abs(a.rating - (62 + division * 8)) -
            Math.abs(b.rating - (62 + division * 8)) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 35);
    const chosen = candidates[rng(candidates.length)];
    used.add(playerIdentity(chosen));
    ai.push(chosen);
  }
  return ai;
}
export function startFootballMatch(s: State, now: number) {
  const f = football(s),
    season = f.season;
  if (f.match)
    throw new GameError(
      "MATCH_ACTIVE",
      "Já existe uma partida em andamento.",
      409,
    );
  if (season.round > 14)
    throw new GameError("SEASON_COMPLETE", "Inicie a próxima temporada.");
  setFootballLineup(s, f.lineup, f.bench, f.formation, f.tactic);
  const fixture = season.fixtures.find(
    (m) => m.round === season.round && (m.home === s.id || m.away === s.id),
  )!;
  const seed = deriveSeed(
      s.runtime.secret,
      `BR:${season.number}:${fixture.id}`,
    ),
    rng = randomStream(seed, "ai-lineup");
  const owned = f.lineup
    .map((id) => f.cards.find((c) => c.id === id)!)
    .sort(
      (a, b) =>
        ["GOL", "DEF", "MEI", "ATA"].indexOf(edition(a.editionId).position) -
        ["GOL", "DEF", "MEI", "ATA"].indexOf(edition(b.editionId).position),
    );
  const own = owned.map((c) => effectiveCard(edition(c.editionId), c));
  const ai = aiLineup(seed, season.division);
  const home = fixture.home === s.id ? own : ai,
    away = fixture.away === s.id ? own : ai;
  const { events, score } = simulateFootball({
    seed,
    home,
    away,
    ownSide: fixture.home === s.id ? 0 : 1,
    formation: f.formation,
    tactic: f.tactic,
    captain: f.cards.find((c) => c.id === f.captain)?.editionId,
    fatigue: true,
  });
  f.managementVersion = 1;
  f.match = {
    id: randomUUID(),
    fixtureId: fixture.id,
    startAt: now,
    endAt: now + 90000,
    home: structuredClone(home),
    away: structuredClone(away),
    homeName: season.table.find((t) => t.id === fixture.home)!.name,
    awayName: season.table.find((t) => t.id === fixture.away)!.name,
    homeAI: fixture.home !== s.id,
    awayAI: fixture.away !== s.id,
    formation: f.formation,
    tactic: f.tactic,
    events,
    score,
    engineVersion: "football-manager-v3",
    captainId: f.cards.find((c) => c.id === f.captain)?.editionId,
    totalPausedMs: 0,
    substitutions: [],
    participants: [
      ...home.map((card, i) => ({
        card: structuredClone(card),
        ownedId: fixture.home === s.id ? owned[i].id : undefined,
        side: "HOME" as const,
        from: 0,
      })),
      ...away.map((card, i) => ({
        card: structuredClone(card),
        ownedId: fixture.away === s.id ? owned[i].id : undefined,
        side: "AWAY" as const,
        from: 0,
      })),
    ],
    statistics: matchStatistics(events),
    homeOwnedIds: fixture.home === s.id ? owned.map((c) => c.id) : [],
    awayOwnedIds: fixture.away === s.id ? owned.map((c) => c.id) : [],
  };
  f.roundMatches = season.fixtures
    .filter((x) => x.round === season.round && x.id !== fixture.id)
    .map((x) => {
      const seed = deriveSeed(s.runtime.secret, `AI:${season.number}:${x.id}`),
        home = aiLineup(seed + ":home", season.division),
        away = aiLineup(seed + ":away", season.division);
      const result = simulateFootball({
        seed,
        home,
        away,
        ownSide: 0,
        formation: "4-4-2",
        tactic: "BALANCED",
        fatigue: true,
      });
      return {
        id: randomUUID(),
        fixtureId: x.id,
        startAt: now,
        endAt: now + 90000,
        totalPausedMs: 0,
        home,
        away,
        homeName: season.table.find((t) => t.id === x.home)!.name,
        awayName: season.table.find((t) => t.id === x.away)!.name,
        homeAI: true,
        awayAI: true,
        formation: "4-4-2" as const,
        tactic: "BALANCED" as const,
        events: result.events,
        score: result.score,
        engineVersion: "football-manager-v3",
        statistics: matchStatistics(result.events),
      };
    });
}
function record(
  season: Season,
  fixture: Season["fixtures"][number],
  score: [number, number],
) {
  if (fixture.score) throw new Error("Fixture already settled");
  fixture.score = score;
  for (const [i, id] of [fixture.home, fixture.away].entries()) {
    const row = season.table.find((t) => t.id === id)!,
      gf = score[i],
      ga = score[1 - i];
    row.played++;
    row.gf += gf;
    row.ga += ga;
    if (gf > ga) {
      row.wins++;
      row.points += 3;
    } else if (gf === ga) {
      row.draws++;
      row.points++;
    } else row.losses++;
  }
}
export function settleFootball(s: State, now: number) {
  const f = s.runtime.brasfoot,
    match = f?.match;
  if (!f || !match || match.pausedAt !== undefined || now < match.endAt) return;
  ensureCareer(f, s.id);
  const season = f.season,
    score = match.score!;
  for (const fixture of season.fixtures.filter(
    (m) => m.round === season.round,
  )) {
    if (fixture.id === match.fixtureId) {
      fixture.engineVersion = match.engineVersion;
      fixture.statistics = match.statistics;
      record(season, fixture, score);
    } else if (f.roundMatches?.some((m) => m.fixtureId === fixture.id)) {
      const other = f.roundMatches.find((m) => m.fixtureId === fixture.id)!;
      fixture.engineVersion = other.engineVersion;
      fixture.statistics = other.statistics;
      record(season, fixture, other.score!);
    } else {
      const seed = deriveSeed(
          s.runtime.secret,
          `AI:${season.number}:${fixture.id}`,
        ),
        home = aiLineup(seed + ":home", season.division),
        away = aiLineup(seed + ":away", season.division);
      const result = simulateFootball({
        seed,
        home,
        away,
        ownSide: 0,
        formation: "4-4-2",
        tactic: "BALANCED",
      });
      fixture.engineVersion = "football-events-v2";
      fixture.statistics = matchStatistics(result.events);
      record(season, fixture, result.score);
    }
  }
  const fixture = season.fixtures.find((m) => m.id === match.fixtureId)!,
    own = fixture.home === s.id ? 0 : 1;
  match.reward =
    score[own] > score[1 - own]
      ? 3500
      : score[own] === score[1 - own]
        ? 2200
        : 1500;
  coins(s, BigInt(match.reward), `BR_OFFICIAL_MATCH:${match.id}`, match.endAt);
  recordPerformance(f, match, s.id, s.name);
  const career = f.careerV2!;
  career.matches++;
  career.gf += score[own];
  career.ga += score[1 - own];
  if (score[own] > score[1 - own]) {
    career.wins++;
    career.points += 3;
    career.form.push("V");
  } else if (score[own] === score[1 - own]) {
    career.draws++;
    career.points++;
    career.form.push("E");
  } else {
    career.losses++;
    career.form.push("D");
  }
  career.form = career.form.slice(-5);
  s.runtime.clubXp = String(BigInt(s.runtime.clubXp) + 28n);
  f.lastRound = {
    season: season.number,
    round: season.round,
    matches: [structuredClone(match), ...structuredClone(f.roundMatches ?? [])],
  };
  f.roundMatches = [];
  f.history.unshift(match);
  f.history = f.history.slice(0, 30);
  f.match = null;
  season.round++;
}
export function newFootballSeason(s: State, now = Date.now()) {
  const f = football(s),
    season = f.season;
  if (f.match || season.round <= 14)
    throw new GameError("SEASON_ACTIVE", "Conclua as 14 rodadas.");
  const position = standings(season).findIndex((t) => t.id === s.id) + 1,
    division = nextDivision(season.division, position);
  f.seasons.push({
    number: season.number,
    division: season.division,
    position,
    nextDivision: division,
    table: structuredClone(standings(season)),
    fixtures: structuredClone(season.fixtures),
    rulesVersion: season.rulesVersion,
  });
  if (position === 1) f.careerV2!.titles++;
  if (division > season.division) f.careerV2!.promotions++;
  coins(
    s,
    BigInt(position === 1 ? 15000 : position === 2 ? 8000 : 3000),
    `BR_SEASON_PRIZE:${season.number}:${position}`,
    now,
  );
  f.season = createSeason(s, division, season.number + 1);
}
export function footballView(
  s: State,
  now: number,
  includeCatalog = true,
): FootballView | undefined {
  if (!s.runtime.brasfoot) return;
  ensureCareer(s.runtime.brasfoot, s.id);
  const f = structuredClone(s.runtime.brasfoot);
  for (const game of [f.match, ...(f.roundMatches ?? [])]) {
    if (!game) continue;
    const minute = Math.floor(playingMinute(game, now));
    game.events = game.events.filter((e) => e.minute <= minute);
    delete game.score;
    game.statistics = matchStatistics(game.events);
  }
  return {
    ...f,
    season: { ...f.season, table: standings(f.season) },
    catalog: includeCatalog ? catalog : [],
    packs,
    packVersion: PACK_VERSION,
    serverTime: now,
  };
}
