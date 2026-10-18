import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../apps/server/src/db.js";
import { buildApp } from "../apps/server/src/app.js";
import type {
  FootballState,
  PlayerPerformance,
} from "../packages/contracts/brasfoot.js";

test("season rankings retain archived clubs and aggregate only the requested season", async () => {
  const db = await openDatabase({ memory: true });
  const { app } = await buildApp(db, { clock: () => 100000 });
  const base = {
    origin: "http://127.0.0.1:3000",
    "x-requested-with": "football-idle",
  };
  async function account(name: string, advanced: boolean, legacy = false) {
    const guest = await app.inject({
      method: "POST",
      url: "/v1/auth/guest",
      headers: base,
      payload: {},
    });
    const headers = { ...base, cookie: `fi_session=${guest.cookies[0].value}` };
    for (const [url, payload] of [
      ["/v1/clubs", { name }],
      ["/v1/brasfoot/command", { action: "INIT" }],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url,
        payload,
        headers: { ...headers, "idempotency-key": randomUUID() },
      });
      assert.ok([200, 201].includes(response.statusCode));
    }
    const state = (await app.inject({ url: "/v1/bootstrap", headers })).json()
      .data.game;
    const id: string = state.club.id;
    const f = (
      await db.query<{ f: FootballState }>(
        "SELECT runtime->'brasfoot' f FROM clubs WHERE id=$1",
        [id],
      )
    ).rows[0].f;
    const own = f.season.table.find((t) => t.id === id)!;
    Object.assign(own, { played: 1, wins: 1, points: 3, gf: 2, ga: 0 });
    f.performance = {
      shared: {
        playerId: "shared",
        editionId: "fixture",
        name: "Jogador de teste",
        position: "ATA",
        appearances: advanced ? 3 : 1,
        minutes: advanced ? 270 : 90,
        goals: advanced ? 9 : 2,
        assists: 0,
        cleanSheets: 0,
        saves: 0,
        passes: 0,
        shots: 0,
        ratingTotal: 0,
        ratedMatches: 0,
        lastClub: name,
        seasons: {
          "1": {
            appearances: 1,
            minutes: 90,
            goals: 2,
            assists: 0,
            cleanSheets: 0,
          },
          ...(advanced
            ? {
                "2": {
                  appearances: 2,
                  minutes: 180,
                  goals: 7,
                  assists: 0,
                  cleanSheets: 0,
                },
              }
            : {}),
        },
      },
    };
    if (advanced) {
      f.seasons.push({
        number: 1,
        division: 0,
        position: 1,
        nextDivision: 1,
        ...(legacy ? {} : { table: structuredClone(f.season.table) }),
      });
      f.season.number = 2;
      f.season.division = 1;
      Object.assign(own, { played: 2, wins: 2, points: 6, gf: 7 });
    }
    // Fixtures live exclusively in this in-memory test database.
    await db.query(
      "UPDATE clubs SET runtime=jsonb_set(runtime,'{brasfoot}',$2::jsonb) WHERE id=$1",
      [id, JSON.stringify(f)],
    );
    return { id, headers };
  }
  try {
    const advanced = await account("Temporada Dois", true);
    const current = await account("Temporada Um", false);
    const legacy = await account("Arquivo Antigo", true, true);
    const query = async (search = "") => {
      const response = await app.inject({
        url: `/v1/brasfoot/rankings${search}`,
        headers: advanced.headers,
      });
      assert.equal(response.statusCode, 200);
      return response.json().data as {
        clubs: {
          id: string;
          division: number;
          season: number;
          seasonPoints: number;
          position: number;
        }[];
        players: PlayerPerformance[];
        quality: unknown[];
      };
    };
    const archived = await query("?scope=season&season=1");
    assert.deepEqual(
      archived.clubs.map((c) => c.id),
      [advanced.id, current.id].sort(),
    );
    for (const club of archived.clubs) {
      assert.equal(club.season, 1);
      assert.equal(club.division, 0);
      assert.equal(club.seasonPoints, 3);
      assert.equal(club.position, 1);
    }
    assert.equal(archived.players.length, 1);
    assert.equal(archived.players[0].goals, 6);
    assert.equal(archived.players[0].appearances, 3);
    assert.equal(archived.players[0].minutes, 270);
    assert.equal(archived.players[0].shots, 0);
    assert.deepEqual(await query("?scope=season&season=1"), archived);
    const second = await query("?scope=season&season=2");
    assert.deepEqual(
      second.clubs.map((c) => c.id).sort(),
      [advanced.id, legacy.id].sort(),
    );
    assert.equal(second.players[0].goals, 14);
    const live = await query("?scope=season");
    assert.equal(live.clubs.length, 3);
    assert.equal(live.players[0].goals, 16);
    const global = await query();
    assert.equal(global.clubs.length, 3);
    assert.equal(global.players[0].goals, 20);
    const empty = await query("?scope=season&season=99");
    assert.deepEqual(empty.clubs, []);
    assert.deepEqual(empty.players, []);
    assert.deepEqual(empty.quality, global.quality);
    assert.equal(
      (await app.inject({ url: "/v1/brasfoot/rankings" })).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: "/v1/brasfoot/rankings?scope=season&season=0",
          headers: advanced.headers,
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
