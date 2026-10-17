import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { catalog, edition } from "../packages/game/card-catalog.js";
import {
  ovr,
  effectiveCard,
  playerIdentity,
  ovrWeights,
} from "../packages/contracts/card-model.js";
import {
  rarities,
  packs,
  type CardEdition,
} from "../packages/contracts/brasfoot.js";
import { createClub } from "../packages/game/engine.js";
import {
  initializeFootball,
  footballView,
  startFootballMatch,
  settleFootball,
  suggestLineup,
  trainCard,
  packRarity,
} from "../packages/game/brasfoot.js";
import {
  simulateFootball,
  matchStatistics,
} from "../packages/game/football-simulation.js";
import { randomStream } from "../packages/game/random.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

function club() {
  const s = createClub(randomUUID(), "V2 Teste", "v2-seed", 1000);
  initializeFootball(s, 1000);
  return s;
}
test("V2 catalogue: 600+ consistent identities, factual provenance, fixed editions, all pools and position-specific OVR", () => {
  assert.ok(new Set(catalog.map(playerIdentity)).size >= 600);
  assert.equal(new Set(catalog.map((c) => c.id)).size, catalog.length);
  for (const card of catalog) {
    assert.ok(card.profile);
    assert.ok(card.profile.country);
    assert.ok(card.profile.fullName);
    assert.ok(card.profile.birthDate);
    assert.ok(card.profile.club);
    assert.ok(card.role);
    assert.equal(ovr(card.attributes!, card.role!), card.rating);
    assert.ok(card.potential! >= card.rating && card.potential! <= 99);
    if (card.id.startsWith("WC22-")) {
      assert.ok(card.profile.fullName);
      assert.match(card.profile.birthDate!, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(card.profile.club);
      assert.ok(card.profile.heightCm! > 140 && card.profile.heightCm! < 220);
      assert.equal(card.profile.preferredFoot, null);
      assert.equal(card.profile.referenceYear, 2022);
      assert.ok(
        card.profile.sourcePage! >= 1 && card.profile.sourcePage! <= 32,
      );
    }
  }
  for (const rarity of rarities)
    assert.ok(catalog.filter((c) => c.rarity === rarity).length > 5);
  for (const weights of Object.values(ovrWeights))
    assert.ok(
      Math.abs(Object.values(weights).reduce((n, v) => n + v, 0) - 1) < 1e-9,
    );
  const goalie = catalog.find((c) => c.position === "GOL")!,
    g = { ...goalie.attributes!, finishing: 99 };
  assert.equal(ovr(g, "GOL"), goalie.rating);
});
test("V2 packs: reproducible probabilistic distribution and every edition is reachable in its rarity pool", () => {
  const rng = randomStream("v2-probability", "rolls");
  for (const pack of packs) {
    const counts = [0, 0, 0, 0, 0],
      n = 100000;
    for (let i = 0; i < n; i++) {
      const r = packRarity(pack, 4, rng(10000));
      counts[rarities.indexOf(r)]++;
    }
    pack.weights.forEach((weight, i) => {
      const expected = (n * weight) / 10000,
        deviation =
          6 * Math.sqrt(((n * weight) / 10000) * (1 - weight / 10000)) + 2;
      assert.ok(
        Math.abs(counts[i] - expected) <= deviation,
        `${pack.id} ${rarities[i]}`,
      );
    });
  }
  for (const rarity of rarities) {
    const pool = catalog.filter((c) => c.rarity === rarity),
      seen = new Set<string>();
    for (let i = 0; i < 50000; i++) seen.add(pool[rng(pool.length)].id);
    assert.equal(seen.size, pool.length);
  }
});
test("V2 events: goalkeeper saves, real pass assists, frame bounds, statistics from events and no future disclosure", () => {
  const s = club();
  startFootballMatch(s, 1000);
  const m = s.runtime.brasfoot!.match!;
  for (const e of m.events) {
    const team = e.side === "HOME" ? m.home : m.away;
    if (e.type === "SAVE")
      assert.equal(team.find((c) => c.id === e.actorId)?.position, "GOL");
    if (e.type === "GOAL" && e.assistId) {
      assert.ok(e.assistId !== e.actorId);
      assert.ok(
        m.events.some(
          (p) =>
            p.type === "PASS" &&
            p.actorId === e.assistId &&
            p.receiverId === e.actorId &&
            p.minute <= e.minute &&
            e.minute - p.minute < 3,
        ),
      );
    }
    for (const point of [
      ...(e.players?.home ?? []),
      ...(e.players?.away ?? []),
    ])
      assert.ok(
        point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100,
      );
  }
  assert.deepEqual(m.statistics, matchStatistics(m.events));
  assert.deepEqual(m.score, [
    m.events.filter((e) => e.type === "GOAL" && e.side === "HOME").length,
    m.events.filter((e) => e.type === "GOAL" && e.side === "AWAY").length,
  ]);
  const early = footballView(s, 1000)!.match!;
  assert.equal(early.score, undefined);
  assert.equal(early.statistics!.home.shots, 0);
  assert.equal(early.statistics!.away.goals, 0);
  assert.equal(early.events.length, 1);
  settleFootball(s, 91000);
  const f = s.runtime.brasfoot!,
    ownSide = m.homeAI ? 1 : 0,
    records = Object.values(f.performance!);
  assert.equal(records.length, 11);
  for (const fixture of f.season.fixtures.filter((m) => m.round === 1)) {
    assert.equal(fixture.engineVersion, "football-manager-v3");
    assert.deepEqual(fixture.score, [
      fixture.statistics!.home.goals,
      fixture.statistics!.away.goals,
    ]);
  }
  assert.equal(
    records.reduce((n, p) => n + p.goals, 0),
    m.score![ownSide],
  );
  assert.equal(
    records.every((p) => p.appearances === 1),
    true,
  );
  settleFootball(s, 200000);
  assert.equal(
    Object.values(f.performance!).every((p) => p.appearances === 1),
    true,
  );
});
test("V2 tactics and formation affect actual shots over deterministic simulations", () => {
  const home = catalog.slice(0, 11),
    away = [...home];
  let offense = 0,
    defense = 0;
  for (let i = 0; i < 120; i++) {
    const input = {
      seed: `tactic-${i}`,
      home,
      away,
      ownSide: 0,
      formation: "4-3-3" as const,
    };
    offense += simulateFootball({ ...input, tactic: "ATTACK" }).events.filter(
      (e) => e.type === "SHOT" && e.side === "HOME",
    ).length;
    defense += simulateFootball({ ...input, tactic: "DEFEND" }).events.filter(
      (e) => e.type === "SHOT" && e.side === "HOME",
    ).length;
  }
  assert.ok(offense > defense * 1.2, `${offense} vs ${defense}`);
  const input = {
    seed: "same",
    home,
    away,
    ownSide: 0,
    formation: "4-4-2" as const,
    tactic: "BALANCED" as const,
  };
  assert.deepEqual(simulateFootball(input), simulateFootball(input));
});
test("V2 training is paid, bounded, persistent in effective attributes; 4-2-3-1 suggestion uses unique identities", () => {
  const s = club(),
    f = s.runtime.brasfoot!,
    card = f.cards[0],
    base = edition(card.editionId);
  trainCard(s, card.id, 1000);
  assert.equal(s.runtime.balance, "7500");
  assert.equal(effectiveCard(base, card).rating, base.rating + 1);
  trainCard(s, card.id, 1000);
  assert.equal(s.runtime.balance, "2500");
  assert.throws(() => trainCard(s, card.id, 1000), /insuficientes/);
  card.upgrades = 3;
  assert.throws(() => trainCard(s, card.id, 1000), /limite/);
  const extra = catalog.find(
    (c) =>
      c.position === "MEI" &&
      !f.cards.some(
        (o) => playerIdentity(edition(o.editionId)) === playerIdentity(c),
      ),
  )!;
  f.cards.push({
    id: randomUUID(),
    editionId: extra.id,
    locked: false,
    storage: "COLLECTION",
    acquiredAt: 1000,
  });
  suggestLineup(s, "4-2-3-1", "DEFEND");
  assert.equal(f.lineup.length, 11);
  assert.equal(
    f.lineup
      .map((id) => edition(f.cards.find((c) => c.id === id)!.editionId))
      .filter((c) => c.position === "MEI").length,
    5,
  );
});

test("V2 API market: ownership, listing protection, rollback, competing buyers, commission, idempotency and genuine rankings", async () => {
  const db = await openDatabase({ memory: true });
  let now = 100000;
  const { app, repo } = await buildApp(db, { clock: () => now });
  const base = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  async function account(name: string) {
    const g = await app.inject({
        method: "POST",
        url: "/v1/auth/guest",
        headers: base,
        payload: {},
      }),
      headers = { ...base, cookie: `fi_session=${g.cookies[0].value}` };
    const send = (url: string, body: unknown, key = randomUUID()) =>
      app.inject({
        method: "POST",
        url,
        headers: { ...headers, "idempotency-key": key },
        payload: body as object,
      });
    assert.equal((await send("/v1/clubs", { name })).statusCode, 201);
    assert.equal(
      (await send("/v1/brasfoot/command", { action: "INIT" })).statusCode,
      200,
    );
    const view = async () =>
      (await app.inject({ url: "/v1/bootstrap", headers })).json().data.game;
    return { headers, send, view };
  }
  try {
    const seller = await account("Vendedor V2"),
      buyer = await account("Comprador V2"),
      other = await account("Concorrente V2");
    const initial = await seller.view();
    assert.equal(initial.brasfoot.catalog.length, 0);
    const catalogResponse = await app.inject({ url: "/v1/brasfoot/catalog" });
    assert.ok(catalogResponse.json().data.identities >= 600);
    assert.equal(
      (await seller.send("/v1/brasfoot/command", { action: "WELCOME" }))
        .statusCode,
      200,
    );
    let state = await seller.view();
    const reserve = state.brasfoot.cards.find(
      (c: { id: string }) => !state.brasfoot.lineup.includes(c.id),
    );
    assert.equal(
      (
        await seller.send("/v1/brasfoot/market", {
          action: "LIST",
          cardId: state.brasfoot.lineup[0],
          price: "3000",
        })
      ).statusCode,
      422,
    );
    const listing = (
      await seller.send("/v1/brasfoot/market", {
        action: "LIST",
        cardId: reserve.id,
        price: "3000",
      })
    ).json().data.listingId;
    assert.ok(listing);
    assert.equal(
      (
        await seller.send("/v1/brasfoot/command", {
          action: "SELL",
          ids: [reserve.id],
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await buyer.send("/v1/brasfoot/market", {
          action: "CANCEL",
          listingId: listing,
        })
      ).statusCode,
      403,
    );
    await db.query(
      "CREATE FUNCTION v2_fail_trade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA transfer failure'; END; $$",
    );
    await db.query(
      "CREATE TRIGGER v2_fail BEFORE INSERT ON football_card_transfers FOR EACH ROW EXECUTE FUNCTION v2_fail_trade()",
    );
    assert.equal(
      (
        await buyer.send("/v1/brasfoot/market", {
          action: "BUY",
          listingId: listing,
        })
      ).statusCode,
      500,
    );
    assert.equal((await buyer.view()).wallet.balance, "10000");
    assert.equal((await seller.view()).wallet.balance, "10000");
    assert.equal((await seller.view()).brasfoot.cards.length, 16);
    await db.query("DROP TRIGGER v2_fail ON football_card_transfers");
    const key = randomUUID();
    const results = await Promise.all([
      buyer.send(
        "/v1/brasfoot/market",
        { action: "BUY", listingId: listing },
        key,
      ),
      other.send("/v1/brasfoot/market", { action: "BUY", listingId: listing }),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const winning = results[0].statusCode === 200 ? buyer : other;
    assert.equal((await winning.view()).wallet.balance, "7000");
    assert.equal((await seller.view()).wallet.balance, "12550");
    assert.equal(
      (
        await db.query<{ commission: string }>(
          "SELECT commission::text FROM football_card_transfers",
        )
      ).rows[0].commission,
      "450",
    );
    if (results[0].statusCode === 200)
      assert.equal(
        (
          await buyer.send(
            "/v1/brasfoot/market",
            { action: "BUY", listingId: listing },
            key,
          )
        ).statusCode,
        200,
      );
    const acquired = (await winning.view()).brasfoot.cards.find(
      (c: { id: string }) => c.id === reserve.id,
    );
    assert.ok(acquired);
    assert.equal(acquired.clubHistory.at(-1).kind, "TRANSFER");
    const ranksBefore = (
      await app.inject({
        url: "/v1/brasfoot/rankings",
        headers: seller.headers,
      })
    ).json().data;
    assert.equal(ranksBefore.clubs.length, 3);
    assert.equal(ranksBefore.players.length, 0);
    assert.equal(
      (await seller.send("/v1/brasfoot/command", { action: "PLAY" }))
        .statusCode,
      200,
    );
    state = await seller.view();
    assert.equal(state.brasfoot.match.statistics.home.shots, 0);
    now += 90000;
    await repo.tick();
    const after = (
      await app.inject({
        url: "/v1/brasfoot/rankings",
        headers: seller.headers,
      })
    ).json().data;
    assert.equal(after.players.length, 11);
    assert.ok(
      after.players.every((p: { appearances: number }) => p.appearances === 1),
    );
    const profile = await app.inject({
      url: `/v1/brasfoot/clubs/${state.club.id}`,
      headers: buyer.headers,
    });
    assert.equal(profile.statusCode, 200);
    assert.ok(!JSON.stringify(profile.json()).includes("secret"));
    assert.equal(profile.json().data.results.length, 1);
  } finally {
    await app.close();
    await db.close();
  }
});
