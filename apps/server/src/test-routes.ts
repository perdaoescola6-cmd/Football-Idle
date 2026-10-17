import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertController } from "../../../packages/game/engine.js";
import { changeTestSpeed } from "../../../packages/game/test-clock.js";
import type { GameRepository } from "./repository.js";
import { identity } from "./auth-routes.js";
import { generation, key, respond } from "./http.js";
export function registerTestRoutes(app: FastifyInstance, repo: GameRepository) {
  app.post("/v1/dev/god-mode", async (request, reply) => {
    const auth = (await identity(repo, request))!;
    const body = z
      .object({
        clientInstanceId: z.string().uuid(),
        speed: z.union([z.literal(1), z.literal(10), z.literal(60)]),
      })
      .strict()
      .parse(request.body);
    const gen = generation(request);
    const result = await repo.mutate(
      auth.accountId,
      "test.speed",
      key(request),
      { ...body, generation: gen },
      (state) => {
        assertController(
          state,
          `${auth.sessionId}:${body.clientInstanceId}`,
          gen,
          repo.gameTime(state),
        );
        return changeTestSpeed(state, body.speed, repo.clock());
      },
    );
    return respond(request, reply, result);
  });
}
