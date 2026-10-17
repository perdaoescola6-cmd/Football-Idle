import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identity } from "./auth-routes.js";
import { generation, key, respond } from "./http.js";
import { assertController, GameError } from "../../../packages/game/engine.js";
import {
  command,
  coins,
  freeReserve,
  gameplay,
} from "../../../packages/game/gameplay.js";
import { loadClub, saveClub, type GameRepository } from "./repository.js";
import type { MarketListing } from "../../../packages/contracts/index.js";
import { randomStream } from "../../../packages/game/random.js";
import type { Athlete } from "../../../packages/contracts/index.js";

const control = z.object({ clientInstanceId: z.string().uuid() });
const price = z
  .string()
  .max(1000)
  .regex(/^[1-9][0-9]*$/);
const commandSchema = z.discriminatedUnion("action", [
  control
    .extend({ action: z.literal("NPC_SELL"), athleteId: z.string().uuid() })
    .strict(),
  ...(["TRAIN_START", "TRAIN_STOP"] as const).map((action) =>
    control
      .extend({ action: z.literal(action), athleteId: z.string().uuid() })
      .strict(),
  ),
  ...(
    [
      "SCOUT_START",
      "SCOUT_CLAIM",
      "TRAIN_EXPAND",
      "LEAGUE_JOIN",
      "LEAGUE_PLAY",
    ] as const
  ).map((action) => control.extend({ action: z.literal(action) }).strict()),
  control
    .extend({
      action: z.literal("SUPPLY_SELL"),
      quantity: z.number().int().min(1).max(100000),
    })
    .strict(),
]);
const marketSchema = z.discriminatedUnion("action", [
  control
    .extend({
      action: z.literal("WITHDRAW"),
      listingId: z.string().uuid(),
      offerId: z.string().uuid(),
    })
    .strict(),
  control
    .extend({
      action: z.literal("LIST"),
      athleteId: z.string().uuid(),
      price,
      days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
    })
    .strict(),
  control
    .extend({ action: z.literal("BUY"), listingId: z.string().uuid() })
    .strict(),
  control
    .extend({ action: z.literal("CANCEL"), listingId: z.string().uuid() })
    .strict(),
  control
    .extend({
      action: z.literal("OFFER"),
      listingId: z.string().uuid(),
      amount: price,
    })
    .strict(),
  control
    .extend({
      action: z.literal("ACCEPT"),
      listingId: z.string().uuid(),
      offerId: z.string().uuid(),
    })
    .strict(),
]);
export function registerClubRoutes(app: FastifyInstance, repo: GameRepository) {
  app.post("/v1/club/command", async (request, reply) => {
    const a = (await identity(repo, request))!,
      body = commandSchema.parse(request.body),
      gen = generation(request);
    const result = await repo.mutate(
      a.accountId,
      "club.command",
      key(request),
      { ...body, gen },
      async (s, tx) => {
        assertController(
          s,
          `${a.sessionId}:${body.clientInstanceId}`,
          gen,
          repo.gameTime(s),
        );
        const result = command(s, body, repo.gameTime(s));
        if (body.action === "LEAGUE_PLAY" && s.current) {
          const candidates = (
            await tx.query<{ id: string; name: string }>(
              `SELECT id,name FROM clubs WHERE id<>$1
            AND runtime->'gameplay'->'league'->>'division'=$2
            AND (runtime->'gameplay'->'league'->>'endsAt')::numeric > CASE WHEN runtime ? 'testClock'
              THEN (runtime->'testClock'->>'gameAnchor')::numeric + ($3::numeric-(runtime->'testClock'->>'realAnchor')::numeric)*(runtime->'testClock'->>'speed')::numeric
              ELSE $3::numeric END
            AND coalesce(runtime->'testClock'->>'used','false')=$4 ORDER BY id`,
              [
                s.id,
                String(gameplay(s).league!.division),
                repo.clock(),
                String(s.runtime.testClock?.used ?? false),
              ],
            )
          ).rows;
          if (candidates.length) {
            const rival =
              candidates[
                randomStream(
                  s.current.seed,
                  "league-opponent",
                )(candidates.length)
              ];
            const athletes = (
              await tx.query<{ body: Athlete }>(
                "SELECT a.body FROM lineup_slots l JOIN athletes a ON a.id=l.athlete_id AND a.club_id=l.club_id WHERE l.club_id=$1 AND a.active=true ORDER BY l.slot",
                [rival.id],
              )
            ).rows.map((r) => r.body);
            if (athletes.length === 5) {
              s.current.view.away = structuredClone(athletes);
              s.current.view.awayName = rival.name;
              s.current.view.awayClubId = rival.id;
            }
          }
        }
        return result;
      },
    );
    return respond(request, reply, result);
  });
  app.post("/v1/market/command", async (request, reply) => {
    const a = (await identity(repo, request))!,
      body = marketSchema.parse(request.body),
      gen = generation(request);
    const result = await repo.mutate(
      a.accountId,
      "market.command",
      key(request),
      { ...body, gen },
      async (s, tx) => {
        const now = repo.clock(); // Listings/offers expire in real time, unaffected by local God mode.
        assertController(
          s,
          `${a.sessionId}:${body.clientInstanceId}`,
          gen,
          repo.gameTime(s),
        );
        if (s.runtime.testClock?.used)
          throw new GameError(
            "TEST_CLUB_MARKET_DISABLED",
            "Clubes com God mode não participam do P2P. Use o empresário NPC para testes.",
          );
        await tx.query(
          "UPDATE market_listings SET status='EXPIRED',body=jsonb_set(body,'{status}','\"EXPIRED\"'::jsonb) WHERE status='OPEN' AND expires_at<=$1",
          [now],
        );
        if (body.action === "LIST") {
          const athlete = freeReserve(s, body.athleteId);
          if (!athlete.tradeEligible)
            throw new GameError(
              "NOT_TRADE_ELIGIBLE",
              "Este atleta não tem o selo de negociação P2P.",
            );
          const listing: MarketListing = {
            id: randomUUID(),
            sellerId: s.id,
            sellerName: s.name,
            athlete: structuredClone(athlete),
            price: body.price,
            expiresAt: now + body.days * 86400000,
            status: "OPEN",
            offers: [],
          };
          await tx.query(
            "INSERT INTO market_listings(id,seller_id,athlete_id,price,expires_at,status,body) VALUES($1,$2,$3,$4,$5,'OPEN',$6)",
            [
              listing.id,
              s.id,
              athlete.id,
              body.price,
              listing.expiresAt,
              JSON.stringify(listing),
            ],
          );
          return {
            message: "Atleta listado. Comissão de 15% ao concluir a venda.",
          };
        }
        const row = (
          await tx.query<{ body: MarketListing }>(
            "SELECT body FROM market_listings WHERE id=$1 AND status='OPEN' AND expires_at>$2 FOR UPDATE",
            [body.listingId, now],
          )
        ).rows[0];
        if (!row)
          throw new GameError(
            "LISTING_CLOSED",
            "Anúncio encerrado ou expirado.",
            409,
          );
        const l = row.body;
        if (body.action === "WITHDRAW") {
          const offer = l.offers.find(
            (o) =>
              o.id === body.offerId &&
              o.buyerId === s.id &&
              o.status === "OPEN",
          );
          if (!offer)
            throw new GameError("NOT_OWNER", "Oferta não encontrada.", 404);
          offer.status = "REJECTED";
          await tx.query(
            "UPDATE coin_holds SET active=false WHERE offer_id=$1",
            [offer.id],
          );
        } else if (body.action === "CANCEL") {
          if (l.sellerId !== s.id)
            throw new GameError(
              "NOT_OWNER",
              "Este anúncio pertence a outro clube.",
              403,
            );
          l.status = "CANCELLED";
        } else if (body.action === "OFFER") {
          if (l.sellerId === s.id)
            throw new GameError(
              "SELF_TRADE",
              "Escolha um anúncio de outro clube.",
            );
          if (
            BigInt(body.amount) >
            BigInt(s.runtime.balance) - BigInt(s.reservedCoins ?? "0")
          )
            throw new GameError(
              "INSUFFICIENT_COINS",
              "Coins insuficientes para esta oferta.",
            );
          if (
            l.offers.filter(
              (o) =>
                o.buyerId === s.id && o.status === "OPEN" && o.expiresAt > now,
            ).length >= 1
          )
            throw new GameError(
              "OFFER_EXISTS",
              "Você já possui uma oferta ativa neste anúncio.",
            );
          l.offers.push({
            id: randomUUID(),
            buyerId: s.id,
            buyerName: s.name,
            amount: body.amount,
            expiresAt: now + 86400000,
            status: "OPEN",
          });
          const created = l.offers.at(-1)!;
          await tx.query(
            "INSERT INTO coin_holds(offer_id,listing_id,club_id,amount,expires_at) VALUES($1,$2,$3,$4,$5)",
            [
              created.id,
              l.id,
              s.id,
              created.amount,
              Math.min(created.expiresAt, l.expiresAt),
            ],
          );
        } else {
          if (body.action === "BUY" && l.sellerId === s.id)
            throw new GameError(
              "SELF_TRADE",
              "Não é possível comprar seu próprio atleta.",
            );
          if (body.action === "ACCEPT" && l.sellerId !== s.id)
            throw new GameError(
              "NOT_OWNER",
              "Somente o vendedor pode aceitar ofertas.",
              403,
            );
          const offer =
            body.action === "ACCEPT"
              ? l.offers.find(
                  (o) =>
                    o.id === body.offerId &&
                    o.status === "OPEN" &&
                    o.expiresAt > now,
                )
              : null;
          if (body.action === "ACCEPT" && !offer)
            throw new GameError(
              "OFFER_EXPIRED",
              "Oferta inválida ou expirada.",
            );
          const otherClubId =
            body.action === "BUY" ? l.sellerId : offer!.buyerId;
          const otherAccount = (
            await tx.query<{ account_id: string }>(
              "SELECT account_id FROM clubs WHERE id=$1",
              [otherClubId],
            )
          ).rows[0];
          const other = otherAccount
            ? await loadClub(tx, otherAccount.account_id, true, now)
            : null;
          if (!other || other.runtime.testClock?.used || other.runtime.brasfoot)
            throw new GameError(
              "TRADE_UNAVAILABLE",
              "O outro clube não pode negociar.",
            );
          const buyer = body.action === "BUY" ? s : other,
            seller = body.action === "BUY" ? other : s;
          const athlete = seller.athletes.find((x) => x.id === l.athlete.id);
          if (
            !athlete ||
            athlete.protected ||
            seller.runtime.lineup.includes(athlete.id) ||
            seller.current?.view.home.some((x) => x.id === athlete.id) ||
            gameplay(seller).training.some((x) => x.athleteId === athlete.id)
          )
            throw new GameError("ATHLETE_BUSY", "O atleta está indisponível.");
          const total = BigInt(offer?.amount ?? l.price),
            fee = (total * 15n + 99n) / 100n;
          const released = (
            await tx.query<{ amount: string }>(
              "SELECT coalesce(sum(amount),0)::text amount FROM coin_holds WHERE listing_id=$1 AND club_id=$2 AND active AND expires_at>$3",
              [l.id, buyer.id, now],
            )
          ).rows[0].amount;
          buyer.reservedCoins = String(
            BigInt(buyer.reservedCoins ?? "0") - BigInt(released),
          );
          await tx.query(
            "UPDATE coin_holds SET active=false WHERE listing_id=$1 AND club_id=$2",
            [l.id, buyer.id],
          );
          coins(buyer, -total, "P2P_PURCHASE", repo.gameTime(buyer));
          coins(
            seller,
            total - fee,
            "P2P_SALE_NET_15_PERCENT",
            repo.gameTime(seller),
          );
          await tx.query(
            "INSERT INTO market_transfers(listing_id,athlete_id,seller_id,buyer_id,total,commission,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              l.id,
              athlete.id,
              seller.id,
              buyer.id,
              String(total),
              String(fee),
              now,
            ],
          );
          seller.athletes = seller.athletes.filter((x) => x.id !== athlete.id);
          buyer.athletes.push(athlete);
          await tx.query("UPDATE athletes SET club_id=$2 WHERE id=$1", [
            athlete.id,
            buyer.id,
          ]);
          await saveClub(tx, other, [], repo.gameTime(other));
          l.status = "SOLD";
          l.offers.forEach(
            (o) => (o.status = o.id === offer?.id ? "ACCEPTED" : "REJECTED"),
          );
        }
        await tx.query(
          "UPDATE market_listings SET status=$2,body=$3 WHERE id=$1",
          [l.id, l.status, JSON.stringify(l)],
        );
        if (l.status !== "OPEN")
          await tx.query(
            "UPDATE coin_holds SET active=false WHERE listing_id=$1",
            [l.id],
          );
        return {
          message:
            body.action === "BUY" || body.action === "ACCEPT"
              ? "Transferência concluída. Comissão de 15% registrada."
              : "Mercado atualizado.",
        };
      },
    );
    return respond(request, reply, result);
  });
}
