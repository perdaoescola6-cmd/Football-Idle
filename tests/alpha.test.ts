import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  coverage,
  createClub,
  acquirePresence,
  advance,
  setFarm,
  setLineup,
} from "../packages/game/engine.js";
import {
  command,
  coins,
  gameplay,
  trainTick,
} from "../packages/game/gameplay.js";
import {
  liveMatch,
  makeAthlete,
  simulate,
} from "../packages/game/simulation.js";
import { regions } from "../packages/contracts/world.js";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

test("live stream reveals only elapsed events and matches the final replay exactly", () => {
  const s = createClub(randomUUID(), "Live QA", "live-seed", 0);
  acquirePresence(s, "qa", 0);
  setFarm(s, true, "VARZEA", 0);
  const m = s.current!,
    final = simulate(m.view, m.seed);
  for (const now of [0, 5000, 7000, 42000, 89999, 90000]) {
    const live = liveMatch(m.view, m.seed, now);
    assert.deepEqual(
      live.events,
      final.events.filter((e) => e.offsetMs <= now),
    );
    assert.equal(live.result, null);
    assert.equal(live.reward, null);
    assert.equal(JSON.stringify(live).includes(m.seed), false);
  }
  assert.deepEqual(liveMatch(m.view, m.seed, 90000).liveScore, {
    homeGoals: final.result.homeGoals,
    awayGoals: final.result.awayGoals,
  });
  const shots = final.events.filter((e) => e.type === "SHOT_RESOLVED");
  assert.ok(
    shots.every(
      (e) =>
        e.payload.actorId !== m.view.home[0].id &&
        e.payload.actorId !== m.view.away[0].id,
    ),
  );
});

test("all seven regions unlock from permanent club progress only", () => {
  const s = createClub(randomUUID(), "Mapa QA", "map", 0);
  acquirePresence(s, "qa", 0);
  for (const r of regions.slice(1)) {
    s.runtime.clubXp = String((r.level - 2) * 100);
    assert.throws(() => setFarm(s, true, r.id, 0), /exige nível/);
    s.runtime.clubXp = String((r.level - 1) * 100);
    setFarm(s, true, r.id, 0);
    assert.equal(s.runtime.farm.region, r.id);
    s.current = null;
    s.runtime.farm.running = false;
  }
});

test("reserve training charges only active paid cycles, pauses without debt and protects lineup", () => {
  const s = createClub(randomUUID(), "Treino QA", "ct", 0),
    a = makeAthlete("reserve", 6, "P2");
  s.athletes.push(a);
  coins(s, 200n, "QA", 0);
  acquirePresence(s, "qa", 0);
  s.runtime.presence.intervals[0].end = 2000000;
  command(s, { action: "TRAIN_START", athleteId: a.id }, 0);
  assert.throws(
    () => command(s, { action: "NPC_SELL", athleteId: a.id }, 0),
    /reserva/,
  );
  assert.throws(
    () => setLineup(s, [...s.runtime.lineup.slice(0, 4), a.id], 1),
    /treino/,
  );
  trainTick(s, 60000);
  assert.equal(a.xpTotal, "12");
  assert.equal(s.runtime.balance, "198");
  command(s, { action: "TRAIN_STOP", athleteId: a.id }, 60000);
  trainTick(s, 600000);
  assert.equal(s.runtime.balance, "198");
  coins(s, -197n, "QA", 600000);
  command(s, { action: "TRAIN_START", athleteId: a.id }, 600000);
  trainTick(s, 1200000);
  assert.equal(a.xpTotal, "12");
  assert.equal(s.runtime.balance, "1");
  coins(s, 10n, "QA", 1200000);
  trainTick(s, 1200000);
  assert.equal(a.xpTotal, "12");
  trainTick(s, 1260000);
  assert.equal(a.xpTotal, "24");
});

test("scouting requires online claim, never charges duplicate active searches, NPC protects starters", () => {
  const s = createClub(randomUUID(), "Olheiro QA", "scout", 0);
  coins(s, 100n, "QA", 0);
  acquirePresence(s, "qa", 0);
  assert.throws(() => command(s, { action: "SCOUT_START" }, 0), /desativadas/);
  assert.equal(s.runtime.balance, "100");
  coins(s, -60n, "LEGACY_SCOUT_SEARCH", 0);
  const pending = makeAthlete("legacy-paid", 6, "P2");
  pending.origin = "SCOUT";
  gameplay(s).scout = { id: randomUUID(), readyAt: 30000, athlete: pending };
  assert.throws(() => command(s, { action: "SCOUT_START" }, 0), /desativadas/);
  assert.equal(s.runtime.balance, "40");
  assert.throws(() => command(s, { action: "SCOUT_CLAIM" }, 29999), /buscando/);
  assert.throws(() => command(s, { action: "SCOUT_CLAIM" }, 30000), /online/);
  acquirePresence(s, "qa", 30000);
  command(s, { action: "SCOUT_CLAIM" }, 30000);
  assert.equal(s.athletes.length, 6);
  assert.throws(() => command(s, { action: "SCOUT_CLAIM" }, 30000));
  assert.throws(
    () =>
      command(s, { action: "NPC_SELL", athleteId: s.runtime.lineup[0] }, 30000),
    /reserva/,
  );
  command(s, { action: "NPC_SELL", athleteId: s.athletes[5].id }, 30000);
  assert.equal(s.athletes.length, 5);
});

test("asynchronous season enforces 14 days, 20 games and no parallel farm", () => {
  const s = createClub(randomUUID(), "Liga QA", "league", 0);
  acquirePresence(s, "qa", 0);
  command(s, { action: "LEAGUE_JOIN" }, 0);
  assert.equal(gameplay(s).league!.endsAt, 14 * 86400000);
  command(s, { action: "LEAGUE_PLAY" }, 0);
  assert.ok(s.current?.view.leagueSeasonId);
  assert.throws(() => setFarm(s, true, "VARZEA", 0), /liga/);
  advance(s, 90000);
  assert.equal(gameplay(s).league!.games, 1);
  assert.equal(gameplay(s).league!.records.length, 1);
  assert.equal(s.runtime.farm.running, false);
  gameplay(s).league!.games = 20;
  assert.throws(() => command(s, { action: "LEAGUE_PLAY" }, 90000), /vinte/);
  assert.throws(
    () => command(s, { action: "LEAGUE_PLAY" }, 14 * 86400000),
    /temporada/,
  );
});

test("API commerce: signed immutable ledger, atomic P2P transfer, idempotency, offers and NPC ownership", async () => {
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
      cookie = guest.cookies[0].name + "=" + guest.cookies[0].value;
    const headers = { ...base, cookie, "idempotency-key": randomUUID() };
    const create = await app.inject({
      method: "POST",
      url: "/v1/clubs",
      headers,
      payload: { name },
    });
    assert.equal(create.statusCode, 201, create.body);
    const account = (
      await app.inject({ url: "/v1/bootstrap", headers: { cookie } })
    ).json().data.account.id as string;
    const clientInstanceId = randomUUID(),
      presence = await app.inject({
        method: "POST",
        url: "/v1/presence/acquire",
        headers: { ...headers, "idempotency-key": randomUUID() },
        payload: { clientInstanceId },
      });
    return {
      account,
      cookie,
      clientInstanceId,
      gen: presence.json().data.generation,
      clubId: create.json().data.clubId,
    };
  }
  type Player = Awaited<ReturnType<typeof player>>;
  async function post(
    p: Player,
    path: string,
    body: Record<string, unknown>,
    idem = randomUUID(),
  ) {
    return app.inject({
      method: "POST",
      url: path,
      headers: {
        ...base,
        cookie: p.cookie,
        "idempotency-key": idem,
        "x-presence-generation": String(p.gen),
      },
      payload: { ...body, clientInstanceId: p.clientInstanceId },
    });
  }
  async function view(p: Player) {
    return (
      await app.inject({ url: "/v1/club", headers: { cookie: p.cookie } })
    ).json().data;
  }
  try {
    const seller = await player("Vendedor QA"),
      buyer = await player("Comprador QA");
    const trade = makeAthlete("transfer-qa", 6, "P2");
    trade.tradeEligible = true;
    await repo.mutate(seller.account, "qa.fixture", randomUUID(), {}, (s) => {
      s.athletes.push(trade);
      coins(s, 100n, "QA_FIXTURE", now);
      return {};
    });
    await repo.mutate(buyer.account, "qa.fixture", randomUUID(), {}, (s) => {
      coins(s, 1000n, "QA_FIXTURE", now);
      return {};
    });
    let res = await post(seller, "/v1/market/command", {
      action: "LIST",
      athleteId: trade.id,
      price: "101",
      days: 7,
    });
    assert.equal(res.statusCode, 200, res.body);
    let listing = (await view(seller)).market[0];
    res = await post(seller, "/v1/club/command", {
      action: "NPC_SELL",
      athleteId: trade.id,
    });
    assert.equal(res.statusCode, 422);
    res = await post(buyer, "/v1/market/command", {
      action: "CANCEL",
      listingId: listing.id,
    });
    assert.equal(res.statusCode, 403);
    const idem = randomUUID(),
      buy = { action: "BUY", listingId: listing.id };
    await db.query(
      "CREATE FUNCTION qa_fail_transfer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA failure'; END; $$",
    );
    await db.query(
      "CREATE TRIGGER qa_transfer_failure BEFORE INSERT ON market_transfers FOR EACH ROW EXECUTE FUNCTION qa_fail_transfer()",
    );
    res = await post(buyer, "/v1/market/command", buy, idem);
    assert.equal(res.statusCode, 500);
    assert.equal((await view(buyer)).wallet.balance, "1000");
    assert.equal((await view(seller)).wallet.balance, "100");
    assert.equal((await view(seller)).market[0].status, "OPEN");
    await db.query("DROP TRIGGER qa_transfer_failure ON market_transfers");
    const purchases = await Promise.all([
      post(buyer, "/v1/market/command", buy, idem),
      post(buyer, "/v1/market/command", buy, idem),
    ]);
    assert.ok(
      purchases.every((r) => r.statusCode === 200),
      purchases.map((r) => r.body).join(),
    );
    let sv = await view(seller),
      bv = await view(buyer);
    assert.equal(sv.wallet.balance, "185");
    assert.equal(bv.wallet.balance, "899");
    assert.equal(
      sv.athletes.some((a: { id: string }) => a.id === trade.id),
      false,
    );
    assert.equal(
      bv.athletes.filter((a: { id: string }) => a.id === trade.id).length,
      1,
    );
    const receipt = (
      await db.query<{ commission: string; total: string }>(
        "SELECT commission::text,total::text FROM market_transfers WHERE listing_id=$1",
        [listing.id],
      )
    ).rows[0];
    assert.equal(receipt.commission, "16");
    assert.equal(receipt.total, "101");
    res = await post(seller, "/v1/club/command", {
      action: "NPC_SELL",
      athleteId: trade.id,
    });
    assert.equal(res.statusCode, 404);
    res = await post(buyer, "/v1/market/command", {
      action: "LIST",
      athleteId: trade.id,
      price: "200",
      days: 1,
    });
    assert.equal(res.statusCode, 200, res.body);
    listing = (await view(buyer)).market[0];
    res = await post(seller, "/v1/market/command", {
      action: "OFFER",
      listingId: listing.id,
      amount: "80",
    });
    assert.equal(res.statusCode, 200, res.body);
    listing = (await view(buyer)).market[0];
    const offerId = listing.offers[0].id;
    res = await post(seller, "/v1/market/command", {
      action: "ACCEPT",
      listingId: listing.id,
      offerId,
    });
    assert.equal(res.statusCode, 403);
    res = await post(buyer, "/v1/market/command", {
      action: "ACCEPT",
      listingId: listing.id,
      offerId,
    });
    assert.equal(res.statusCode, 200, res.body);
    sv = await view(seller);
    bv = await view(buyer);
    assert.equal(sv.wallet.balance, "105");
    assert.equal(bv.wallet.balance, "967");
    res = await post(seller, "/v1/club/command", { action: "SCOUT_START" });
    assert.equal(res.statusCode, 422, res.body);
    await repo.mutate(
      seller.account,
      "qa.legacy-search",
      randomUUID(),
      {},
      (s) => {
        coins(s, -60n, "LEGACY_SCOUT_SEARCH", now);
        const a = makeAthlete("legacy-api", 77, "P2");
        a.origin = "SCOUT";
        gameplay(s).scout = {
          id: randomUUID(),
          readyAt: now + 30000,
          athlete: a,
        };
        return {};
      },
    );
    const scoutId = (await view(seller)).gameplay.scout.id;
    assert.equal((await view(seller)).gameplay.scout.athlete, undefined);
    now += 30000;
    const pres = await app.inject({
      method: "POST",
      url: "/v1/presence/acquire",
      headers: {
        ...base,
        cookie: seller.cookie,
        "idempotency-key": randomUUID(),
      },
      payload: { clientInstanceId: seller.clientInstanceId },
    });
    seller.gen = pres.json().data.generation;
    const claimKey = randomUUID();
    res = await post(
      seller,
      "/v1/club/command",
      { action: "SCOUT_CLAIM" },
      claimKey,
    );
    assert.equal(res.statusCode, 200, res.body);
    res = await post(
      seller,
      "/v1/club/command",
      { action: "SCOUT_CLAIM" },
      claimKey,
    );
    assert.equal(res.statusCode, 200);
    sv = await view(seller);
    assert.equal(sv.gameplay.scout, null);
    assert.ok(scoutId);
    assert.equal(sv.athletes.length, 7);
    const recruited = sv.athletes.find(
      (a: { origin: string }) => a.origin === "SCOUT",
    );
    res = await post(seller, "/v1/club/command", {
      action: "TRAIN_START",
      athleteId: recruited.id,
    });
    assert.equal(res.statusCode, 200, res.body);
    const beforeTraining = (await view(seller)).wallet.balance;
    now += 120000;
    await repo.tick();
    sv = await view(seller);
    assert.equal(sv.wallet.balance, String(BigInt(beforeTraining) - 2n));
    assert.equal(
      sv.athletes.find((a: { id: string }) => a.id === recruited.id).xpTotal,
      "6",
    );
    const control = await app.inject({
      method: "POST",
      url: "/v1/presence/acquire",
      headers: {
        ...base,
        cookie: seller.cookie,
        "idempotency-key": randomUUID(),
      },
      payload: { clientInstanceId: seller.clientInstanceId },
    });
    seller.gen = control.json().data.generation;
    res = await post(seller, "/v1/club/command", {
      action: "NPC_SELL",
      athleteId: recruited.id,
    });
    assert.equal(res.statusCode, 422);
    res = await post(seller, "/v1/club/command", {
      action: "TRAIN_STOP",
      athleteId: recruited.id,
    });
    assert.equal(res.statusCode, 200, res.body);
    const sellKey = randomUUID();
    res = await post(
      seller,
      "/v1/club/command",
      { action: "NPC_SELL", athleteId: recruited.id },
      sellKey,
    );
    assert.equal(res.statusCode, 200, res.body);
    const afterSale = (await view(seller)).wallet.balance;
    res = await post(
      seller,
      "/v1/club/command",
      { action: "NPC_SELL", athleteId: recruited.id },
      sellKey,
    );
    assert.equal(res.statusCode, 200);
    assert.equal((await view(seller)).wallet.balance, afterSale);
    const archived = (
      await db.query<{ active: boolean }>(
        "SELECT active FROM athletes WHERE id=$1",
        [recruited.id],
      )
    ).rows[0];
    assert.equal(archived.active, false);
    for (const p of [seller, buyer]) {
      const presence = await app.inject({
        method: "POST",
        url: "/v1/presence/acquire",
        headers: { ...base, cookie: p.cookie, "idempotency-key": randomUUID() },
        payload: { clientInstanceId: p.clientInstanceId },
      });
      p.gen = presence.json().data.generation;
      res = await post(p, "/v1/club/command", { action: "LEAGUE_JOIN" });
      assert.equal(res.statusCode, 200, res.body);
    }
    res = await post(seller, "/v1/club/command", { action: "LEAGUE_PLAY" });
    assert.equal(res.statusCode, 200, res.body);
    const leagueMatch = (await view(seller)).currentMatch;
    assert.equal(leagueMatch.awayClubId, buyer.clubId);
    assert.equal(leagueMatch.awayName, "Comprador QA");
    assert.deepEqual(
      leagueMatch.away.map((a: { id: string }) => a.id),
      (await view(buyer)).lineup.athleteIds,
    );
    await assert.rejects(() =>
      db.query("UPDATE market_transfers SET commission=0"),
    );
    for (const p of [seller, buyer]) {
      const audit = (
        await db.query<{ total: string; balance: string }>(
          "SELECT (SELECT sum(delta)::text FROM coin_ledger_entries WHERE club_id=$1) total,balance::text FROM wallets WHERE club_id=$1",
          [p.clubId],
        )
      ).rows[0];
      assert.equal(audit.total, audit.balance);
    }
    await assert.rejects(() => db.query("DELETE FROM coin_ledger_entries"));
  } finally {
    await app.close();
    await db.close();
  }
});

test("CT offline uses half XP, renewal and one shared 24h clock for staggered slots", () => {
  const s = createClub(randomUUID(), "CT offline QA", "ct-offline", 0);
  acquirePresence(s, "qa", 0);
  s.runtime.presence.intervals[0].end = 630000;
  const a = makeAthlete("ct-a", 6, "P2"),
    b = makeAthlete("ct-b", 7, "P2");
  s.athletes.push(a, b);
  coins(s, 10000n, "QA", 0);
  command(s, { action: "TRAIN_START", athleteId: a.id }, 600000);
  command(s, { action: "TRAIN_START", athleteId: b.id }, 630000);
  trainTick(s, 660000);
  assert.equal(a.xpTotal, "9");
  assert.equal(b.xpTotal, "0");
  trainTick(s, 690000);
  assert.equal(b.xpTotal, "6");
  assert.equal(s.runtime.budgets[0].trainingUsedMs, 60000);
  assert.equal(s.runtime.budgets[0].usedMs, 60000);
  coverage(s, 630000, 690000);
  assert.equal(s.runtime.budgets[0].usedMs, 60000);
  trainTick(s, 630000 + 25 * 3600000);
  assert.equal(s.runtime.budgets[0].trainingUsedMs, 86400000);
  const xp = s.athletes.map((a) => a.xpTotal),
    balance = s.runtime.balance;
  trainTick(s, 630000 + 27 * 3600000);
  assert.deepEqual(
    s.athletes.map((a) => a.xpTotal),
    xp,
  );
  assert.equal(s.runtime.balance, balance);
});
