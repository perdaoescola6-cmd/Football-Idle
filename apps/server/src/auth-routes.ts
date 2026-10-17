import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GameRepository } from "./repository.js";
import { hash } from "./repository.js";
import { GameError } from "../../../packages/game/engine.js";
import { emptyBody, respond } from "./http.js";
export interface Identity {
  accountId: string;
  sessionId: string;
}
export async function identity(
  repo: GameRepository,
  request: FastifyRequest,
  required = true,
): Promise<Identity | null> {
  const token = request.cookies.fi_session;
  if (!token) {
    if (required)
      throw new GameError(
        "UNAUTHENTICATED",
        "Entre no protótipo para continuar.",
        401,
      );
    return null;
  }
  const row = (
    await repo.db.query<{ account_id: string }>(
      "SELECT account_id FROM auth_sessions WHERE token_hash=$1 AND expires_at>$2",
      [hash(token), repo.clock()],
    )
  ).rows[0];
  if (!row) {
    if (required)
      throw new GameError(
        "UNAUTHENTICATED",
        "Sua sessão expirou. Entre novamente.",
        401,
      );
    return null;
  }
  return { accountId: row.account_id, sessionId: hash(token) };
}
export function registerAuthRoutes(
  app: FastifyInstance,
  repo: GameRepository,
  godMode = false,
) {
  app.post(
    "/v1/auth/guest",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      emptyBody.parse(request.body);
      const previous = await identity(repo, request, false),
        guest = await repo.guest(previous?.accountId);
      if (guest.token)
        reply.setCookie("fi_session", guest.token, {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          maxAge: 30 * 86400,
        });
      return respond(request, reply, { account: { id: guest.accountId } });
    },
  );
  app.get("/v1/bootstrap", async (request, reply) => {
    const auth = await identity(repo, request, false);
    return respond(request, reply, {
      devTools: { godMode },
      account: auth ? { id: auth.accountId } : null,
      game: auth ? await repo.view(auth.accountId) : null,
    });
  });
}
