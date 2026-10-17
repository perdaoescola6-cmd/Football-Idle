import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

test("real PostgreSQL API: creation, idempotency, CSRF, isolation, rollback and recovery", async () => {
  const db = await openDatabase({ memory: true });
  let now = 1_000_000;
  const { app, repo } = await buildApp(db, { clock: () => now });
  const base = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  try {
    const guest = await app.inject({
      method: "POST",
      url: "/v1/auth/guest",
      headers: base,
      payload: {},
    });
    assert.equal(guest.statusCode, 200);
    const cookie = guest.cookies[0].name + "=" + guest.cookies[0].value;
    const headers = { ...base, cookie, "idempotency-key": randomUUID() };
    const requests = await Promise.all([
      app.inject({
        method: "POST",
        url: "/v1/clubs",
        headers,
        payload: { name: "União QA" },
      }),
      app.inject({
        method: "POST",
        url: "/v1/clubs",
        headers,
        payload: { name: "União QA" },
      }),
    ]);
    assert.equal(requests[0].statusCode, 201);
    assert.equal(requests[1].statusCode, 201);
    assert.deepEqual(requests[0].json().data, requests[1].json().data);
    assert.equal(
      Number(
        (
          await db.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM athletes",
          )
        ).rows[0].count,
      ),
      5,
    );
    const misuse = await app.inject({
      method: "POST",
      url: "/v1/clubs",
      headers,
      payload: { name: "Outro clube" },
    });
    assert.equal(misuse.statusCode, 409);
    const csrf = await app.inject({
      method: "POST",
      url: "/v1/farm/start",
      headers: { cookie },
      payload: {},
    });
    assert.equal(csrf.statusCode, 403);
    const clientInstanceId = randomUUID();
    const control = await app.inject({
      method: "POST",
      url: "/v1/presence/acquire",
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { clientInstanceId },
    });
    assert.equal(control.statusCode, 200);
    const generation = control.json().data.generation;
    const started = await app.inject({
      method: "POST",
      url: "/v1/farm/start",
      headers: {
        ...headers,
        "idempotency-key": randomUUID(),
        "x-presence-generation": String(generation),
      },
      payload: { clientInstanceId, regionId: "VARZEA" },
    });
    assert.equal(started.statusCode, 200);
    const matchId = started.json().data.currentMatchId;
    const current = await app.inject({
      url: `/v1/matches/${matchId}`,
      headers: { cookie },
    });
    assert.equal(current.json().data.result, null);
    assert.equal(current.json().data.events.length, 1);
    assert.equal(current.json().data.events[0].type, "MATCH_STARTED");
    assert.ok(!JSON.stringify(current.json()).includes("seed"));
    // Keep all 90 seconds covered through real accepted heartbeats, not client timestamps.
    for (let seq = 1; seq <= 8; seq++) {
      now += 10000;
      const hb = await app.inject({
        method: "POST",
        url: "/v1/presence/heartbeat",
        headers: { ...headers, "idempotency-key": randomUUID() },
        payload: {
          clientInstanceId,
          leaseGeneration: generation,
          sequence: seq,
        },
      });
      assert.equal(hb.statusCode, 200);
    }
    await db.query(
      "CREATE FUNCTION qa_fail_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA failure'; END; $$",
    );
    await db.query(
      "CREATE TRIGGER qa_settlement_failure BEFORE INSERT ON reward_grants FOR EACH ROW EXECUTE FUNCTION qa_fail_grant()",
    );
    now += 10000;
    const readOnly = await app.inject({ url: "/v1/club", headers: { cookie } });
    assert.equal(readOnly.json().data.wallet.balance, "0");
    assert.equal(readOnly.json().data.recentMatches.length, 0);
    await assert.rejects(() => repo.tick());
    assert.equal(
      (
        await db.query<{ state: string }>(
          "SELECT state FROM matches WHERE id=$1",
          [matchId],
        )
      ).rows[0].state,
      "RUNNING",
    );
    assert.equal(
      (await db.query<{ balance: string }>("SELECT balance::text FROM wallets"))
        .rows[0].balance,
      "0",
    );
    assert.equal(
      (
        await db.query<{ count: string }>(
          "SELECT count(*)::text FROM coin_ledger_entries",
        )
      ).rows[0].count,
      "0",
    );
    await db.query("DROP TRIGGER qa_settlement_failure ON reward_grants");
    await repo.tick();
    const once = (
      await app.inject({ url: "/v1/club", headers: { cookie } })
    ).json().data;
    assert.equal(once.recentMatches.length, 1);
    assert.equal(once.club.xpTotal, "28");
    assert.ok(BigInt(once.wallet.balance) > 0n);
    await repo.tick();
    const twice = (
      await app.inject({ url: "/v1/club", headers: { cookie } })
    ).json().data;
    assert.equal(twice.wallet.balance, once.wallet.balance);
    assert.equal(twice.ledger.length, 1);
    const sum = (
      await db.query<{ total: string }>(
        "SELECT sum(delta)::text AS total FROM coin_ledger_entries",
      )
    ).rows[0].total;
    assert.equal(sum, once.wallet.balance);
    await assert.rejects(() =>
      db.query("UPDATE coin_ledger_entries SET delta=999"),
    );
    const other = await app.inject({
        method: "POST",
        url: "/v1/auth/guest",
        headers: base,
        payload: {},
      }),
      otherCookie = other.cookies[0].name + "=" + other.cookies[0].value;
    const forbidden = await app.inject({
      url: `/v1/matches/${matchId}`,
      headers: { cookie: otherCookie },
    });
    assert.equal(forbidden.statusCode, 404);
    const replay = await app.inject({
      url: `/v1/matches/${matchId}/events?afterSequence=${once.recentMatches[0].events.length - 1}`,
      headers: { cookie },
    });
    assert.equal(replay.json().data.events.length, 1);
    assert.equal(replay.json().data.complete, true);
    const recovered = await buildApp(db, { clock: () => now });
    try {
      const resumed = await recovered.app.inject({
        url: "/v1/bootstrap",
        headers: { cookie },
      });
      assert.equal(
        resumed.json().data.game.wallet.balance,
        once.wallet.balance,
      );
    } finally {
      await recovered.app.close();
    }
    await db.query("UPDATE wallets SET balance=balance+1");
    const corrupt = await app.inject({ url: "/v1/club", headers: { cookie } });
    assert.equal(corrupt.statusCode, 503);
    assert.equal(corrupt.json().error.code, "ECONOMY_INTEGRITY_ERROR");
  } finally {
    await app.close();
    await db.close();
  }
});
