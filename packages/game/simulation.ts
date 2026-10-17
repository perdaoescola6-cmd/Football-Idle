import {
  attributeKeys,
  type Athlete,
  type Attributes,
  type MatchEvent,
  type MatchView,
  type Rarity,
  type Region,
} from "../contracts/index.js";
import { derivedId, randomStream } from "./random.js";
import { ovr, rarityCaps } from "./rules.js";
import { identify } from "./identity.js";
import { regionInfo } from "../contracts/world.js";
export function makeAthlete(
  seed: string,
  ordinal: number,
  rarity: Rarity,
  starter = false,
): Athlete {
  const rand = randomStream(seed, `attributes:${ordinal}`),
    [min, max] = rarityCaps[rarity];
  const caps = {} as Attributes,
    attributes = {} as Attributes;
  for (const key of attributeKeys) {
    caps[key] = min + rand(max - min + 1);
    attributes[key] = starter ? 20 : Math.floor((caps[key] * 35) / 100);
  }
  return identify(
    {
      id: derivedId(seed, `athlete:${ordinal}`),
      displayName: `Atleta ${String(ordinal).padStart(2, "0")}`,
      rarity,
      origin: starter ? "STARTER" : "ONLINE_DROP",
      xpTotal: "0",
      level: "1",
      ovr: ovr(attributes),
      attributes,
      caps,
    },
    ordinal - 1,
  );
}
export function makeNpc(seed: string, region: Region): Athlete[] {
  const rand = randomStream(seed, "npc"),
    min = regionInfo(region).opponent;
  return Array.from({ length: 5 }, (_, i) => {
    const attributes = Object.fromEntries(
      attributeKeys.map((key) => [key, min + rand(5)]),
    ) as Attributes;
    return identify(
      {
        id: derivedId(seed, `npc:${i + 1}`),
        displayName: `Rival ${i + 1}`,
        rarity: "P1" as const,
        origin: "STARTER" as const,
        xpTotal: "0",
        level: "1",
        ovr: ovr(attributes),
        attributes,
        caps: { ...attributes },
      },
      i,
    );
  });
}
export function opponentName(seed: string) {
  const names = [
    "União da Serra",
    "Estrela do Norte",
    "Atlético da Vila",
    "Ferroviário FC",
    "Real Aurora",
    "Sport Horizonte",
    "Grêmio do Vale",
    "Racing Central",
    "Vitória do Sul",
    "Porto Azul",
    "Olimpia FC",
    "Juventude SC",
  ];
  return names[randomStream(seed, "opponent-name")(names.length)];
}
function strength(team: Athlete[]) {
  return team.reduce(
    (s, a) => s + attributeKeys.reduce((v, k) => v + a.attributes[k], 0),
    0,
  );
}
function attack(team: Athlete[]) {
  return team.reduce(
    (s, a) =>
      s +
      5 * a.attributes.finishing +
      3 * a.attributes.passing +
      2 * a.attributes.control,
    0,
  );
}
function defense(team: Athlete[]) {
  return team.reduce(
    (s, a) => s + 6 * a.attributes.marking + 4 * a.attributes.defending,
    0,
  );
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
export function simulate(match: MatchView, seed: string) {
  const rand = randomStream(seed, "sport"),
    events: MatchEvent[] = [];
  const emit = (
    offsetMs: number,
    type: MatchEvent["type"],
    payload: MatchEvent["payload"],
  ) => {
    if (match.rulesVersion === "RETRO-E2") {
      const home = payload.team === "HOME",
        team = home ? match.home : match.away;
      const point = (id: string | undefined, advanced = false) => {
        const index = Math.max(
          0,
          team.findIndex((a) => a.id === id),
        );
        const x = index === 0 ? 7 : advanced ? 65 : 35 + index * 3;
        return { x: home ? x : 100 - x, y: index === 0 ? 50 : 20 + index * 13 };
      };
      if (type === "PASS_COMPLETED")
        payload.stage = {
          from: point(payload.sourceActorId),
          to: point(payload.actorId, true),
          durationMs: 1600,
        };
      if (type === "CHANCE_CREATED")
        payload.stage = {
          from: point(payload.actorId, true),
          to: { x: home ? 75 : 25, y: point(payload.actorId).y },
          durationMs: 1800,
        };
      if (type === "SHOT_RESOLVED")
        payload.stage = {
          from: { x: home ? 75 : 25, y: point(payload.actorId).y },
          to: { x: home ? 96 : 4, y: payload.outcome === "MISSED" ? 12 : 50 },
          durationMs: 650,
        };
      if (type === "GOALKEEPER_SAVE")
        payload.stage = {
          from: { x: home ? 7 : 93, y: 50 },
          to: { x: home ? 8 : 92, y: 50 },
          durationMs: 300,
        };
      if (type === "RESTART")
        payload.stage = {
          from:
            payload.outcome === "KICKOFF"
              ? { x: 50, y: 50 }
              : point(team[0]?.id),
          to:
            payload.outcome === "KICKOFF"
              ? { x: 50, y: 50 }
              : point(team[1]?.id),
          durationMs: 1500,
        };
    }
    events.push({ sequence: events.length + 1, offsetMs, type, payload });
  };
  let homeGoals = 0,
    awayGoals = 0;
  emit(0, "MATCH_STARTED", {});
  let lastHome: boolean | null = null;
  for (let i = 0; i < 9; i++) {
    const home =
      rand(6000) <
      clamp(3000 + strength(match.home) - strength(match.away), 1200, 4800);
    const team = home ? "HOME" : "AWAY",
      attackers = home ? match.home : match.away,
      defenders = home ? match.away : match.home;
    const actorId =
        attackers[match.rulesVersion === "M1-E0.1" ? rand(5) : 1 + rand(4)].id,
      offset = 5000 + i * 10000;
    if (match.rulesVersion !== "M1-E0.1") {
      const sourceActorId = attackers[1 + ((i + 1) % 4)].id;
      if (
        match.rulesVersion === "RETRO-E2" &&
        lastHome !== null &&
        lastHome !== home
      )
        emit(offset - 4500, "TACKLE", {
          team,
          actorId: sourceActorId,
          outcome: "POSSESSION_WON",
        });
      emit(offset - 4000, "POSSESSION_CHANGED", {
        team,
        actorId: sourceActorId,
      });
      emit(offset - 2000, "PASS_COMPLETED", { team, actorId, sourceActorId });
    } else emit(offset, "POSSESSION_CHANGED", { team, actorId });
    emit(offset, "CHANCE_CREATED", { team, actorId });
    const goal =
      rand(10000) <
      clamp(2500 + attack(attackers) - defense(defenders), 1000, 7500);
    if (goal) {
      if (home) homeGoals++;
      else awayGoals++;
    }
    emit(offset + 2000, "SHOT_RESOLVED", {
      team,
      actorId,
      outcome: goal ? "GOAL" : rand(2) === 0 ? "SAVED" : "MISSED",
      homeGoals,
      awayGoals,
    });
    if (match.rulesVersion === "RETRO-E2") {
      const shot = events.at(-1)!;
      if (shot.payload.outcome === "SAVED")
        emit(offset + 2700, "GOALKEEPER_SAVE", {
          team: home ? "AWAY" : "HOME",
          actorId: defenders[0].id,
          outcome: "SAVED",
        });
      if (goal || shot.payload.outcome === "MISSED")
        emit(offset + 4300, "RESTART", {
          team: home ? "AWAY" : "HOME",
          actorId: defenders[goal ? 1 : 0].id,
          outcome: goal ? "KICKOFF" : "GOAL_KICK",
        });
    }
    lastHome = home;
  }
  const outcome =
    homeGoals > awayGoals ? "WIN" : homeGoals === awayGoals ? "DRAW" : "LOSS";
  emit(90000, "MATCH_ENDED", { homeGoals, awayGoals, outcome });
  return {
    events,
    result: { homeGoals, awayGoals, outcome } as NonNullable<
      MatchView["result"]
    >,
  };
}
/** Public live projection: never serialize the seed or future events. Reads grant nothing. */
export function liveMatch(
  match: MatchView,
  seed: string,
  now: number,
): MatchView {
  const teams = {
    home: match.home.map((a, i) => identify(structuredClone(a), i)),
    away: match.away.map((a, i) => identify(structuredClone(a), i)),
  };
  if (match.state === "SETTLED")
    return { ...match, ...teams, liveScore: match.result ?? undefined };
  const elapsed = Math.max(0, Math.min(90000, now - match.startAt));
  const events = simulate(match, seed).events.filter(
    (e) => e.offsetMs <= elapsed,
  );
  const score = events
    .filter((e) => e.payload.homeGoals !== undefined)
    .at(-1)?.payload;
  return {
    ...match,
    ...teams,
    events,
    result: null,
    reward: null,
    liveScore: {
      homeGoals: score?.homeGoals ?? 0,
      awayGoals: score?.awayGoals ?? 0,
    },
  };
}
