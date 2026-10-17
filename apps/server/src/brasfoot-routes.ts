import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { identity } from "./auth-routes.js";
import { key, respond } from "./http.js";
import type { GameRepository } from "./repository.js";
import {
  football,
  initializeFootball,
  openPack,
  setFootballLineup,
  sellCards,
  startFootballMatch,
  newFootballSeason,
  suggestLineup,
  trainCard,
} from "../../../packages/game/brasfoot.js";
import { GameError } from "../../../packages/game/engine.js";
import {
  pauseRound,
  resumeRound,
  substituteFootball,
} from "../../../packages/game/football-management.js";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("INIT") }).strict(),
  z.object({ action: z.literal("WELCOME") }).strict(),
  z
    .object({
      action: z.literal("PACK"),
      packId: z.string().max(32),
      focus: z.enum(["GENERAL", "GOL", "DEF", "MEI", "ATA"]).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("LINEUP"),
      ids: z.array(z.string().uuid()).length(11),
      bench: z.array(z.string().uuid()).max(7),
      formation: z.enum(["4-4-2", "4-3-3", "3-5-2", "4-2-3-1"]),
      tactic: z.enum(["BALANCED", "ATTACK", "DEFEND"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("SELL"),
      ids: z.array(z.string().uuid()).min(1).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("LOCK"),
      id: z.string().uuid(),
      locked: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("ORGANIZER"),
      enabled: z.boolean(),
      duplicateToDepot: z.boolean(),
      lockAt: z.number().int().min(0).max(4),
    })
    .strict(),
  z.object({ action: z.literal("PLAY") }).strict(),
  z.object({ action: z.literal("PAUSE"), matchId: z.string().uuid() }).strict(),
  z
    .object({ action: z.literal("RESUME"), matchId: z.string().uuid() })
    .strict(),
  z
    .object({
      action: z.literal("SUBSTITUTE"),
      matchId: z.string().uuid(),
      outId: z.string().uuid(),
      inId: z.string().uuid(),
    })
    .strict(),
  z.object({ action: z.literal("NEXT_SEASON") }).strict(),
  z
    .object({
      action: z.literal("AUTO_LINEUP"),
      formation: z.enum(["4-4-2", "4-3-3", "3-5-2", "4-2-3-1"]),
      tactic: z.enum(["BALANCED", "ATTACK", "DEFEND"]),
    })
    .strict(),
  z.object({ action: z.literal("TRAIN"), id: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("MOVE"),
      id: z.string().uuid(),
      storage: z.enum(["COLLECTION", "DEPOT"]),
    })
    .strict(),
  z.object({ action: z.literal("CAPTAIN"), id: z.string().uuid() }).strict(),
]);
export function registerFootballRoutes(
  app: FastifyInstance,
  repo: GameRepository,
) {
  app.post("/v1/brasfoot/command", async (request, reply) => {
    const auth = (await identity(repo, request))!,
      body = schema.parse(request.body);
    const result = await repo.mutate(
      auth.accountId,
      "brasfoot.command",
      key(request),
      body,
      async (s, tx) => {
        const now = repo.gameTime(s);
        const execute = () => {
          if (body.action === "INIT") {
            initializeFootball(s, now);
            return {
              message: s.runtime.brasfoot
                ? "Clube 11v11 pronto. Progresso anterior preservado."
                : "Farm antigo encerrado. Aguarde a partida atual terminar e ative novamente.",
            };
          }
          const f = football(s);
          switch (body.action) {
            case "WELCOME":
              return openPack(s, "basic", now, true);
            case "PACK":
              return openPack(
                s,
                body.packId,
                now,
                false,
                body.focus ?? "GENERAL",
              );
            case "LINEUP":
              setFootballLineup(
                s,
                body.ids,
                body.bench,
                body.formation,
                body.tactic,
              );
              break;
            case "SELL":
              return sellCards(s, body.ids, now);
            case "LOCK": {
              const c = f.cards.find((c) => c.id === body.id);
              if (!c)
                throw new GameError(
                  "CARD_NOT_OWNED",
                  "Carta não pertence ao clube.",
                );
              c.locked = body.locked;
              break;
            }
            case "ORGANIZER":
              f.organizer = {
                enabled: body.enabled,
                duplicateToDepot: body.duplicateToDepot,
                lockAt: body.lockAt,
              };
              break;
            case "PAUSE":
              pauseRound(s, body.matchId, now);
              break;
            case "RESUME":
              resumeRound(s, body.matchId, now);
              break;
            case "SUBSTITUTE":
              substituteFootball(s, body.matchId, body.outId, body.inId, now);
              break;
            case "PLAY":
              startFootballMatch(s, now);
              break;
            case "NEXT_SEASON":
              newFootballSeason(s, now);
              break;
            case "AUTO_LINEUP":
              return suggestLineup(s, body.formation, body.tactic);
            case "TRAIN":
              return trainCard(s, body.id, now);
            case "MOVE": {
              const c = f.cards.find((c) => c.id === body.id);
              if (!c)
                throw new GameError(
                  "CARD_NOT_OWNED",
                  "Carta não pertence ao clube.",
                );
              c.storage = body.storage;
              break;
            }
            case "CAPTAIN":
              if (f.match)
                throw new GameError(
                  "MATCH_ACTIVE",
                  "Escolha o capitão antes da partida.",
                );
              if (!f.lineup.includes(body.id))
                throw new GameError(
                  "INVALID_CAPTAIN",
                  "O capitão precisa ser titular.",
                );
              f.captain = body.id;
              break;
          }
          return { message: "Clube atualizado." };
        };
        const response = execute();
        if (body.action === "PLAY" && s.runtime.brasfoot?.managementVersion) {
          await tx.query(
            "UPDATE football_card_listings SET status='CANCELLED',closed_at=$2 WHERE seller_id=$1 AND status='OPEN'",
            [s.id, now],
          );
          s.runtime.brasfoot.listed = [];
        }
        if (body.action === "INIT" && s.runtime.brasfoot) {
          await tx.query(
            "UPDATE market_listings SET status='CANCELLED',body=jsonb_set(body,'{status}','\"CANCELLED\"'::jsonb) WHERE seller_id=$1 AND status='OPEN'",
            [s.id],
          );
          await tx.query(
            "UPDATE coin_holds SET active=false WHERE club_id=$1 OR listing_id IN (SELECT id FROM market_listings WHERE seller_id=$1)",
            [s.id],
          );
          s.reservedCoins = "0";
        }
        await tx.query(
          "INSERT INTO football_audit(id,club_id,created_at,action,payload) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            s.id,
            now,
            body.action,
            JSON.stringify({ request: body, response }),
          ],
        );
        return response;
      },
    );
    return respond(request, reply, result);
  });
}
