import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { GameError } from "../../../packages/game/engine.js";
export const emptyBody = z.object({}).strict();
export function key(request: FastifyRequest) {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw new GameError(
      "INVALID_IDEMPOTENCY_KEY",
      "Esta ação precisa de uma chave de repetição válida.",
      400,
    );
  return value;
}
export function generation(request: FastifyRequest) {
  return z.coerce
    .number()
    .int()
    .positive()
    .parse(request.headers["x-presence-generation"]);
}
export function expectedVersion(request: FastifyRequest) {
  const version = request.headers["if-match"];
  if (typeof version !== "string" || !/^"\d+"$/.test(version))
    throw new GameError(
      "IF_MATCH_REQUIRED",
      "Informe a versão atual antes de alterar.",
      400,
    );
  return Number(version.slice(1, -1));
}
export function respond(
  request: FastifyRequest,
  reply: FastifyReply,
  data: unknown,
  status = 200,
) {
  return reply.code(status).send({
    data,
    meta: { requestId: request.id, serverTime: new Date().toISOString() },
  });
}
