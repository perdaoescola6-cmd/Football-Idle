import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClub } from "../packages/game/engine.js";
import {
  initializeFootball,
  startFootballMatch,
  settleFootball,
  footballView,
} from "../packages/game/brasfoot.js";
import {
  pauseRound,
  resumeRound,
  substituteFootball,
} from "../packages/game/football-management.js";
import {
  playingMinute,
  playerEnergy,
} from "../packages/contracts/match-management.js";
import { playerIdentity } from "../packages/contracts/card-model.js";
import { catalog, edition } from "../packages/game/card-catalog.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

function setup() {
  const s = createClub(randomUUID(), "Clube treinador", "manager-qa", 1000);
  initializeFootball(s, 1000);
  return s;
}
function reserve(s: ReturnType<typeof setup>, position: string) {
  const f = s.runtime.brasfoot!,
    identities = new Set(
      f.cards.map((c) => playerIdentity(edition(c.editionId))),
    );
  const card = catalog.find(
    (c) => c.position === position && !identities.has(playerIdentity(c)),
  )!;
  assert.ok(card);
  const owned = {
    id: randomUUID(),
    editionId: card.id,
    locked: false,
    storage: "COLLECTION" as const,
    acquiredAt: 1000,
  };
  f.cards.push(owned);
  f.bench.push(owned.id);
  return owned;
}

test("manager round: four simultaneous streams, no future disclosure, pause survives hours and settles the exact displayed games once", () => {
  const s = setup(),
    f = s.runtime.brasfoot!;
  startFootballMatch(s, 1000);
  const m = f.match!;
  assert.equal(f.roundMatches!.length, 3);
  const view = footballView(s, 21000)!;
  assert.equal(view.match!.score, undefined);
  for (const x of [view.match!, ...view.roundMatches!]) {
    assert.equal(x.startAt, 1000);
    assert.ok(x.events.every((e) => e.minute <= 20));
    assert.equal(x.score, undefined);
    assert.ok(x.statistics!.home.goals >= 0);
  }
  const original = structuredClone(
    [m, ...f.roundMatches!].map((x) => x.events),
  );
  pauseRound(s, m.id, 21000);
  const frozen = footballView(s, 21000)!;
  settleFootball(s, 21000 + 3600000);
  assert.ok(f.match);
  assert.equal(f.season.round, 1);
  const later = footballView(s, 21000 + 3600000)!;
  assert.deepEqual(later.match!.events, frozen.match!.events);
  assert.deepEqual(
    later.roundMatches!.map((x) => x.events),
    frozen.roundMatches!.map((x) => x.events),
  );
  assert.equal(playingMinute(m, 999999999), 20);
  resumeRound(s, m.id, 21000 + 3600000);
  assert.equal(m.endAt, 91000 + 3600000);
  assert.deepEqual(
    [m, ...f.roundMatches!].map((x) => x.events),
    original,
  );
  const balance = s.runtime.balance;
  settleFootball(s, m.endAt);
  assert.equal(f.match, null);
  assert.equal(f.season.round, 2);
  assert.equal(f.lastRound!.matches.length, 4);
  for (const x of f.lastRound!.matches) {
    const fixture = f.season.fixtures.find((y) => y.id === x.fixtureId)!;
    assert.deepEqual(fixture.score, x.score);
  }
  assert.ok(BigInt(s.runtime.balance) > BigInt(balance));
  const paid = s.runtime.balance;
  settleFootball(s, m.endAt + 1000);
  assert.equal(s.runtime.balance, paid);
});

test("manager substitutions preserve revealed events, forbid re-entry, restore fresh condition and credit real participant minutes", () => {
  const s = setup(),
    f = s.runtime.brasfoot!,
    incoming = reserve(s, "DEF");
  startFootballMatch(s, 1000);
  const m = f.match!,
    ids = m.homeAI ? m.awayOwnedIds! : m.homeOwnedIds!,
    outId = ids[2],
    outCard = structuredClone((m.homeAI ? m.away : m.home)[2]);
  assert.throws(
    () => substituteFootball(s, m.id, outId, incoming.id, 39000),
    /Pause/,
  );
  pauseRound(s, m.id, 39000);
  const past = structuredClone(m.events.filter((e) => e.minute <= 38));
  substituteFootball(s, m.id, outId, incoming.id, 39000);
  assert.deepEqual(m.events.slice(0, past.length), past);
  assert.ok(m.events.some((e) => e.type === "SUBSTITUTION"));
  assert.ok(
    m.events
      .filter((e) => e.minute > 38 && e.side === (m.homeAI ? "AWAY" : "HOME"))
      .every((e) => e.actorId !== outCard.id),
  );
  assert.ok(playerEnergy(outCard, 38) < 100);
  assert.equal(playerEnergy(edition(incoming.editionId), 38, 38), 100);
  assert.throws(
    () => substituteFootball(s, m.id, incoming.id, outId, 39000),
    /retornar/,
  );
  const frozen = JSON.stringify(m.events);
  pauseRound(s, m.id, 40000);
  assert.equal(JSON.stringify(m.events), frozen);
  resumeRound(s, m.id, 99000);
  settleFootball(s, m.endAt);
  const outRecord = f.performance![playerIdentity(outCard)],
    inRecord = f.performance![playerIdentity(edition(incoming.editionId))];
  assert.equal(outRecord.minutes, 38);
  assert.equal(inRecord.minutes, 52);
  assert.equal(outRecord.appearances, 1);
  assert.equal(inRecord.appearances, 1);
  startFootballMatch(s, m.endAt + 1);
  assert.equal(
    playerEnergy((f.match!.homeAI ? f.match!.away : f.match!.home)[2], 0),
    100,
  );
});

test("substitution validation: ownership, position, stale game, five changes and no change of already closed games", () => {
  const s = setup(),
    f = s.runtime.brasfoot!,
    original = [...f.lineup];
  const reserves = original
    .slice(0, 5)
    .map((id) =>
      reserve(s, edition(f.cards.find((c) => c.id === id)!.editionId).position),
    );
  startFootballMatch(s, 1000);
  const m = f.match!;
  pauseRound(s, m.id, 25000);
  assert.throws(
    () =>
      substituteFootball(s, randomUUID(), original[0], reserves[0].id, 25000),
    /mudou/,
  );
  assert.throws(
    () => substituteFootball(s, m.id, original[0], randomUUID(), 25000),
    /disponível/,
  );
  assert.throws(
    () => substituteFootball(s, m.id, original[0], reserves[1].id, 25000),
    /setor/,
  );
  for (let i = 0; i < 5; i++)
    substituteFootball(s, m.id, original[i], reserves[i].id, 25000);
  assert.equal(m.substitutions!.length, 5);
  assert.throws(
    () => substituteFootball(s, m.id, original[5], original[0], 25000),
    /cinco/,
  );
  resumeRound(s, m.id, 30000);
  settleFootball(s, m.endAt);
  assert.throws(() => pauseRound(s, m.id, m.endAt + 1), /terminou/);
});

test("manager API: pause/resume idempotency, malicious clock rejected, persistence through app rebuild and packs-mode market disabled", async () => {
  const db = await openDatabase({ memory: true });
  let now = 100000,
    built = await buildApp(db, { clock: () => now });
  const base = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  try {
    const guest = await built.app.inject({
        method: "POST",
        url: "/v1/auth/guest",
        headers: base,
        payload: {},
      }),
      cookie = `fi_session=${guest.cookies[0].value}`,
      headers = { ...base, cookie };
    const call = (payload: object, key = randomUUID()) =>
      built.app.inject({
        method: "POST",
        url: "/v1/brasfoot/command",
        headers: { ...headers, "idempotency-key": key },
        payload,
      });
    const view = async () =>
      (
        await built.app.inject({ url: "/v1/bootstrap", headers: { cookie } })
      ).json().data.game;
    assert.equal(
      (
        await built.app.inject({
          method: "POST",
          url: "/v1/clubs",
          headers: { ...headers, "idempotency-key": randomUUID() },
          payload: { name: "Treinador API" },
        })
      ).statusCode,
      201,
    );
    assert.equal((await call({ action: "INIT" })).statusCode, 200);
    assert.equal((await call({ action: "PLAY" })).statusCode, 200);
    const matchId = (await view()).brasfoot.match.id;
    now += 23000;
    const key = randomUUID(),
      pause = await call({ action: "PAUSE", matchId }, key);
    assert.equal(pause.statusCode, 200, pause.body);
    now += 86400000;
    assert.deepEqual(
      (await call({ action: "PAUSE", matchId }, key)).json().data,
      pause.json().data,
    );
    assert.equal(
      (await call({ action: "RESUME", matchId, now: 1 })).statusCode,
      400,
    );
    await built.app.close();
    built = await buildApp(db, { clock: () => now });
    let g = await view();
    assert.equal(g.brasfoot.match.pausedAt, 123000);
    assert.ok(
      g.brasfoot.roundMatches.every((m: { events: { minute: number }[] }) =>
        m.events.every((e) => e.minute <= 23),
      ),
    );
    const resumeKey = randomUUID();
    assert.equal(
      (await call({ action: "RESUME", matchId }, resumeKey)).statusCode,
      200,
    );
    const end = (await view()).brasfoot.match.endAt;
    now += 10000;
    assert.equal(
      (await call({ action: "RESUME", matchId }, resumeKey)).statusCode,
      200,
    );
    assert.equal((await view()).brasfoot.match.endAt, end);
    const trade = await built.app.inject({
      method: "POST",
      url: "/v1/brasfoot/market",
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { action: "LIST", cardId: g.brasfoot.cards[0].id, price: "100" },
    });
    assert.equal(trade.statusCode, 409);
    assert.match(trade.body, /PACKS_MODE/);
    now = end;
    await built.repo.tick();
    g = await view();
    assert.equal(g.brasfoot.match, null);
    assert.equal(g.brasfoot.season.round, 2);
    assert.equal(g.brasfoot.lastRound.matches.length, 4);
    const settled = structuredClone(g);
    for (const match of g.brasfoot.lastRound.matches) {
      assert.deepEqual(match.score, [
        match.events.filter(
          (e: { type: string; side: string }) =>
            e.type === "GOAL" && e.side === "HOME",
        ).length,
        match.events.filter(
          (e: { type: string; side: string }) =>
            e.type === "GOAL" && e.side === "AWAY",
        ).length,
      ]);
      assert.deepEqual(match.score, [
        match.statistics.home.goals,
        match.statistics.away.goals,
      ]);
    }
    now += 5000;
    await built.repo.tick();
    await built.app.close();
    built = await buildApp(db, { clock: () => now });
    await built.repo.tick();
    g = await view();
    assert.equal(g.wallet.balance, settled.wallet.balance);
    assert.deepEqual(g.brasfoot.history, settled.brasfoot.history);
    assert.deepEqual(g.brasfoot.lastRound, settled.brasfoot.lastRound);
    assert.deepEqual(g.brasfoot.performance, settled.brasfoot.performance);
    assert.deepEqual(g.brasfoot.season, settled.brasfoot.season);
    const reward = (
      await db.query<{ count: string; total: string }>(
        "SELECT count(*)::text count, sum(delta)::text total FROM coin_ledger_entries WHERE reason=$1",
        [`BR_OFFICIAL_MATCH:${matchId}`],
      )
    ).rows[0];
    assert.equal(reward.count, "1");
    assert.equal(reward.total, String(g.brasfoot.history[0].reward));
  } finally {
    await built.app.close();
    await db.close();
  }
});
