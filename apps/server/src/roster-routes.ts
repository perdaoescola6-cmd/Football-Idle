import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AthleteFilter,
  SaleQuote,
  ScoutingConfig,
} from "../../../packages/contracts/index.js";
import {
  matchesFilter,
  naturalOvr,
  npcPrice,
  unavailableReason,
} from "../../../packages/contracts/roster.js";
import {
  assertController,
  GameError,
  type State,
} from "../../../packages/game/engine.js";
import { coins, gameplay } from "../../../packages/game/gameplay.js";
import { identity } from "./auth-routes.js";
import { key, generation, respond } from "./http.js";
import type { GameRepository } from "./repository.js";
const control = { clientInstanceId: z.string().uuid() };
const filter = z
  .object({
    search: z.string().max(80).optional(),
    position: z.enum(["GOL", "ZAG", "MEI", "ATA"]).optional(),
    rarity: z.enum(["P1", "P2", "P3", "P4", "P5"]).optional(),
    storage: z.enum(["COLLECTION", "DEPOT"]).optional(),
    role: z.enum(["ALL", "STARTER", "BENCH"]).optional(),
    minOvr: z.number().int().min(0).max(99).optional(),
    maxOvr: z.number().int().min(0).max(99).optional(),
    minPotential: z.number().int().min(0).max(99).optional(),
    maxPotential: z.number().int().min(0).max(99).optional(),
    minLevel: z
      .string()
      .regex(/^[1-9]\d{0,299}$/)
      .optional(),
    maxLevel: z
      .string()
      .regex(/^[1-9]\d{0,299}$/)
      .optional(),
    region: z
      .enum([
        "VARZEA",
        "REGIONAL",
        "ESTADUAL",
        "NACIONAL",
        "CONTINENTAL",
        "EUROPA",
        "ELITE",
      ])
      .optional(),
    protected: z.boolean().optional(),
    eligibleOnly: z.boolean().optional(),
  })
  .strict();
const condition = z
  .object({
    field: z.enum([
      "rarity",
      "position",
      "potential",
      "birthOvr",
      "finishing",
      "passing",
      "control",
      "pace",
      "marking",
      "defending",
    ]),
    op: z.enum(["EQ", "GTE", "LTE"]),
    value: z.string().max(20),
  })
  .strict()
  .refine((c) =>
    c.field === "rarity"
      ? c.op === "EQ" && ["P1", "P2", "P3", "P4", "P5"].includes(c.value)
      : c.field === "position"
        ? c.op === "EQ" && ["GOL", "ZAG", "MEI", "ATA"].includes(c.value)
        : /^\d{1,2}$/.test(c.value),
  );
const config = z
  .object({
    enabled: z.boolean(),
    fallback: z.enum(["COLLECTION", "DEPOT"]),
    rareWarningPotential: z.number().int().min(0).max(99),
    rules: z
      .array(
        z
          .object({
            id: z.string().min(1).max(60),
            name: z.string().trim().min(1).max(80),
            enabled: z.boolean(),
            mode: z.enum(["ALL", "ANY"]),
            conditions: z.array(condition).min(1).max(12),
            destination: z.enum(["COLLECTION", "DEPOT"]),
            protect: z.boolean(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict()
  .refine((c) => new Set(c.rules.map((r) => r.id)).size === c.rules.length);
const ctx = (s: State) => ({
  lineup: s.runtime.lineup,
  training: gameplay(s).training.map((t) => t.athleteId),
  locked: s.lockedAthletes ?? [],
  active: s.current?.view.home.map((a) => a.id) ?? [],
});
export function registerRosterRoutes(
  app: FastifyInstance,
  repo: GameRepository,
) {
  app.post("/v1/roster/action", async (req, reply) => {
    const a = (await identity(repo, req))!,
      b = z
        .object({
          ...control,
          athleteId: z.string().uuid(),
          action: z.enum([
            "PROTECT",
            "UNPROTECT",
            "COLLECTION",
            "DEPOT",
            "TRAIN_PAUSE",
            "TRAIN_RESUME",
          ]),
          confirmed: z.boolean().optional(),
        })
        .strict()
        .parse(req.body),
      gen = generation(req);
    const result = await repo.mutate(
      a.accountId,
      "roster.action",
      key(req),
      { ...b, gen },
      (s) => {
        assertController(
          s,
          `${a.sessionId}:${b.clientInstanceId}`,
          gen,
          repo.gameTime(s),
        );
        const athlete = s.athletes.find((x) => x.id === b.athleteId);
        if (!athlete)
          throw new GameError("NOT_OWNER", "Atleta não encontrado.", 404);
        const slot = gameplay(s).training.find(
          (t) => t.athleteId === athlete.id,
        );
        if (b.action === "TRAIN_PAUSE" || b.action === "TRAIN_RESUME") {
          if (!slot)
            throw new GameError("NOT_TRAINING", "Atleta não está no CT.");
          slot.paused = b.action === "TRAIN_PAUSE";
          slot.lastAt = repo.gameTime(s);
          slot.status = slot.paused ? "PAUSED" : "ACTIVE";
        } else if (b.action === "PROTECT" || b.action === "UNPROTECT") {
          if (s.lockedAthletes?.includes(athlete.id))
            throw new GameError(
              "ATHLETE_BUSY",
              "Retire o anúncio antes de alterar a proteção.",
            );
          if (b.action === "UNPROTECT" && b.confirmed !== true)
            throw new GameError(
              "CONFIRMATION_REQUIRED",
              "Confirme explicitamente o desbloqueio.",
            );
          athlete.protected = b.action === "PROTECT";
        } else {
          const reason = unavailableReason(
            { ...athlete, protected: false },
            ctx(s),
          );
          if (b.action === "DEPOT" && reason)
            throw new GameError("ATHLETE_BUSY", reason);
          athlete.storage = b.action;
          athlete.scoutReason = "Organização manual do jogador";
        }
        return { message: "Atleta atualizado." };
      },
    );
    return respond(req, reply, result);
  });
  app.post("/v1/scouting/config", { bodyLimit: 100000 }, async (req, reply) => {
    const a = (await identity(repo, req))!,
      b = z
        .object({ ...control, config })
        .strict()
        .parse(req.body),
      gen = generation(req);
    const result = await repo.mutate(
      a.accountId,
      "scouting.config",
      key(req),
      { ...b, gen },
      (s) => {
        assertController(
          s,
          `${a.sessionId}:${b.clientInstanceId}`,
          gen,
          repo.gameTime(s),
        );
        gameplay(s).scouting = b.config as ScoutingConfig;
        return {
          message:
            "Regras salvas. Serão aplicadas aos próximos drops online, sem custo e sem mudar as probabilidades.",
        };
      },
    );
    return respond(req, reply, result);
  });
  app.post(
    "/v1/roster/sell/preview",
    { bodyLimit: 1000000 },
    async (req, reply) => {
      const a = (await identity(repo, req))!,
        b = z
          .object({
            ...control,
            ids: z.array(z.string().uuid()).max(10000).optional(),
            filter: filter.optional(),
          })
          .strict()
          .refine((b) => (b.ids !== undefined) !== (b.filter !== undefined))
          .parse(req.body),
        gen = generation(req);
      const result = await repo.mutate(
        a.accountId,
        "roster.sell.preview",
        key(req),
        { ...b, gen },
        async (s, tx) => {
          assertController(
            s,
            `${a.sessionId}:${b.clientInstanceId}`,
            gen,
            repo.gameTime(s),
          );
          const context = ctx(s);
          const owned = new Map(s.athletes.map((x) => [x.id, x]));
          const chosen = b.ids
            ? [...new Set(b.ids)].map((id) => {
                const x = owned.get(id);
                if (!x)
                  throw new GameError(
                    "NOT_OWNER",
                    "Seleção contém atleta que não pertence ao clube.",
                    404,
                  );
                return x;
              })
            : s.athletes.filter((a) =>
                matchesFilter(a, b.filter as AthleteFilter, context),
              );
          const quote: SaleQuote = {
            id: randomUUID(),
            expiresAt: repo.clock() + 300000,
            athletes: [],
            excluded: [],
            total: "0",
            warnings: 0,
          };
          for (const x of chosen) {
            const reason = unavailableReason(x, context);
            if (reason) quote.excluded.push({ id: x.id, reason });
            else {
              const warning =
                x.rarity === "P4" ||
                x.rarity === "P5" ||
                naturalOvr(x) >= gameplay(s).scouting!.rareWarningPotential;
              quote.athletes.push({
                id: x.id,
                name: x.displayName,
                price: npcPrice(x),
                warning,
              });
              quote.total = String(BigInt(quote.total) + BigInt(npcPrice(x)));
              if (warning) quote.warnings++;
            }
          }
          await tx.query(
            "INSERT INTO sale_quotes(id,club_id,body,expires_at) VALUES($1,$2,$3,$4)",
            [quote.id, s.id, JSON.stringify(quote), quote.expiresAt],
          );
          return quote;
        },
      );
      return respond(req, reply, result);
    },
  );
  app.post("/v1/roster/sell/commit", async (req, reply) => {
    const a = (await identity(repo, req))!,
      b = z
        .object({
          ...control,
          quoteId: z.string().uuid(),
          confirmed: z.literal(true),
          acknowledgeRare: z.boolean().optional(),
        })
        .strict()
        .parse(req.body),
      gen = generation(req);
    const result = await repo.mutate(
      a.accountId,
      "roster.sell.commit",
      key(req),
      { ...b, gen },
      async (s, tx) => {
        assertController(
          s,
          `${a.sessionId}:${b.clientInstanceId}`,
          gen,
          repo.gameTime(s),
        );
        const row = (
          await tx.query<{ body: SaleQuote }>(
            "SELECT body FROM sale_quotes WHERE id=$1 AND club_id=$2 AND NOT consumed AND expires_at>$3 FOR UPDATE",
            [b.quoteId, s.id, repo.clock()],
          )
        ).rows[0];
        if (!row)
          throw new GameError(
            "QUOTE_EXPIRED",
            "Prévia expirada ou já utilizada. Revise a seleção novamente.",
            409,
          );
        const q = row.body;
        if (!q.athletes.length)
          throw new GameError(
            "EMPTY_SELECTION",
            "Nenhum atleta pode ser vendido.",
          );
        if (q.warnings && !b.acknowledgeRare)
          throw new GameError(
            "RARE_CONFIRMATION",
            "Confirme o alerta de talentos raros.",
          );
        const context = ctx(s),
          ids = new Set(q.athletes.map((a) => a.id)),
          owned = new Map(s.athletes.map((x) => [x.id, x]));
        for (const item of q.athletes) {
          const x = owned.get(item.id);
          if (!x || unavailableReason(x, context) || npcPrice(x) !== item.price)
            throw new GameError(
              "SELECTION_CHANGED",
              "Um atleta mudou de situação. Nenhum atleta foi vendido; gere outra prévia.",
              409,
            );
        }
        coins(s, BigInt(q.total), "NPC_BULK_SALE", repo.gameTime(s));
        s.athletes = s.athletes.filter((a) => !ids.has(a.id));
        await tx.query("UPDATE sale_quotes SET consumed=true WHERE id=$1", [
          q.id,
        ]);
        return {
          message: `${ids.size} atletas negociados por ${q.total} Coins.`,
          count: ids.size,
          total: q.total,
        };
      },
    );
    return respond(req, reply, result);
  });
}
