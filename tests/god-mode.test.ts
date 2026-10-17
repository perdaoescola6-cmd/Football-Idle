import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";

test("local god mode accelerates one club, preserves rewards, restores 1x and survives reload", async () => {
  const db = await openDatabase({ memory: true });
  let realNow = 1_000_000;
  const { app, repo } = await buildApp(db, {
    clock: () => realNow,
    godMode: true,
  });
  const common = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  async function guest(name: string) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/guest",
      headers: common,
      payload: {},
    });
    const cookie = `${response.cookies[0].name}=${response.cookies[0].value}`;
    const created = await app.inject({
      method: "POST",
      url: "/v1/clubs",
      headers: { ...common, cookie, "idempotency-key": randomUUID() },
      payload: { name },
    });
    assert.equal(created.statusCode, 201);
    return cookie;
  }
  try {
    const cookie = await guest("Teste acelerado"),
      other = await guest("Clube normal"),
      clientInstanceId = randomUUID();
    const send = (
      url: string,
      payload: Record<string, unknown>,
      idem = randomUUID(),
    ) =>
      app.inject({
        method: "POST",
        url,
        headers: {
          ...common,
          cookie,
          "idempotency-key": idem,
          "x-presence-generation": "1",
        },
        payload,
      });
    await send("/v1/presence/acquire", { clientInstanceId });
    await send("/v1/farm/start", { clientInstanceId, regionId: "VARZEA" });
    const idem = randomUUID(),
      body = { clientInstanceId, speed: 60 };
    assert.equal((await send("/v1/dev/god-mode", body, idem)).statusCode, 200);
    // An HTTP retry is not a new clock anchor or a second progression grant.
    assert.equal((await send("/v1/dev/god-mode", body, idem)).statusCode, 200);
    const invalid = await send("/v1/dev/god-mode", {
      clientInstanceId,
      speed: 999,
    });
    assert.equal(invalid.statusCode, 400);
    for (let seq = 1; seq <= 6; seq++) {
      realNow += 10000;
      const heartbeat = await send("/v1/presence/heartbeat", {
        clientInstanceId,
        leaseGeneration: 1,
        sequence: seq,
      });
      assert.equal(heartbeat.statusCode, 200);
    }
    await repo.tick();
    const accelerated = (
      await app.inject({ url: "/v1/club", headers: { cookie } })
    ).json().data;
    assert.equal(accelerated.club.xpTotal, "1120");
    assert.equal(accelerated.club.regionalUnlocked, true);
    assert.equal(accelerated.testMode.speed, 60);
    assert.equal(accelerated.serverTime, 1_000_000 + 3_600_000);
    const matches = (
      await db.query<{ count: string }>(
        "SELECT count(*)::text FROM matches WHERE state='SETTLED'",
      )
    ).rows[0].count;
    assert.equal(matches, "40");
    assert.ok(
      accelerated.recentMatches.every(
        (m: { testRun: boolean; reward: { mode: string } }) =>
          m.reward.mode === "ONLINE" && m.testRun === true,
      ),
    );
    const normal = (
      await app.inject({ url: "/v1/club", headers: { cookie: other } })
    ).json().data;
    assert.equal(normal.serverTime, realNow);
    assert.equal(normal.club.xpTotal, "0");
    assert.equal(normal.testMode.speed, 1);
    const balance = accelerated.wallet.balance;
    assert.equal(
      (await send("/v1/dev/god-mode", { clientInstanceId, speed: 1 }))
        .statusCode,
      200,
    );
    realNow += 1500;
    await repo.tick();
    const restored = (
      await app.inject({ url: "/v1/club", headers: { cookie } })
    ).json().data;
    assert.equal(restored.wallet.balance, balance);
    assert.equal(restored.serverTime, 4_601_500);
    assert.equal(restored.testMode.used, true);
    assert.equal(restored.testMode.speed, 1);
    const recovered = await buildApp(db, {
      clock: () => realNow,
      godMode: true,
    });
    try {
      const loaded = (
        await recovered.app.inject({
          url: "/v1/bootstrap",
          headers: { cookie },
        })
      ).json().data;
      assert.equal(loaded.game.serverTime, restored.serverTime);
      assert.equal(loaded.game.club.xpTotal, "1120");
    } finally {
      await recovered.app.close();
    }
    const noControl = await send("/v1/dev/god-mode", {
      clientInstanceId: randomUUID(),
      speed: 60,
    });
    assert.equal(noControl.statusCode, 409);
    const noSession = await app.inject({
      method: "POST",
      url: "/v1/dev/god-mode",
      headers: common,
      payload: { clientInstanceId, speed: 60 },
    });
    assert.equal(noSession.statusCode, 401);
  } finally {
    await app.close();
    await db.close();
  }
});

test("god mode endpoint is absent by default and in production even when requested", async () => {
  const db = await openDatabase({ memory: true }),
    previous = process.env.NODE_ENV;
  try {
    for (const production of [false, true]) {
      if (production) process.env.NODE_ENV = "production";
      const { app } = await buildApp(db, { godMode: production });
      try {
        const bootstrap = (await app.inject({ url: "/v1/bootstrap" })).json()
          .data;
        assert.equal(bootstrap.devTools.godMode, false);
        const response = await app.inject({
          method: "POST",
          url: "/v1/dev/god-mode",
          headers: {
            origin: "http://127.0.0.1:3000",
            "x-requested-with": "football-idle",
          },
          payload: { speed: 60 },
        });
        assert.equal(response.statusCode, 404);
      } finally {
        await app.close();
      }
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    await db.close();
  }
});
