import type {
  CardEdition,
  FootballEvent,
  FootballMatch,
  Formation,
  TeamMatchStats,
  Tactic,
} from "../contracts/brasfoot.js";
import {
  conditionMultiplier,
  playerEnergy,
} from "../contracts/match-management.ts";
import { randomStream } from "./random.js";
import { gameAttributes } from "../contracts/card-model.js";
export function formationPoints(formation: Formation, side: number) {
  const rows = [1, ...formation.split("-").map(Number)],
    result: { x: number; y: number }[] = [];
  rows.forEach((count, row) => {
    for (let i = 0; i < count; i++)
      result.push({
        x:
          side === 0
            ? 5 + row * (42 / (rows.length - 1))
            : 95 - row * (42 / (rows.length - 1)),
        y: ((i + 1) * 100) / (count + 1),
      });
  });
  return result;
}
export function simulateFootball(input: {
  seed: string;
  home: CardEdition[];
  away: CardEdition[];
  ownSide: number;
  formation: Formation;
  tactic: Tactic;
  captain?: string;
  fromMinute?: number;
  initialScore?: [number, number];
  fatigue?: boolean;
  entries?: Record<string, number>;
}): { events: FootballEvent[]; score: [number, number] } {
  const rng = randomStream(input.seed, "events-v2"),
    teams = [input.home, input.away],
    score: [number, number] = [...(input.initialScore ?? [0, 0])];
  let currentMinute = 0;
  const baseAttrs = (c: CardEdition) =>
    c.attributes ??
    gameAttributes(
      c.rating,
      c.role ??
        (c.position === "GOL"
          ? "GOL"
          : c.position === "DEF"
            ? "ZAG"
            : c.position === "MEI"
              ? "MEI"
              : "ATA"),
      1,
    );
  const attrs = (c: CardEdition) => {
    const base = baseAttrs(c);
    if (!input.fatigue) return base;
    const factor = conditionMultiplier(
      playerEnergy(c, currentMinute, input.entries?.[c.id] ?? 0),
    );
    const result = { ...base };
    for (const key of Object.keys(base) as (keyof typeof base)[])
      result[key] = base[key] * factor;
    return result;
  };
  const bases = [
    formationPoints(input.ownSide === 0 ? input.formation : "4-4-2", 0),
    formationPoints(input.ownSide === 1 ? input.formation : "4-4-2", 1),
  ];
  const frames = (minute: number, side: number) => ({
    home: bases[0].map((p, i) => ({
      x: Math.max(
        3,
        Math.min(
          97,
          p.x +
            (i === 0 ? 0 : side === 0 ? 8 : -2) +
            Math.sin(minute * 0.6 + i) * 3,
        ),
      ),
      y: Math.max(6, Math.min(94, p.y + Math.sin(minute * 0.4 + i * 2) * 5)),
    })),
    away: bases[1].map((p, i) => ({
      x: Math.max(
        3,
        Math.min(
          97,
          p.x +
            (i === 0 ? 0 : side === 1 ? -8 : 2) +
            Math.sin(minute * 0.6 + i) * 3,
        ),
      ),
      y: Math.max(6, Math.min(94, p.y + Math.sin(minute * 0.4 + i * 2) * 5)),
    })),
  });
  const initial = frames(0, 0),
    events: FootballEvent[] =
      (input.fromMinute ?? 1) > 1
        ? []
        : [
            {
              minute: 0,
              type: "KICKOFF",
              side: "HOME",
              actor: input.home[9].player,
              actorId: input.home[9].id,
              x: 50,
              y: 50,
              players: input.fatigue ? undefined : initial,
              narration: "O árbitro autoriza. Bola rolando!",
            },
          ];
  let side = 0,
    owner = 6,
    lastPass: {
      side: number;
      id: string;
      name: string;
      minute: number;
    } | null = null;
  const avg = (team: CardEdition[], key: keyof ReturnType<typeof attrs>) =>
    team.reduce((sum, c) => sum + attrs(c)[key], 0) / team.length;
  for (let minute = input.fromMinute ?? 1; minute < 90; minute++) {
    currentMinute = minute;
    const advantage =
      (avg(teams[0], "passing") - avg(teams[1], "passing")) * 0.2;
    if (rng(100) < 24) {
      side = rng(100) < 50 + advantage ? 0 : 1;
      owner = 5 + rng(6);
      lastPass = null;
    }
    const team = teams[side],
      other = teams[1 - side],
      sideName = side === 0 ? ("HOME" as const) : ("AWAY" as const),
      frame = frames(minute, side),
      points = side === 0 ? frame.home : frame.away;
    const nextReceiver = 1 + rng(10),
      receiver =
        nextReceiver === owner ? 1 + (nextReceiver % 10) : nextReceiver;
    const source = team[owner],
      from = points[owner],
      dest = points[receiver];
    const dribble = rng(100) < 25,
      actor = dribble ? source : team[receiver];
    const target = dribble
      ? {
          x: Math.max(5, Math.min(95, from.x + (side === 0 ? 6 : -6))),
          y: from.y,
        }
      : dest;
    events.push({
      minute,
      type: dribble ? "DRIBBLE" : "PASS",
      side: sideName,
      actor: source.player,
      actorId: source.id,
      receiverId: actor.id,
      receiverName: actor.player,
      from,
      x: target.x,
      y: target.y,
      players: input.fatigue ? undefined : frame,
      narration: dribble
        ? `${source.player} conduz e avança.`
        : `${source.player} encontra ${actor.player} com um passe.`,
    });
    if (!dribble) {
      lastPass = { side, id: source.id, name: source.player, minute };
      owner = receiver;
    }
    const attacking = team[owner],
      a = attrs(attacking),
      own = side === input.ownSide;
    const tactic = own
      ? input.tactic === "ATTACK"
        ? 1.25
        : input.tactic === "DEFEND"
          ? 0.77
          : 1
      : input.tactic === "ATTACK"
        ? 1.12
        : input.tactic === "DEFEND"
          ? 0.8
          : 1;
    const shape =
      own && input.formation === "4-3-3"
        ? 1.1
        : own && input.formation === "4-2-3-1"
          ? 1.04
          : 1;
    const leadership =
      own && team.some((c) => c.id === input.captain) ? 1.015 : 1;
    const shotChance = Math.min(
      38,
      (10 + a.finishing * 0.11 - avg(other, "defending") * 0.035) *
        tactic *
        shape *
        leadership,
    );
    if (attacking.position !== "GOL" && rng(10000) < shotChance * 100) {
      const goalPoint = { x: side === 0 ? 98 : 2, y: 43 + rng(15) };
      events.push({
        minute: minute + 0.15,
        type: "SHOT",
        side: sideName,
        actor: attacking.player,
        actorId: attacking.id,
        from: target,
        x: goalPoint.x,
        y: goalPoint.y,
        players: input.fatigue ? undefined : frame,
        narration: `${attacking.player} finaliza!`,
      });
      const goalie = other[0],
        g = attrs(goalie),
        onTarget = rng(100) < Math.min(90, 45 + a.finishing * 0.35);
      if (onTarget) {
        const conversion = Math.max(
          7,
          Math.min(
            55,
            26 + (a.finishing - (g.reflexes + g.positioning) / 2) * 0.65,
          ),
        );
        const goal = rng(100) < conversion;
        if (goal) {
          score[side]++;
          const assist =
            lastPass &&
            lastPass.side === side &&
            lastPass.id !== attacking.id &&
            minute - lastPass.minute <= 2
              ? lastPass
              : null;
          events.push({
            minute: minute + 0.4,
            type: "GOAL",
            side: sideName,
            actor: attacking.player,
            actorId: attacking.id,
            assistId: assist?.id,
            assistName: assist?.name,
            from: target,
            x: goalPoint.x,
            y: 50,
            players: input.fatigue ? undefined : frame,
            narration: `GOOOL de ${attacking.player}!${assist ? ` Assistência de ${assist.name}.` : ""}`,
          });
        } else
          events.push({
            minute: minute + 0.4,
            type: "SAVE",
            side: side === 0 ? "AWAY" : "HOME",
            actor: goalie.player,
            actorId: goalie.id,
            from: goalPoint,
            x: side === 0 ? 94 : 6,
            y: 50,
            players: input.fatigue ? undefined : frame,
            narration: `${goalie.player} faz a defesa e evita o gol.`,
          });
      }
      side = 1 - side;
      owner = 0;
      lastPass = null;
    }
  }
  events.push({
    minute: 90,
    type: "FULLTIME",
    side: "HOME",
    actor: "",
    x: 50,
    y: 50,
    players: input.fatigue ? undefined : frames(90, 0),
    narration: "Fim de jogo. Resultado confirmado pelo árbitro.",
  });
  return { events, score };
}

export {
  matchStatistics,
  playerMatchRating,
} from "../contracts/match-report.ts";
