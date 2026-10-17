import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClub } from "../packages/game/engine.js";
import {
  initializeFootball,
  openPack,
  packRarity,
  startFootballMatch,
  footballView,
} from "../packages/game/brasfoot.js";
import { coins } from "../packages/game/gameplay.js";
import { catalog, edition } from "../packages/game/card-catalog.js";
import { focusedPool } from "../packages/game/pack-pool.js";
import { packs, rarities } from "../packages/contracts/brasfoot.js";
import {
  packFocuses,
  FOCUS_PACK_VERSION,
} from "../packages/contracts/pack-focus.js";
import { playerArchetype } from "../packages/contracts/player-specialties.js";
import { playerIdentity } from "../packages/contracts/card-model.js";
import { conditionMultiplier } from "../packages/contracts/match-management.js";
import { substitutionAdvice } from "../packages/contracts/substitution-advisor.js";
import {
  pauseRound,
  substituteFootball,
} from "../packages/game/football-management.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

function setup() {
  const s = createClub(randomUUID(), "Ferramentas QA", "club-tools", 1000);
  initializeFootball(s, 1000);
  return s;
}
test("focused packs keep exact prices, slot rarity rolls, floors and five cards; absent sector rarity uses disclosed general fallback", () => {
  const s = setup();
  coins(s, 10000000n, "QA_FUNDS", 1000);
  for (const focus of packFocuses)
    for (const pack of packs) {
      const before = BigInt(s.runtime.balance),
        r = openPack(s, pack.id, 1000, false, focus).receipt;
      assert.equal(BigInt(s.runtime.balance), before - BigInt(pack.price));
      assert.equal(r.cardIds.length, 5);
      assert.equal(r.focus, focus);
      assert.deepEqual(r.weights, pack.weights);
      assert.deepEqual(r.floors, pack.floors);
      if (focus !== "GENERAL") assert.equal(r.version, FOCUS_PACK_VERSION);
      for (let i = 0; i < 5; i++) {
        const card = edition(r.editionIds[i]),
          rarity = packRarity(pack, i, r.rolls[i]),
          pool = focusedPool(catalog, rarity, focus);
        assert.equal(card.rarity, rarity);
        assert.ok(pool.cards.some((c) => c.id === card.id));
        assert.equal(r.fallbackSlots.includes(i), pool.fallback);
        if (!pool.fallback && focus !== "GENERAL")
          assert.equal(card.position, focus);
      }
    }
  for (const focus of packFocuses)
    for (const rarity of rarities) {
      const pool = focusedPool(catalog, rarity, focus);
      assert.ok(pool.cards.length);
      assert.ok(pool.cards.every((c) => c.rarity === rarity));
    }
  const goalies = focusedPool(catalog, "Fenômeno", "GOL");
  assert.equal(goalies.fallback, true);
  assert.ok(goalies.cards.every((c) => c.rarity === "Fenômeno"));
  assert.throws(() => openPack(s, "basic", 1000, true, "GOL"), /boas-vindas/);
});

test("archetypes describe current role attributes deterministically without changing cards or adding modifiers", () => {
  for (const card of catalog) {
    const before = structuredClone(card),
      profile = playerArchetype(card);
    assert.ok(profile.label.length);
    assert.equal(profile.strengths.length, 2);
    assert.ok(profile.development);
    assert.deepEqual(playerArchetype(card), profile);
    assert.deepEqual(card, before);
  }
  const base = catalog.find((c) => c.position === "GOL")!;
  const goalie = {
    ...base,
    role: "GOL" as const,
    attributes: {
      ...base.attributes!,
      reflexes: 99,
      handling: 40,
      positioning: 40,
      diving: 40,
      kicking: 40,
    },
  };
  assert.equal(playerArchetype(goalie).label, "Goleiro de reflexos");
  const midfielder = {
    ...goalie,
    position: "MEI" as const,
    role: "MEI" as const,
    attributes: {
      ...goalie.attributes,
      passing: 99,
      dribbling: 40,
      physical: 40,
      pace: 40,
      finishing: 40,
    },
  };
  assert.equal(playerArchetype(midfielder).label, "Meia armador");
});

test("advisor only prepares eligible improving swaps while paused, respects re-entry/listing/limit and never mutates the club", () => {
  const s = setup(),
    f = s.runtime.brasfoot!,
    identities = new Set(
      f.cards.map((c) => playerIdentity(edition(c.editionId))),
    ),
    strong = catalog.find(
      (c) =>
        c.position === "DEF" &&
        c.rarity === "Lendário" &&
        !identities.has(playerIdentity(c)),
    )!,
    id = randomUUID();
  f.cards.push({
    id,
    editionId: strong.id,
    locked: true,
    storage: "COLLECTION",
    acquiredAt: 1000,
  });
  f.bench = [id];
  startFootballMatch(s, 1000);
  assert.deepEqual(substitutionAdvice(footballView(s, 76000)!, 75), []);
  pauseRound(s, f.match!.id, 76000);
  const view = footballView(s, 76000)!,
    before = structuredClone(view),
    advice = substitutionAdvice(view, 75);
  assert.ok(advice.length);
  assert.equal(advice[0].inId, id);
  assert.ok(advice.every((a) => a.gain > 0 && a.sector === "DEF"));
  assert.deepEqual(view, before);
  const outgoing = (view.match!.homeAI ? view.match!.away : view.match!.home)[
    (view.match!.homeAI
      ? view.match!.awayOwnedIds!
      : view.match!.homeOwnedIds!
    ).indexOf(advice[0].outId)
  ];
  assert.equal(
    advice[0].before,
    outgoing.rating * conditionMultiplier(advice[0].energy),
  );
  view.listed = [id];
  assert.deepEqual(substitutionAdvice(view, 75), []);
  view.listed = [];
  view.match!.substitutions = Array.from({ length: 5 }, () => ({
    minute: 1,
    outId: randomUUID(),
    inId: randomUUID(),
    side: "HOME" as const,
  }));
  assert.deepEqual(substitutionAdvice(view, 75), []);
  substituteFootball(s, f.match!.id, advice[0].outId, id, 76000);
  assert.deepEqual(substitutionAdvice(footballView(s, 76000)!, 75), []);
});

test("focused pack API validates server-side, audits focus and fallback, preserves idempotency and atomically rolls back failed receipts", async () => {
  const db = await openDatabase({ memory: true }),
    built = await buildApp(db, { clock: () => 1000 }),
    base = {
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
          payload: { name: "Foco API" },
        })
      ).statusCode,
      201,
    );
    await call({ action: "INIT" });
    const before = await view();
    assert.equal(
      (await call({ action: "PACK", packId: "basic", focus: "BOGUS" }))
        .statusCode,
      400,
    );
    assert.equal(
      (await call({ action: "WELCOME", focus: "DEF" })).statusCode,
      400,
    );
    assert.equal((await view()).wallet.balance, before.wallet.balance);
    const key = randomUUID(),
      first = await call(
        { action: "PACK", packId: "basic", focus: "DEF" },
        key,
      );
    assert.equal(first.statusCode, 200, first.body);
    const receipt = first.json().data.receipt;
    assert.equal(receipt.focus, "DEF");
    assert.equal(receipt.version, FOCUS_PACK_VERSION);
    assert.ok(
      receipt.editionIds.every((id: string) => edition(id).position === "DEF"),
    );
    assert.deepEqual(
      (
        await call({ action: "PACK", packId: "basic", focus: "DEF" }, key)
      ).json().data,
      first.json().data,
    );
    assert.equal(
      (await call({ action: "PACK", packId: "basic", focus: "ATA" }, key))
        .statusCode,
      409,
    );
    let saved = await view();
    assert.equal(saved.wallet.balance, "5000");
    assert.equal(saved.brasfoot.receipts.length, 1);
    const audit = (
      await db.query<{ payload: { response: { receipt: { focus: string } } } }>(
        "SELECT payload FROM football_audit WHERE action='PACK'",
      )
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].payload.response.receipt.focus, "DEF");
    await db.query(
      "CREATE FUNCTION qa_focus_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA focus rollback'; END; $$",
    );
    await db.query(
      "CREATE TRIGGER qa_focus_trigger BEFORE INSERT ON football_audit FOR EACH ROW EXECUTE FUNCTION qa_focus_fail()",
    );
    const failed = await call({
      action: "PACK",
      packId: "basic",
      focus: "GOL",
    });
    assert.equal(failed.statusCode, 500);
    const after = await view();
    assert.equal(after.wallet.balance, saved.wallet.balance);
    assert.deepEqual(after.brasfoot.cards, saved.brasfoot.cards);
    assert.deepEqual(after.brasfoot.receipts, saved.brasfoot.receipts);
  } finally {
    await built.app.close();
    await db.close();
  }
});
