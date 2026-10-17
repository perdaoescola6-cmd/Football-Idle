import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identity } from "./auth-routes.js";
import { key, respond } from "./http.js";
import { loadClub, saveClub, type GameRepository } from "./repository.js";
import { football, settleFootball } from "../../../packages/game/brasfoot.js";
import { coins } from "../../../packages/game/gameplay.js";
import { GameError, type State } from "../../../packages/game/engine.js";
import type { OwnedCard } from "../../../packages/contracts/brasfoot.js";
import type { CardListing } from "../../../packages/contracts/community.js";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("LIST"),
      cardId: z.string().uuid(),
      price: z.string().regex(/^[1-9]\d{0,11}$/),
    })
    .strict(),
  z.object({ action: z.literal("BUY"), listingId: z.string().uuid() }).strict(),
  z
    .object({ action: z.literal("CANCEL"), listingId: z.string().uuid() })
    .strict(),
]);
function available(s: State, id: string) {
  const f = football(s),
    card = f.cards.find((c) => c.id === id);
  if (!card)
    throw new GameError("CARD_NOT_OWNED", "Carta não pertence ao clube.");
  if (
    card.locked ||
    f.lineup.includes(id) ||
    f.bench.includes(id) ||
    f.match?.homeOwnedIds?.includes(id) ||
    f.match?.awayOwnedIds?.includes(id)
  )
    throw new GameError(
      "CARD_BUSY",
      "Titulares, banco e cartas protegidas não podem ser negociados.",
    );
  return card;
}
export function registerFootballMarket(
  app: FastifyInstance,
  repo: GameRepository,
) {
  app.get("/v1/brasfoot/market", async (request, reply) => {
    const auth = (await identity(repo, request))!;
    const result = await repo.db.query<{
      id: string;
      seller_id: string;
      seller_name: string;
      card: OwnedCard;
      edition_id: string;
      price: string;
      status: string;
      created_at: string;
      buyer_id: string;
    }>(
      "SELECT l.*,l.price::text,c.name seller_name FROM football_card_listings l JOIN clubs c ON c.id=l.seller_id WHERE l.status='OPEN' OR c.account_id=$1 OR l.buyer_id IN(SELECT id FROM clubs WHERE account_id=$1) ORDER BY l.created_at DESC LIMIT 100",
      [auth.accountId],
    );
    const listings: CardListing[] = result.rows.map((r) => ({
      id: r.id,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      card: r.card,
      editionId: r.edition_id,
      price: r.price,
      status: r.status,
      createdAt: Number(r.created_at),
      buyerId: r.buyer_id,
    }));
    return respond(request, reply, { listings, commissionPercent: 15 });
  });
  app.post("/v1/brasfoot/market", async (request, reply) => {
    const auth = (await identity(repo, request))!,
      body = schema.parse(request.body);
    const result = await repo.mutate(
      auth.accountId,
      "brasfoot.market",
      key(request),
      body,
      async (s, tx) => {
        const f = football(s),
          now = repo.clock();
        if (f.managementVersion && body.action !== "CANCEL")
          throw new GameError(
            "PACKS_MODE",
            "Esta campanha usa packs para contratar. Novas negociações foram desativadas.",
            409,
          );
        f.listed ??= [];
        let message = "Anúncio cancelado.",
          listingId = "";
        if (body.action === "LIST") {
          const card = available(s, body.cardId);
          if (f.listed.includes(card.id))
            throw new GameError(
              "CARD_LISTED",
              "A carta já está anunciada.",
              409,
            );
          listingId = randomUUID();
          await tx.query(
            "INSERT INTO football_card_listings(id,seller_id,card_id,edition_id,price,created_at,status,card) VALUES($1,$2,$3,$4,$5,$6,'OPEN',$7)",
            [
              listingId,
              s.id,
              card.id,
              card.editionId,
              body.price,
              now,
              JSON.stringify(card),
            ],
          );
          f.listed.push(card.id);
          message = "Carta anunciada. Comissão de 15% quando a venda ocorrer.";
        } else {
          const row = (
            await tx.query<{
              id: string;
              seller_id: string;
              card_id: string;
              price: string;
            }>(
              "SELECT id,seller_id,card_id,price::text FROM football_card_listings WHERE id=$1 AND status='OPEN' FOR UPDATE",
              [body.listingId],
            )
          ).rows[0];
          if (!row)
            throw new GameError(
              "LISTING_CLOSED",
              "Este anúncio já foi encerrado.",
              409,
            );
          listingId = row.id;
          if (body.action === "CANCEL") {
            if (row.seller_id !== s.id)
              throw new GameError(
                "NOT_OWNER",
                "Anúncio pertence a outro clube.",
                403,
              );
            f.listed = f.listed.filter((id) => id !== row.card_id);
            await tx.query(
              "UPDATE football_card_listings SET status='CANCELLED',closed_at=$2 WHERE id=$1",
              [row.id, now],
            );
          } else {
            if (row.seller_id === s.id)
              throw new GameError(
                "SELF_TRADE",
                "Não é possível comprar seu próprio anúncio.",
              );
            if (f.cards.length >= 5000)
              throw new GameError(
                "COLLECTION_FULL",
                "Libere espaço na coleção.",
              );
            const account = (
              await tx.query<{ account_id: string }>(
                "SELECT account_id FROM clubs WHERE id=$1",
                [row.seller_id],
              )
            ).rows[0];
            const seller = await loadClub(tx, account.account_id, true, now);
            if (!seller?.runtime.brasfoot)
              throw new GameError(
                "SELLER_UNAVAILABLE",
                "Clube vendedor indisponível.",
              );
            settleFootball(seller, now);
            const sf = football(seller),
              card = available(seller, row.card_id),
              price = BigInt(row.price),
              fee = (price * 15n + 99n) / 100n;
            if (sf.managementVersion)
              throw new GameError(
                "PACKS_MODE",
                "O vendedor usa o modo de packs.",
                409,
              );
            coins(s, -price, `BR_P2P_BUY:${row.id}`, now);
            coins(
              seller,
              price - fee,
              `BR_P2P_SALE_NET_15_PERCENT:${row.id}`,
              now,
            );
            sf.cards = sf.cards.filter((c) => c.id !== card.id);
            sf.listed = (sf.listed ?? []).filter((id) => id !== card.id);
            card.clubHistory ??= [
              {
                clubId: seller.id,
                name: seller.name,
                at: card.acquiredAt,
                kind: "ACQUIRED",
              },
            ];
            card.clubHistory.push({
              clubId: s.id,
              name: s.name,
              at: now,
              kind: "TRANSFER",
            });
            f.cards.push(card);
            await tx.query(
              "UPDATE football_card_listings SET status='SOLD',buyer_id=$2,closed_at=$3 WHERE id=$1",
              [row.id, s.id, now],
            );
            await tx.query(
              "INSERT INTO football_card_transfers(listing_id,card_id,seller_id,buyer_id,total,commission,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                row.id,
                card.id,
                seller.id,
                s.id,
                String(price),
                String(fee),
                now,
              ],
            );
            await saveClub(tx, seller, [], now);
            message = `Transferência concluída por ${row.price} Coins. Comissão de ${fee} Coins registrada.`;
          }
        }
        await tx.query(
          "INSERT INTO football_audit(id,club_id,created_at,action,payload) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            s.id,
            now,
            `MARKET_${body.action}`,
            JSON.stringify({ request: body, listingId }),
          ],
        );
        return { message, listingId };
      },
    );
    return respond(request, reply, result);
  });
}
