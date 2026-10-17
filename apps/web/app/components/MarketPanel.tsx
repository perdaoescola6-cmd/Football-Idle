"use client";
import { useState } from "react";
import type { GameView, Athlete } from "../../../../packages/contracts/index";
import {
  npcPrice,
  naturalOvr,
  unavailableReason,
} from "../../../../packages/contracts/roster";
import { SceneBanner } from "./PixelArt";
import { AthleteCard, AthleteDialog } from "./Roster";
import { Modal, type SendAction } from "./CollectionPanel";
export function MarketPanel({
  game: g,
  disabled,
  send,
}: {
  game: GameView;
  disabled: boolean;
  send: SendAction;
}) {
  const [tab, setTab] = useState("NPC"),
    [search, setSearch] = useState(""),
    [rarity, setRarity] = useState(""),
    [sort, setSort] = useState("price"),
    [page, setPage] = useState(0),
    [chosen, setChosen] = useState(""),
    [price, setPrice] = useState("100"),
    [days, setDays] = useState(7),
    [offer, setOffer] = useState("50"),
    [sale, setSale] = useState<Athlete | null>(null),
    [detail, setDetail] = useState<Athlete | null>(null);
  const context = {
      lineup: g.lineup.athleteIds,
      training: g.gameplay.training.map((t) => t.athleteId),
      locked: g.market
        .filter((l) => l.sellerId === g.club.id)
        .map((l) => l.athlete.id),
      active: g.currentMatch?.home.map((a) => a.id) ?? [],
    },
    free = g.athletes.filter((a) => !unavailableReason(a, context)),
    selected = free.find((a) => a.id === chosen) ?? free[0];
  const active = g.market.filter((l) => l.expiresAt > Date.now()),
    matches = active
      .filter(
        (l) =>
          (tab !== "MEUS" || l.sellerId === g.club.id) &&
          (!search ||
            l.athlete.displayName
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (!rarity || l.athlete.rarity === rarity),
      )
      .sort((a, b) =>
        sort === "potential"
          ? naturalOvr(b.athlete) - naturalOvr(a.athlete)
          : BigInt(a.price) < BigInt(b.price)
            ? -1
            : BigInt(a.price) > BigInt(b.price)
              ? 1
              : 0,
      ),
    pages = Math.max(1, Math.ceil(matches.length / 12)),
    items = matches.slice(
      Math.min(page, pages - 1) * 12,
      (Math.min(page, pages - 1) + 1) * 12,
    );
  const all = [...g.market, ...(g.marketRecords ?? [])],
    offers = all.flatMap((l) =>
      l.offers
        .filter((o) => o.buyerId === g.club.id || l.sellerId === g.club.id)
        .map((o) => ({ l, o })),
    );
  const submit = (body: Record<string, unknown>) =>
    void send("/market/command", body);
  return (
    <>
      <SceneBanner
        scene="market"
        title="Central de transferências"
        subtitle="Preço livre entre clubes. Cada negociação fortalece uma história."
      />
      <section className="panel">
        <div className="market-navigation">
          {[
            ["NPC", "Augusto · NPC"],
            ["P2P", "Atletas à venda"],
            ["MEUS", "Meus anúncios"],
            ["OFERTAS", "Ofertas"],
            ["HISTORICO", "Transferências"],
          ].map(([id, label]) => (
            <button
              className={tab === id ? "" : "secondary"}
              key={id}
              onClick={() => {
                setTab(id);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="training-facts">
          <span>
            <b>{g.wallet.balance} Coins</b>saldo total
          </span>
          <span>
            <b>{g.wallet.reserved ?? "0"} Coins</b>reservados em ofertas
          </span>
          <span>
            <b>{g.wallet.available ?? g.wallet.balance} Coins</b>disponíveis
            para gastar
          </span>
        </div>
        {tab === "NPC" ? (
          <div className="hub-grid">
            <article>
              <p className="eyebrow">EMPRESÁRIO AUGUSTO</p>
              <h2>Um destino para seus reservas</h2>
              <p className="muted">
                Valor fixado no nascimento. Treinar ou subir OVR não aumenta a
                oferta do empresário.
              </p>
              <label>
                Reserva disponível
                <select
                  value={selected?.id ?? ""}
                  onChange={(e) => setChosen(e.target.value)}
                >
                  <option disabled value="">
                    Nenhum reserva livre
                  </option>
                  {free.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName} · {a.rarity} · {npcPrice(a)} Coins
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <div className="sale-preview">
                  <AthleteCard
                    athlete={selected}
                    onClick={() => setDetail(selected)}
                  />
                  <div>
                    <span className="eyebrow">OFERTA FIXA</span>
                    <h2>{npcPrice(selected)} Coins</h2>
                    <button
                      disabled={disabled}
                      onClick={() => setSale(selected)}
                    >
                      Revisar venda de atleta
                    </button>
                  </div>
                </div>
              ) : (
                <p className="empty-state">
                  Não há reservas livres para negociar. Use a Coleção ou o
                  Depósito para revisar a proteção e o uso dos atletas.
                </p>
              )}
            </article>
            <article>
              <p className="eyebrow">SUPRIMENTO COMUM</p>
              <div className="supply-crate" />
              <h3>{g.inventory.commonSupply} unidades em estoque</h3>
              <p className="muted">
                Augusto paga 3 Coins por unidade. Nenhum material é vendido
                automaticamente.
              </p>
              <button
                disabled={disabled || BigInt(g.inventory.commonSupply) < 1n}
                onClick={() =>
                  void send("/club/command", {
                    action: "SUPPLY_SELL",
                    quantity: 1,
                  })
                }
              >
                Vender 1 · 3 Coins
              </button>
              <p className="small muted">
                Para vender muitos atletas de uma vez, use a seleção e a prévia
                da Coleção ou do Depósito.
              </p>
            </article>
          </div>
        ) : null}
        {tab === "P2P" || tab === "MEUS" ? (
          <>
            <p className="muted">
              Comissão de 15%. Anúncios de 1/7/30 dias. Ofertas de 24h reservam
              Coins até serem retiradas, expirarem ou o anúncio encerrar.
            </p>
            {g.testMode.used ? (
              <p className="message">
                Clubes que usaram God mode não negociam no P2P. O empresário NPC
                permanece disponível.
              </p>
            ) : (
              <div className="hub-controls">
                <label>
                  Atleta com selo P2P
                  <select
                    value={selected?.id ?? ""}
                    onChange={(e) => setChosen(e.target.value)}
                  >
                    <option value="" disabled>
                      Selecione um reserva
                    </option>
                    {free.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName}
                        {a.tradeEligible ? " · ◆ selo" : " · sem selo"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Preço livre
                  <input
                    value={price}
                    inputMode="numeric"
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
                <label>
                  Duração
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    {[1, 7, 30].map((d) => (
                      <option key={d} value={d}>
                        {d} dias
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={
                    disabled ||
                    !selected?.tradeEligible ||
                    !/^[1-9]\d*$/.test(price)
                  }
                  onClick={() =>
                    submit({
                      action: "LIST",
                      athleteId: selected?.id,
                      price,
                      days,
                    })
                  }
                >
                  Anunciar atleta
                </button>
                <p className="small muted">
                  Líquido:{" "}
                  {/^[1-9]\d*$/.test(price)
                    ? String(BigInt(price) - (BigInt(price) * 15n + 99n) / 100n)
                    : "—"}{" "}
                  Coins
                </p>
              </div>
            )}
            <div className="roster-filters">
              <label>
                Buscar anúncio
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                Potencial P
                <select
                  value={rarity}
                  onChange={(e) => {
                    setRarity(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Todos</option>
                  {["P1", "P2", "P3", "P4", "P5"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Ordenar
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="price">Menor preço</option>
                  <option value="potential">Maior teto natural</option>
                </select>
              </label>
            </div>
            <div className="market-grid">
              {items.map((l) => (
                <article className="market-listing" key={l.id}>
                  <AthleteCard
                    athlete={l.athlete}
                    onClick={() => setDetail(l.athlete)}
                  />
                  <h3>{l.price} Coins</h3>
                  <p className="small muted">
                    {l.sellerName} · até{" "}
                    {new Date(l.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                  {l.sellerId === g.club.id ? (
                    <>
                      <p className="small">
                        Líquido:{" "}
                        {String(
                          BigInt(l.price) -
                            (BigInt(l.price) * 15n + 99n) / 100n,
                        )}{" "}
                        Coins
                      </p>
                      <button
                        className="secondary"
                        disabled={disabled}
                        onClick={() =>
                          submit({ action: "CANCEL", listingId: l.id })
                        }
                      >
                        Retirar anúncio
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={
                          disabled ||
                          g.testMode.used ||
                          BigInt(g.wallet.available ?? g.wallet.balance) <
                            BigInt(l.price)
                        }
                        onClick={() =>
                          submit({ action: "BUY", listingId: l.id })
                        }
                      >
                        Comprar por {l.price} Coins
                      </button>
                      <label>
                        Oferta total
                        <input
                          value={offer}
                          onChange={(e) => setOffer(e.target.value)}
                          inputMode="numeric"
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={
                          disabled ||
                          g.testMode.used ||
                          !/^[1-9]\d*$/.test(offer) ||
                          BigInt(g.wallet.available ?? g.wallet.balance) <
                            BigInt(offer)
                        }
                        onClick={() =>
                          submit({
                            action: "OFFER",
                            listingId: l.id,
                            amount: offer,
                          })
                        }
                      >
                        Reservar Coins e ofertar
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
            {!items.length ? (
              <p className="empty-state">
                Nenhum anúncio neste filtro. O mercado reúne clubes reais desta
                instalação.
              </p>
            ) : null}
            <div className="pagination">
              <button
                className="secondary"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span>
                Página {Math.min(page + 1, pages)} / {pages}
              </span>
              <button
                className="secondary"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        ) : null}
        {tab === "OFERTAS" ? (
          <>
            <h2>Recebidas e enviadas</h2>
            {offers.length ? (
              offers.map(({ l, o }) => (
                <article className="offer-review" key={o.id}>
                  <div>
                    <b>
                      {l.athlete.displayName} · {o.amount} Coins
                    </b>
                    <p>
                      {o.buyerId === g.club.id
                        ? "Enviada para " + l.sellerName
                        : "Recebida de " + o.buyerName}
                    </p>
                    <small>
                      {l.status === "OPEN" &&
                      o.status === "OPEN" &&
                      Math.min(o.expiresAt, l.expiresAt) > Date.now()
                        ? "Ativa · Coins reservados"
                        : o.status === "ACCEPTED"
                          ? "Aceita"
                          : "Encerrada"}{" "}
                      · até{" "}
                      {new Date(
                        Math.min(o.expiresAt, l.expiresAt),
                      ).toLocaleString("pt-BR")}
                    </small>
                  </div>
                  {l.status === "OPEN" &&
                  o.status === "OPEN" &&
                  Math.min(o.expiresAt, l.expiresAt) > Date.now() ? (
                    <button
                      className="secondary"
                      disabled={disabled}
                      onClick={() =>
                        submit(
                          l.sellerId === g.club.id
                            ? {
                                action: "ACCEPT",
                                listingId: l.id,
                                offerId: o.id,
                              }
                            : {
                                action: "WITHDRAW",
                                listingId: l.id,
                                offerId: o.id,
                              },
                        )
                      }
                    >
                      {l.sellerId === g.club.id
                        ? "Aceitar e transferir"
                        : "Retirar oferta e liberar Coins"}
                    </button>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="empty-state">Nenhuma oferta registrada.</p>
            )}
          </>
        ) : null}
        {tab === "HISTORICO" ? (
          <>
            <h2>Histórico de transferências</h2>
            {g.marketHistory?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Atleta</th>
                      <th>Operação</th>
                      <th>Total</th>
                      <th>Comissão</th>
                      <th>Clube</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.marketHistory.map((t) => (
                      <tr key={t.listingId}>
                        <td>{t.athleteName}</td>
                        <td>{t.direction === "BUY" ? "Compra" : "Venda"}</td>
                        <td>{t.total}</td>
                        <td>{t.commission}</td>
                        <td>
                          {t.direction === "BUY" ? t.sellerName : t.buyerName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                Transferências concluídas aparecerão aqui com sua comissão.
              </p>
            )}
          </>
        ) : null}
      </section>
      {detail ? (
        <AthleteDialog
          athlete={detail}
          onClose={() => setDetail(null)}
          compare={g.athletes.filter((a) => g.lineup.athleteIds.includes(a.id))}
        />
      ) : null}
      {sale ? (
        <Modal
          title={`Venda de ${sale.displayName}`}
          onClose={() => setSale(null)}
        >
          <p>
            Oferta fixa: <strong>{npcPrice(sale)} Coins</strong>. O atleta sairá
            do clube.
          </p>
          {sale.rarity === "P4" ||
          sale.rarity === "P5" ||
          naturalOvr(sale) >=
            (g.gameplay.scouting?.rareWarningPotential ?? 85) ? (
            <p role="alert" className="message">
              Atenção: talento raro ou de alto potencial ({sale.rarity}, teto{" "}
              {naturalOvr(sale)}). Revise antes de confirmar.
            </p>
          ) : null}
          <button
            className="danger full"
            disabled={disabled}
            onClick={async () => {
              const result = await send("/club/command", {
                action: "NPC_SELL",
                athleteId: sale.id,
              });
              if (result) setSale(null);
            }}
          >
            Confirmar venda de {sale.displayName}
          </button>
        </Modal>
      ) : null}
    </>
  );
}
