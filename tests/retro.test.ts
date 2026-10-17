import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createClub,
  acquirePresence,
  advance,
  startMatch,
  setLineup,
} from "../packages/game/engine.js";
import { coins, gameplay, trainTick } from "../packages/game/gameplay.js";
import { makeAthlete, simulate } from "../packages/game/simulation.js";
import {
  npcPrice,
  naturalOvr,
  matchesFilter,
} from "../packages/contracts/roster.js";
import { defaultScouting, organizeDrop } from "../packages/game/scouting.js";
import { addAthleteXp } from "../packages/game/rules.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

test("birth NPC price is stable after unlimited leveling, storage and protection changes", () => {
  const a = makeAthlete("fixed-sale", 6, "P3"),
    price = npcPrice(a);
  addAthleteXp(a, 10n ** 40n);
  a.storage = "DEPOT";
  a.protected = true;
  assert.equal(npcPrice(a), price);
  assert.equal(a.ovr, naturalOvr(a));
});

test("scout priorities use birth caps, ALL/ANY logic and mandatory P5 safety without selling", () => {
  const a = makeAthlete("scout-rules", 6, "P3"),
    cfg = defaultScouting();
  cfg.rules = [
    {
      id: "first",
      name: "Defesa desejada",
      enabled: true,
      mode: "ALL",
      conditions: [
        { field: "defending", op: "GTE", value: String(a.caps.defending) },
        { field: "rarity", op: "EQ", value: "P3" },
      ],
      destination: "COLLECTION",
      protect: true,
    },
    {
      id: "later",
      name: "Outros",
      enabled: true,
      mode: "ANY",
      conditions: [{ field: "rarity", op: "EQ", value: "P3" }],
      destination: "DEPOT",
      protect: false,
    },
  ];
  assert.equal(organizeDrop(a, cfg), "Regra: Defesa desejada");
  assert.equal(a.storage, "COLLECTION");
  assert.equal(a.protected, true);
  addAthleteXp(a, 1000000n);
  assert.equal(organizeDrop(a, cfg), "Regra: Defesa desejada");
  cfg.rules[0].enabled = false;
  assert.equal(organizeDrop(a, cfg), "Regra: Outros");
  assert.equal(a.storage, "DEPOT");
  const p5 = makeAthlete("safe-p5", 7, "P5");
  cfg.enabled = false;
  cfg.fallback = "DEPOT";
  organizeDrop(p5, cfg);
  assert.equal(p5.storage, "COLLECTION");
  assert.equal(p5.protected, true);
});

test("automatic scouting never changes farm RNG, drop count, match results or Coins", () => {
  const one = createClub(randomUUID(), "A", "same-farm-seed", 0),
    two = structuredClone(one);
  gameplay(one).scouting = {
    enabled: true,
    fallback: "DEPOT",
    rules: [],
    rareWarningPotential: 85,
  };
  gameplay(two).scouting = {
    enabled: false,
    fallback: "COLLECTION",
    rules: [],
    rareWarningPotential: 85,
  };
  for (const s of [one, two]) {
    acquirePresence(s, "qa", 0);
    s.runtime.presence.intervals[0].end = 10000000;
    s.runtime.farm.running = true;
  }
  const a = advance(one, 9000000, 101),
    b = advance(two, 9000000, 101);
  assert.equal(a.settlements.length, 100);
  assert.equal(one.runtime.balance, two.runtime.balance);
  assert.equal(one.athletes.length, two.athletes.length);
  assert.deepEqual(
    a.settlements.map((s) => s.match.result),
    b.settlements.map((s) => s.match.result),
  );
  assert.deepEqual(
    one.athletes.map((a) => a.id),
    two.athletes.map((a) => a.id),
  );
  assert.ok(
    one.athletes.some(
      (a) => a.origin === "ONLINE_DROP" && a.storage === "DEPOT",
    ),
  );
});

test("E2 authoritative staging preserves sporting outcomes and emits ordered bounded movement events", () => {
  const s = createClub(randomUUID(), "Stage", "stage-seed", 0);
  startMatch(s, 0);
  const m = s.current!,
    old = simulate({ ...m.view, rulesVersion: "ALPHA-E1" }, m.seed),
    next = simulate(m.view, m.seed);
  assert.deepEqual(next.result, old.result);
  assert.ok(next.events.some((e) => !!e.payload.stage));
  for (let i = 0; i < next.events.length; i++) {
    const e = next.events[i];
    assert.ok(e.offsetMs >= 0 && e.offsetMs <= 90000);
    if (i) assert.ok(e.offsetMs >= next.events[i - 1].offsetMs);
    if (e.payload.stage) {
      for (const p of [e.payload.stage.from, e.payload.stage.to])
        assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);
    }
  }
});

test("CT pause and natural cap stop maintenance and never create retrospective debt", () => {
  const s = createClub(randomUUID(), "CT", "ct-e2", 0),
    a = makeAthlete("ct-e2", 6, "P2");
  s.athletes.push(a);
  coins(s, 1000n, "QA", 0);
  acquirePresence(s, "qa", 0);
  s.runtime.presence.intervals[0].end = 10000000;
  gameplay(s).training = [
    { athleteId: a.id, lastAt: 0, paidSteps: 0, paused: true },
  ];
  trainTick(s, 600000);
  assert.equal(s.runtime.balance, "1000");
  assert.equal(a.xpTotal, "0");
  gameplay(s).training[0].paused = false;
  gameplay(s).training[0].lastAt = 600000;
  trainTick(s, 660000);
  assert.equal(s.runtime.balance, "998");
  assert.equal(a.xpTotal, "12");
  addAthleteXp(a, 1000000n);
  const xp = a.xpTotal;
  trainTick(s, 9990000);
  assert.equal(s.runtime.balance, "998");
  assert.equal(a.xpTotal, xp);
  assert.equal(gameplay(s).training[0].status, "CAPPED");
});

async function harness() {
  const db = await openDatabase({ memory: true });
  let now = 1000000;
  const { app, repo } = await buildApp(db, { clock: () => now });
  const base = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  async function player(name: string) {
    const guest = await app.inject({
        method: "POST",
        url: "/v1/auth/guest",
        headers: base,
        payload: {},
      }),
      cookie = guest.cookies[0].name + "=" + guest.cookies[0].value,
      clientInstanceId = randomUUID();
    const c = await app.inject({
      method: "POST",
      url: "/v1/clubs",
      headers: { ...base, cookie, "idempotency-key": randomUUID() },
      payload: { name },
    });
    assert.equal(c.statusCode, 201, c.body);
    const account = (
      await app.inject({ url: "/v1/bootstrap", headers: { cookie } })
    ).json().data.account.id as string;
    const p = {
      account,
      cookie,
      clientInstanceId,
      gen: 0,
      clubId: c.json().data.clubId,
    };
    await acquire(p);
    return p;
  }
  type Player = {
    account: string;
    cookie: string;
    clientInstanceId: string;
    gen: number;
    clubId: string;
  };
  async function acquire(p: Player) {
    const r = await app.inject({
      method: "POST",
      url: "/v1/presence/acquire",
      headers: { ...base, cookie: p.cookie, "idempotency-key": randomUUID() },
      payload: { clientInstanceId: p.clientInstanceId },
    });
    assert.equal(r.statusCode, 200, r.body);
    p.gen = r.json().data.generation;
  }
  async function post(
    p: Player,
    url: string,
    body: Record<string, unknown>,
    key = randomUUID(),
  ) {
    return app.inject({
      method: "POST",
      url: "/v1" + url,
      headers: {
        ...base,
        cookie: p.cookie,
        "idempotency-key": key,
        "x-presence-generation": String(p.gen),
      },
      payload: { ...body, clientInstanceId: p.clientInstanceId },
    });
  }
  async function view(p: Player, lite = false) {
    const r = await app.inject({
      url: "/v1/club" + (lite ? "?omitRoster=1" : ""),
      headers: { cookie: p.cookie },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().data;
  }
  return {
    db,
    app,
    repo,
    player,
    post,
    view,
    acquire,
    advance: (ms: number) => {
      now += ms;
    },
    clock: () => now,
    close: async () => {
      await app.close();
      await db.close();
    },
  };
}

test("bulk sale of 2,000 athletes: protection, activity, quote race, rollback, rare acknowledgement and retry", async () => {
  const h = await harness();
  try {
    const p = await h.player("Bulk QA");
    const extras = Array.from({ length: 2000 }, (_, i) => {
      const a = makeAthlete(
        "bulk-e2",
        i + 6,
        i % 97 === 0 ? "P5" : i % 101 === 0 ? "P4" : "P1",
      );
      if (i % 11 === 0) a.protected = true;
      return a;
    });
    await h.repo.mutate(p.account, "qa.2000", randomUUID(), {}, (s) => {
      s.athletes.push(...extras);
      coins(s, 1000n, "QA", h.clock());
      gameplay(s).training = [
        { athleteId: extras[1].id, lastAt: h.clock(), paidSteps: 0 },
      ];
      const original = [...s.runtime.lineup];
      s.runtime.lineup = [...original.slice(0, 4), extras[3].id];
      startMatch(s, h.clock());
      setLineup(s, original, s.runtime.lineupVersion);
      extras[2].tradeEligible = true;
      s.athletes.find((a) => a.id === extras[2].id)!.tradeEligible = true;
      return {};
    });
    let r = await h.post(p, "/market/command", {
      action: "LIST",
      athleteId: extras[2].id,
      price: "500",
      days: 7,
    });
    assert.equal(r.statusCode, 200, r.body);
    const before = await h.view(p),
      ids = before.athletes.map((a: { id: string }) => a.id);
    r = await h.post(p, "/roster/sell/preview", { ids });
    assert.equal(r.statusCode, 200, r.body);
    const q = r.json().data;
    assert.ok(q.athletes.length > 1700);
    assert.ok(q.excluded.length > 180);
    assert.ok(q.warnings > 0);
    assert.equal(
      q.athletes.some((a: { id: string }) =>
        [extras[1].id, extras[2].id, extras[3].id].includes(a.id),
      ),
      false,
    );
    const changed = q.athletes[0].id;
    r = await h.post(p, "/roster/action", {
      action: "PROTECT",
      athleteId: changed,
    });
    assert.equal(r.statusCode, 200, r.body);
    r = await h.post(p, "/roster/sell/commit", {
      quoteId: q.id,
      confirmed: true,
      acknowledgeRare: true,
    });
    assert.equal(r.statusCode, 409);
    assert.equal((await h.view(p)).wallet.balance, "1000");
    assert.equal((await h.view(p)).athletes.length, 2005);
    r = await h.post(p, "/roster/action", {
      action: "UNPROTECT",
      athleteId: changed,
    });
    assert.equal(r.statusCode, 422);
    r = await h.post(p, "/roster/action", {
      action: "UNPROTECT",
      athleteId: changed,
      confirmed: true,
    });
    assert.equal(r.statusCode, 200);
    r = await h.post(p, "/roster/sell/preview", { filter: { role: "BENCH" } });
    assert.equal(r.statusCode, 200, r.body);
    const fresh = r.json().data;
    r = await h.post(p, "/roster/sell/commit", {
      quoteId: fresh.id,
      confirmed: true,
    });
    assert.equal(r.statusCode, 422);
    const key = randomUUID(),
      body = { quoteId: fresh.id, confirmed: true, acknowledgeRare: true };
    r = await h.post(p, "/roster/sell/commit", body, key);
    assert.equal(r.statusCode, 200, r.body);
    const result = r.json().data;
    assert.equal(result.count, fresh.athletes.length);
    r = await h.post(p, "/roster/sell/commit", body, key);
    assert.equal(r.statusCode, 200);
    const after = await h.view(p);
    assert.equal(after.wallet.balance, String(1000n + BigInt(fresh.total)));
    assert.equal(after.athletes.length, 2005 - result.count);
    const archived = (
      await h.db.query<{ n: string }>(
        "SELECT count(*)::text n FROM athletes WHERE club_id=$1 AND NOT active",
        [p.clubId],
      )
    ).rows[0].n;
    assert.equal(Number(archived), result.count);
    const ledger = (
      await h.db.query<{ n: string }>(
        "SELECT count(*)::text n FROM coin_ledger_entries WHERE club_id=$1 AND reason='NPC_BULK_SALE'",
        [p.clubId],
      )
    ).rows[0].n;
    assert.equal(ledger, "1");
    const lite = await h.view(p, true);
    assert.equal(lite.athletes.length, 0);
    assert.equal(lite.rosterOmitted, true);
    assert.equal(lite.rosterRevision, after.rosterRevision);
    assert.notEqual(after.rosterRevision, before.rosterRevision);
    const unknown = await h.post(p, "/roster/sell/preview", {
      ids: [randomUUID()],
    });
    assert.equal(unknown.statusCode, 404);
    const cfg = defaultScouting();
    cfg.rules.reverse();
    r = await h.post(p, "/scouting/config", { config: cfg });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual((await h.view(p)).gameplay.scouting, cfg);
    const recovered = await buildApp(h.db, { clock: h.clock });
    try {
      const boot = (
        await recovered.app.inject({
          url: "/v1/bootstrap",
          headers: { cookie: p.cookie },
        })
      ).json().data;
      assert.deepEqual(boot.game.gameplay.scouting, cfg);
      assert.equal(boot.game.athletes.length, after.athletes.length);
    } finally {
      await recovered.app.close();
    }
  } finally {
    await h.close();
  }
});

test("P2P holds prevent double spending and release on withdrawal, expiry and acceptance", async () => {
  const h = await harness();
  try {
    const seller = await h.player("Seller E2"),
      buyer = await h.player("Buyer E2"),
      a = makeAthlete("hold-a", 6, "P2"),
      b = makeAthlete("hold-b", 7, "P2");
    a.tradeEligible = b.tradeEligible = true;
    await h.repo.mutate(seller.account, "qa.assets", randomUUID(), {}, (s) => {
      s.athletes.push(a, b);
      return {};
    });
    await h.repo.mutate(buyer.account, "qa.money", randomUUID(), {}, (s) => {
      coins(s, 200n, "QA", h.clock());
      return {};
    });
    let r = await h.post(seller, "/market/command", {
      action: "LIST",
      athleteId: a.id,
      price: "100",
      days: 7,
    });
    assert.equal(r.statusCode, 200, r.body);
    r = await h.post(seller, "/market/command", {
      action: "LIST",
      athleteId: b.id,
      price: "100",
      days: 7,
    });
    assert.equal(r.statusCode, 200, r.body);
    const list = (await h.view(buyer)).market,
      l = list.find((l: { athlete: { id: string } }) => l.athlete.id === a.id),
      other = list.find((x: { id: string }) => x.id !== l.id);
    r = await h.post(buyer, "/market/command", {
      action: "OFFER",
      listingId: l.id,
      amount: "150",
    });
    assert.equal(r.statusCode, 200, r.body);
    let v = await h.view(buyer);
    assert.equal(v.wallet.reserved, "150");
    assert.equal(v.wallet.available, "50");
    r = await h.post(buyer, "/club/command", { action: "TRAIN_EXPAND" });
    assert.equal(r.statusCode, 422);
    r = await h.post(buyer, "/market/command", {
      action: "BUY",
      listingId: other.id,
    });
    assert.equal(r.statusCode, 422);
    assert.equal((await h.view(buyer)).wallet.balance, "200");
    let offer = (await h.view(buyer)).market.find(
      (x: { id: string }) => x.id === l.id,
    ).offers[0];
    r = await h.post(buyer, "/market/command", {
      action: "WITHDRAW",
      listingId: l.id,
      offerId: offer.id,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await h.view(buyer)).wallet.available, "200");
    r = await h.post(buyer, "/market/command", {
      action: "OFFER",
      listingId: l.id,
      amount: "80",
    });
    assert.equal(r.statusCode, 200, r.body);
    offer = (await h.view(buyer)).market
      .find((x: { id: string }) => x.id === l.id)
      .offers.at(-1);
    r = await h.post(seller, "/market/command", {
      action: "ACCEPT",
      listingId: l.id,
      offerId: offer.id,
    });
    assert.equal(r.statusCode, 200, r.body);
    v = await h.view(buyer);
    assert.equal(v.wallet.balance, "120");
    assert.equal(v.wallet.available, "120");
    assert.equal(v.wallet.reserved, "0");
    r = await h.post(buyer, "/market/command", {
      action: "OFFER",
      listingId: other.id,
      amount: "100",
    });
    assert.equal(r.statusCode, 200, r.body);
    h.advance(86400000);
    v = await h.view(buyer);
    assert.equal(v.wallet.reserved, "0");
    assert.equal(v.wallet.available, "120");
  } finally {
    await h.close();
  }
});

test("original asset catalog contains 15 distinct optimized SVG environments, regions and the existing item", async () => {
  const c = JSON.parse(
    await readFile("apps/web/public/assets/e2/catalog.json", "utf8"),
  );
  assert.equal(c.assets.length, 15);
  const hashes = new Set();
  for (const a of c.assets) {
    const file = await readFile("apps/web/public" + a.path, "utf8");
    assert.ok(file.includes('shape-rendering="crispEdges"'));
    assert.ok(a.width > 0 && a.height > 0);
    assert.ok(
      !file.includes("http://") || file.includes("http://www.w3.org/2000/svg"),
    );
    hashes.add(createHash("sha256").update(file).digest("hex"));
  }
  assert.equal(hashes.size, 15);
});
