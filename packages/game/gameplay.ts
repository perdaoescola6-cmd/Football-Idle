import { randomUUID } from "node:crypto";
import type { Gameplay } from "../contracts/index.js";
import { alphaParameters as p, regions } from "../contracts/world.js";
import {
  coverage,
  ensureRenewals,
  GameError,
  isOnline,
  startMatch,
  type State,
} from "./engine.js";
import { makeAthlete, makeNpc } from "./simulation.js";
import { addAthleteXp, rarityForRoll } from "./rules.js";
import { deriveSeed, randomStream } from "./random.js";
import { npcPrice } from "../contracts/roster.js";
import { attributeKeys } from "../contracts/index.js";
import { defaultScouting } from "./scouting.js";

export function gameplay(s: State): Gameplay {
  const g = (s.runtime.gameplay ??= {
    trainingSlots: 2,
    training: [],
    scout: null,
    scoutSequence: 0,
    league: null,
  });
  g.scouting ??= defaultScouting();
  g.discoveries ??= [];
  return g;
}
export function coins(s: State, amount: bigint, reason: string, now: number) {
  if (amount === 0n) return;
  const balance = BigInt(s.runtime.balance) + amount;
  if (balance < BigInt(s.reservedCoins ?? "0"))
    throw new GameError(
      "INSUFFICIENT_COINS",
      "Coins insuficientes para esta ação.",
    );
  s.runtime.balance = balance.toString();
  s.runtime.walletVersion++;
  (s.journal ??= []).push({
    id: randomUUID(),
    delta: String(amount),
    balanceAfter: String(balance),
    version: s.runtime.walletVersion,
    at: now,
    reason,
  });
}
export function freeReserve(s: State, id: string, allowProtected = false) {
  const a = s.athletes.find((a) => a.id === id);
  if (!a)
    throw new GameError(
      "ATHLETE_NOT_FOUND",
      "Atleta não pertence a este clube.",
      404,
    );
  if (
    (!allowProtected && a.protected) ||
    s.runtime.lineup.includes(id) ||
    s.current?.view.home.some((a) => a.id === id) ||
    gameplay(s).training.some((t) => t.athleteId === id) ||
    s.lockedAthletes?.includes(id)
  )
    throw new GameError(
      "ATHLETE_BUSY",
      "Use um reserva fora do treino, da partida e do mercado.",
    );
  return a;
}
export function trainTick(s: State, now: number) {
  const g = gameplay(s);
  for (const t of g.training) {
    const a = s.athletes.find((a) => a.id === t.athleteId);
    if (t.paused) {
      t.status = "PAUSED";
      t.lastAt = now;
    } else if (a && attributeKeys.every((k) => a.attributes[k] >= a.caps[k])) {
      t.status = "CAPPED";
      t.lastAt = now;
    }
  }
  if (!g.training.some((t) => !t.paused && t.status !== "CAPPED")) {
    delete s.runtime.trainingClock;
    return;
  }
  ensureRenewals(s, now);
  const active = g.training.filter((t) => !t.paused && t.status !== "CAPPED");
  const work = active.map((slot) => ({
    slot,
    due: Math.max(0, Math.floor((now - slot.lastAt) / p.trainingStepMs)),
  }));
  const end = Math.max(
    ...work.map(
      (w) => w.slot.lastAt + Math.min(1440, w.due) * p.trainingStepMs,
    ),
  );
  const clock = (s.runtime.trainingClock ??= {
    through: Math.min(...active.map((t) => t.lastAt)),
    timeline: [],
  });
  if (end > clock.through) {
    clock.timeline.push(...coverage(s, clock.through, end, true).timeline);
    clock.through = end;
  }
  // A shared clock avoids counting overlapping slots twice. Unpaid cycles create no debt.
  for (const slot of g.training) {
    if (slot.paused) {
      slot.lastAt = now;
      slot.status = "PAUSED";
      continue;
    }
    const athlete = s.athletes.find((a) => a.id === slot.athleteId);
    if (
      athlete &&
      attributeKeys.every((k) => athlete.attributes[k] >= athlete.caps[k])
    ) {
      slot.lastAt = now;
      slot.status = "CAPPED";
      continue;
    }
    const due = Math.max(0, Math.floor((now - slot.lastAt) / p.trainingStepMs));
    if (!due) continue;
    let count = 0,
      xp = 0n;
    const a = s.athletes.find((a) => a.id === slot.athleteId);
    for (let i = 0; i < Math.min(due, 1440); i++) {
      if (
        BigInt((count + 1) * p.trainingCost) >
        BigInt(s.runtime.balance) - BigInt(s.reservedCoins ?? "0")
      )
        break;
      const from = slot.lastAt + i * p.trainingStepMs,
        to = from + p.trainingStepMs;
      const weighted = clock.timeline.reduce(
        (sum, t) =>
          sum +
          Math.max(0, Math.min(to, t.end) - Math.max(from, t.start)) *
            (t.online ? 2 : 1),
        0,
      );
      if (!weighted) continue;
      const key = "training-xp:" + slot.athleteId,
        units =
          BigInt(weighted * p.trainingXp) + BigInt(s.runtime.carry[key] ?? "0");
      xp += units / 120000n;
      s.runtime.carry[key] = String(units % 120000n);
      count++;
    }
    if (a && count) {
      coins(s, -BigInt(count * p.trainingCost), "CT_MAINTENANCE", now);
      addAthleteXp(a, xp);
      slot.paidSteps += count;
    }
    slot.status =
      BigInt(s.runtime.balance) - BigInt(s.reservedCoins ?? "0") <
      BigInt(p.trainingCost)
        ? "NO_COINS"
        : "ACTIVE";
    slot.lastAt += due * p.trainingStepMs;
  }
  const earliest = Math.min(...g.training.map((t) => t.lastAt));
  clock.timeline = clock.timeline.filter((t) => t.end > earliest);
  clock.through = Math.max(clock.through, earliest);
}
export type ClubCommand =
  | { action: "NPC_SELL" | "TRAIN_START" | "TRAIN_STOP"; athleteId: string }
  | {
      action:
        | "SCOUT_START"
        | "SCOUT_CLAIM"
        | "TRAIN_EXPAND"
        | "LEAGUE_JOIN"
        | "LEAGUE_PLAY";
    }
  | { action: "SUPPLY_SELL"; quantity: number };
export function command(s: State, c: ClubCommand, now: number) {
  const g = gameplay(s);
  if (c.action === "NPC_SELL") {
    const a = freeReserve(s, c.athleteId);
    const price = Number(npcPrice(a));
    coins(s, BigInt(price), "NPC_ATHLETE_SALE", now);
    s.athletes = s.athletes.filter((x) => x.id !== a.id);
    return { message: `${a.displayName} foi negociado por ${price} Coins.` };
  }
  if (c.action === "SUPPLY_SELL") {
    if (BigInt(c.quantity) > BigInt(s.runtime.commonSupply))
      throw new GameError("INSUFFICIENT_SUPPLY", "Suprimentos insuficientes.");
    s.runtime.commonSupply = String(
      BigInt(s.runtime.commonSupply) - BigInt(c.quantity),
    );
    (s.materialJournal ??= []).push({
      id: randomUUID(),
      delta: String(-c.quantity),
      at: now,
      reason: "NPC_SUPPLY_SALE",
    });
    coins(s, BigInt(c.quantity * p.supplyValue), "NPC_SUPPLY_SALE", now);
  }
  if (c.action === "SCOUT_START")
    throw new GameError(
      "SCOUT_REPLACED",
      "O novo olheiro organiza drops sem custos. Novas buscas pagas estão desativadas.",
    );
  if (c.action === "SCOUT_CLAIM") {
    if (!g.scout || now < g.scout.readyAt)
      throw new GameError(
        "SCOUT_NOT_READY",
        "O olheiro ainda está buscando talentos.",
      );
    if (!isOnline(s, now))
      throw new GameError(
        "ONLINE_REQUIRED",
        "Volte online para receber o atleta.",
      );
    const a = g.scout.athlete!;
    s.athletes.push(a);
    g.scout = null;
    return { message: `${a.displayName} chegou ao clube!`, athlete: a };
  }
  if (c.action === "TRAIN_START") {
    freeReserve(s, c.athleteId, true);
    if (g.training.length >= g.trainingSlots)
      throw new GameError("CT_FULL", "Todos os slots do CT estão ocupados.");
    if (!g.training.length) delete s.runtime.trainingClock;
    g.training.push({ athleteId: c.athleteId, lastAt: now, paidSteps: 0 });
  }
  if (c.action === "TRAIN_STOP")
    g.training = g.training.filter((t) => t.athleteId !== c.athleteId);
  if (c.action === "TRAIN_EXPAND") {
    if (g.trainingSlots >= 5)
      throw new GameError("CT_MAX", "O CT já tem cinco slots.");
    coins(s, -BigInt(p.trainingSlotCost), "CT_EXPANSION", now);
    g.trainingSlots++;
  }
  if (c.action === "LEAGUE_JOIN") {
    if (g.league && g.league.endsAt > now)
      throw new GameError("SEASON_ACTIVE", "Sua temporada já está ativa.");
    if (s.current?.view.leagueSeasonId)
      throw new GameError("MATCH_ACTIVE", "Aguarde sua partida terminar.");
    g.league = {
      id: randomUUID(),
      endsAt: now + 14 * 86400000,
      division: Math.min(7, 1 + Number(BigInt(s.runtime.clubXp) / 6000n)),
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      records: [],
    };
  }
  if (c.action === "LEAGUE_PLAY") {
    const l = g.league;
    if (!l || l.endsAt <= now)
      throw new GameError("SEASON_ENDED", "Entre em uma temporada ativa.");
    if (l.games >= 20)
      throw new GameError(
        "LEAGUE_LIMIT",
        "Você já disputou os vinte jogos desta temporada.",
      );
    if (s.current || s.runtime.farm.running)
      throw new GameError(
        "MATCH_ACTIVE",
        "Pare o farm e aguarde a partida atual terminar.",
      );
    startMatch(s, now);
    s.current!.view.leagueSeasonId = l.id;
    // Alpha has fictional division opponents; selection remains server-authoritative.
    const region = regions[l.division - 1].id;
    s.current!.view.regionId = region;
    s.current!.view.away = makeNpc(s.current!.seed, region);
  }
  return { message: "Ação concluída." };
}
