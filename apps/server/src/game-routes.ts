import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  acquirePresence,
  assertController,
  createClub,
  GameError,
  heartbeat,
  releasePresence,
  setFarm,
  setLineup,
} from "../../../packages/game/engine.js";
import { hash, loadClub, saveClub, type GameRepository } from "./repository.js";
import { identity } from "./auth-routes.js";
import {
  emptyBody,
  expectedVersion,
  generation,
  key,
  respond,
} from "./http.js";
const regionSchema = z.enum([
  "VARZEA",
  "REGIONAL",
  "ESTADUAL",
  "NACIONAL",
  "CONTINENTAL",
  "EUROPA",
  "ELITE",
]);
export function registerGameRoutes(app: FastifyInstance, repo: GameRepository) {
  async function auth(request: FastifyRequest) {
    return (await identity(repo, request))!;
  }
  app.post("/v1/clubs", async (request, reply) => {
    const a = await auth(request),
      body = z
        .object({
          name: z
            .string()
            .transform((v) => v.normalize("NFC").trim())
            .refine(
              (v) =>
                Array.from(v).length >= 3 &&
                Array.from(v).length <= 32 &&
                !/[\p{Cc}\p{Cf}]/u.test(v),
              "Use entre 3 e 32 caracteres, sem caracteres de controle.",
            ),
        })
        .strict()
        .parse(request.body);
    const idem = key(request),
      digest = hash(JSON.stringify(body));
    const result = await repo.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
        a.accountId,
      ]);
      const previous = (
        await tx.query<{ request_hash: string; response: unknown }>(
          "SELECT request_hash,response FROM idempotency_records WHERE account_id=$1 AND operation=$2 AND key=$3",
          [a.accountId, "clubs.create", idem],
        )
      ).rows[0];
      if (previous) {
        if (previous.request_hash !== digest)
          throw new GameError(
            "IDEMPOTENCY_KEY_REUSED",
            "Chave já usada para outro nome.",
            409,
          );
        return previous.response;
      }
      if (await loadClub(tx, a.accountId))
        throw new GameError(
          "CLUB_ALREADY_EXISTS",
          "Esta conta já possui um clube.",
          409,
        );
      const now = repo.clock(),
        s = createClub(
          randomUUID(),
          body.name,
          randomBytes(32).toString("hex"),
          now,
        );
      await tx.query(
        "INSERT INTO clubs(id,account_id,name,runtime) VALUES($1,$2,$3,$4)",
        [s.id, a.accountId, s.name, JSON.stringify(s.runtime)],
      );
      await saveClub(tx, s, [], now);
      const response = { clubId: s.id };
      await tx.query(
        "INSERT INTO idempotency_records(account_id,operation,key,request_hash,response) VALUES($1,$2,$3,$4,$5)",
        [a.accountId, "clubs.create", idem, digest, JSON.stringify(response)],
      );
      return response;
    });
    return respond(request, reply, result, 201);
  });
  app.get("/v1/club", async (request, reply) => {
    const a = await auth(request),
      view = await repo.view(
        a.accountId,
        false,
        z.object({ omitRoster: z.enum(["1"]).optional() }).parse(request.query)
          .omitRoster === "1",
      );
    if (!view)
      throw new GameError("CLUB_NOT_FOUND", "Crie seu clube primeiro.", 404);
    return respond(request, reply, view);
  });
  app.post("/v1/presence/acquire", async (request, reply) => {
    const a = await auth(request);
    const body = z
      .object({ clientInstanceId: z.string().uuid() })
      .strict()
      .parse(request.body);
    const value = await repo.mutate(
      a.accountId,
      "presence.acquire",
      key(request),
      body,
      (s) =>
        acquirePresence(
          s,
          `${a.sessionId}:${body.clientInstanceId}`,
          repo.gameTime(s),
        ),
    );
    return respond(request, reply, value);
  });
  app.post("/v1/presence/heartbeat", async (request, reply) => {
    const a = await auth(request),
      body = z
        .object({
          clientInstanceId: z.string().uuid(),
          leaseGeneration: z.number().int().positive(),
          sequence: z.number().int().positive(),
        })
        .strict()
        .parse(request.body);
    const value = await repo.mutate(
      a.accountId,
      "presence.heartbeat",
      key(request),
      body,
      (s) =>
        heartbeat(
          s,
          `${a.sessionId}:${body.clientInstanceId}`,
          body.leaseGeneration,
          body.sequence,
          repo.gameTime(s),
        ),
    );
    return respond(request, reply, value);
  });
  app.post("/v1/presence/release", async (request, reply) => {
    const a = await auth(request),
      body = z
        .object({
          clientInstanceId: z.string().uuid(),
          leaseGeneration: z.number().int().positive(),
        })
        .strict()
        .parse(request.body);
    const value = await repo.mutate(
      a.accountId,
      "presence.release",
      key(request),
      body,
      (s) => {
        releasePresence(
          s,
          `${a.sessionId}:${body.clientInstanceId}`,
          body.leaseGeneration,
          repo.gameTime(s),
        );
        return { released: true };
      },
    );
    return respond(request, reply, value);
  });
  const controlBody = z.object({ clientInstanceId: z.string().uuid() });
  app.put("/v1/lineup", async (request, reply) => {
    const a = await auth(request),
      body = controlBody
        .extend({
          slots: z
            .array(
              z
                .object({
                  slot: z.number().int().min(1).max(5),
                  athleteId: z.string().uuid(),
                })
                .strict(),
            )
            .length(5),
        })
        .strict()
        .parse(request.body);
    const gen = generation(request),
      version = expectedVersion(request);
    const value = await repo.mutate(
      a.accountId,
      "lineup.set",
      key(request),
      { ...body, generation: gen, version },
      (s) => {
        assertController(
          s,
          `${a.sessionId}:${body.clientInstanceId}`,
          gen,
          repo.gameTime(s),
        );
        const slots = [...body.slots].sort((a, b) => a.slot - b.slot);
        if (slots.some((slot, i) => slot.slot !== i + 1))
          throw new GameError(
            "INVALID_LINEUP",
            "Preencha os cinco slots sem repetição.",
          );
        setLineup(
          s,
          slots.map((slot) => slot.athleteId),
          version,
        );
        return {
          version: s.runtime.lineupVersion,
          effectiveFrom: "NEXT_MATCH",
        };
      },
    );
    return respond(request, reply, value);
  });
  for (const action of ["start", "stop"] as const)
    app.post(`/v1/farm/${action}`, async (request, reply) => {
      const a = await auth(request),
        body = controlBody
          .extend({ regionId: regionSchema.optional() })
          .strict()
          .parse(request.body),
        gen = generation(request);
      const value = await repo.mutate(
        a.accountId,
        `farm.${action}`,
        key(request),
        { ...body, generation: gen },
        (s) => {
          assertController(
            s,
            `${a.sessionId}:${body.clientInstanceId}`,
            gen,
            repo.gameTime(s),
          );
          setFarm(
            s,
            action === "start",
            body.regionId ?? s.runtime.farm.region,
            repo.gameTime(s),
          );
          return {
            running: s.runtime.farm.running,
            currentMatchId: s.current?.view.id ?? null,
          };
        },
      );
      return respond(request, reply, value);
    });
  app.post("/v1/offline/reconcile", async (request, reply) => {
    const a = await auth(request);
    emptyBody.parse(request.body);
    // Settlements are performed by the durable match queue. No second claim/payment exists.
    const game = await repo.view(a.accountId, true);
    return respond(request, reply, {
      status: game?.offline.catchUpPending ? "PROCESSING" : "RECONCILED",
      game,
    });
  });
  app.get("/v1/matches/:matchId", async (request, reply) => {
    const a = await auth(request),
      params = z.object({ matchId: z.string().uuid() }).parse(request.params);
    const view = await repo.match(a.accountId, params.matchId);
    return respond(request, reply, view);
  });
  app.get("/v1/matches/:matchId/events", async (request, reply) => {
    const a = await auth(request),
      params = z.object({ matchId: z.string().uuid() }).parse(request.params),
      query = z
        .object({ afterSequence: z.coerce.number().int().min(0).default(0) })
        .parse(request.query);
    const view = await repo.match(a.accountId, params.matchId);
    return respond(request, reply, {
      matchId: params.matchId,
      events: view.events.filter((e) => e.sequence > query.afterSequence),
      lastSequence: view.events.at(-1)?.sequence ?? 0,
      complete: view.state === "SETTLED",
    });
  });
}
