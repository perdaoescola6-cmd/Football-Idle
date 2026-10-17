import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { GameError } from "../../../packages/game/engine.js";
import type { Database } from "./db.js";
import { GameRepository } from "./repository.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerGameRoutes } from "./game-routes.js";
import { registerTestRoutes } from "./test-routes.js";
import { registerClubRoutes } from "./club-routes.js";
import { registerRosterRoutes } from "./roster-routes.js";
import { registerFootballRoutes } from "./brasfoot-routes.js";
import { registerFootballMarket } from "./football-market.js";
import { registerFootballCommunity } from "./football-community.js";
export async function buildApp(
  db: Database,
  options: {
    clock?: () => number;
    logger?: boolean;
    origin?: string;
    godMode?: boolean;
  } = {},
) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 16384,
    requestTimeout: 15000,
  });
  const repo = new GameRepository(db, options.clock);
  await app.register(cookie);
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  const allowedOrigin =
    options.origin ?? process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";
  app.addHook("onRequest", async (request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (
        request.headers.origin !== allowedOrigin ||
        request.headers["x-requested-with"] !== "football-idle"
      )
        throw new GameError(
          "CSRF_REJECTED",
          "Origem da ação não autorizada.",
          403,
        );
    }
  });
  app.setErrorHandler((error, request, reply) => {
    const domain = error instanceof GameError;
    const validation = error instanceof ZodError;
    const fallback =
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const status = domain ? error.status : validation ? 400 : fallback;
    if (status >= 500) request.log.error(error);
    reply.code(status).send({
      error: {
        code: domain
          ? error.code
          : validation
            ? "INVALID_REQUEST"
            : status === 429
              ? "RATE_LIMITED"
              : "INTERNAL_ERROR",
        message: domain
          ? error.message
          : validation
            ? "Dados inválidos. Confira os campos e tente novamente."
            : status === 429
              ? "Muitas ações. Aguarde um instante."
              : "Não foi possível concluir a ação.",
      },
      meta: {
        requestId: request.id,
        serverTime: new Date(repo.clock()).toISOString(),
      },
    });
  });
  app.get("/health", async () => ({ status: "ok", database: db.mode }));
  const godModeEnabled =
    options.godMode === true &&
    process.env.NODE_ENV !== "production" &&
    db.mode === "embedded";
  registerAuthRoutes(app, repo, godModeEnabled);
  registerGameRoutes(app, repo);
  registerClubRoutes(app, repo);
  registerRosterRoutes(app, repo);
  registerFootballRoutes(app, repo);
  registerFootballMarket(app, repo);
  registerFootballCommunity(app, repo);
  if (godModeEnabled) registerTestRoutes(app, repo);
  await app.ready();
  return { app, repo };
}
