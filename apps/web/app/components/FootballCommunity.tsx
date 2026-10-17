"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import type {
  CardEdition,
  FootballView,
  OwnedCard,
} from "../../../../packages/contracts/brasfoot";
import { rarities } from "../../../../packages/contracts/brasfoot";
import type {
  CardListing,
  RankingView,
  ClubPublicView,
} from "../../../../packages/contracts/community";
import { PlayerPortrait } from "./PlayerDetails";
import { effectiveCard } from "../../../../packages/contracts/card-model";
export default function FootballCommunity({
  panel,
  f,
  clubId,
  busy,
  onPlayer,
  onClub,
  onMarket,
  legacyOnly = false,
}: {
  panel: "Rankings" | "Mercado";
  legacyOnly?: boolean;
  f: FootballView;
  clubId: string;
  busy: boolean;
  onPlayer: (c: CardEdition, owned?: OwnedCard) => void;
  onClub: (id: string) => void;
  onMarket: (body: unknown) => Promise<unknown>;
}) {
  const [data, setData] = useState<RankingView | null>(null),
    [listings, setListings] = useState<CardListing[]>([]),
    [scope, setScope] = useState("global"),
    [division, setDivision] = useState(String(f.season.division)),
    [metric, setMetric] = useState("goals"),
    [quality, setQuality] = useState(false),
    [qualitySort, setQualitySort] = useState("ovr"),
    [position, setPosition] = useState(""),
    [error, setError] = useState(""),
    [price, setPrice] = useState("5000"),
    [cardId, setCardId] = useState(""),
    [confirm, setConfirm] = useState<CardListing | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRevision((value) => value + 1), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    const request =
      panel === "Mercado"
        ? api<{ listings: CardListing[] }>("/brasfoot/market")
        : api<RankingView>(
            `/brasfoot/rankings?scope=${scope}&division=${division}`,
          );
    void request
      .then((result) => {
        if (!active) return;
        if ("listings" in result) setListings(result.listings);
        else setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [panel, scope, division, revision]);
  const execute = async (body: unknown) => {
    try {
      await onMarket(body);
      setRevision((v) => v + 1);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao negociar.");
    }
  };
  if (panel === "Mercado")
    return (
      <>
        <section className="fb-panel">
          <p className="eyebrow">MERCADO DE TRANSFERÊNCIAS</p>
          <h2>
            {legacyOnly
              ? "Encerrar negociações anteriores"
              : "Negocie com outros clubes"}
          </h2>
          {legacyOnly ? (
            <p>
              Os reforços agora vêm de packs em Coins. Esta tela permite apenas
              cancelar seus anúncios anteriores.
            </p>
          ) : (
            <p>
              Preços livres em Coins. Comissão de 15% na venda, arredondada para
              cima. Os anúncios são de contas reais desta instalação local.
              Nenhuma oferta de AI é apresentada como jogador humano.
            </p>
          )}
          {!legacyOnly && (
            <div className="fb-actions">
              <label>
                Carta disponível
                <select
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                >
                  <option value="">Selecione um reserva</option>
                  {f.cards
                    .filter(
                      (c) =>
                        !c.locked &&
                        !f.lineup.includes(c.id) &&
                        !f.bench.includes(c.id) &&
                        !f.listed?.includes(c.id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {f.catalog.find((e) => e.id === c.editionId)?.player} ·{" "}
                        {c.id.slice(0, 4)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Preço em Coins
                <input
                  value={price}
                  inputMode="numeric"
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !cardId || !/^[1-9]\d{0,11}$/.test(price)}
                onClick={() => void execute({ action: "LIST", cardId, price })}
              >
                Anunciar carta
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
        {confirm && (
          <section className="fb-panel v2-purchase-review">
            <h3>Confirmar compra</h3>
            <p>
              {f.catalog.find((c) => c.id === confirm.editionId)?.player} por{" "}
              {Number(confirm.price).toLocaleString("pt-BR")} Coins, de{" "}
              {confirm.sellerName}. A transferência será liquidada
              imediatamente.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void execute({ action: "BUY", listingId: confirm.id })
              }
            >
              Confirmar compra em Coins
            </button>
            <button onClick={() => setConfirm(null)}>Cancelar compra</button>
          </section>
        )}
        <div className="fb-cards">
          {listings
            .filter(
              (l) =>
                l.status === "OPEN" && (!legacyOnly || l.sellerId === clubId),
            )
            .map((l) => {
              const c = f.catalog.find((c) => c.id === l.editionId);
              if (!c) return null;
              return (
                <article
                  key={l.id}
                  className={`fb-card rarity-${rarities.indexOf(c.rarity)}`}
                >
                  <div className="fb-card-top">
                    <strong>{effectiveCard(c, l.card).rating}</strong>
                    <span>{c.rarity}</span>
                  </div>
                  <PlayerPortrait card={c} />
                  <button
                    className="v2-name-link"
                    onClick={() =>
                      onPlayer(
                        c,
                        l.sellerId === clubId
                          ? f.cards.find((x) => x.id === l.card.id)
                          : undefined,
                      )
                    }
                  >
                    {c.player}
                  </button>
                  <p>
                    De{" "}
                    <button
                      className="v2-name-link"
                      onClick={() => onClub(l.sellerId)}
                    >
                      {l.sellerName}
                    </button>
                  </p>
                  <strong>
                    {Number(l.price).toLocaleString("pt-BR")} Coins
                  </strong>
                  {l.sellerId === clubId ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void execute({ action: "CANCEL", listingId: l.id })
                      }
                    >
                      Retirar anúncio
                    </button>
                  ) : (
                    <button disabled={busy} onClick={() => setConfirm(l)}>
                      Comprar carta
                    </button>
                  )}
                </article>
              );
            })}
        </div>
        {!listings.some((l) => l.status === "OPEN") && (
          <section className="fb-panel">
            <p>
              Nenhum anúncio aberto nesta instalação. Anuncie um reserva ou
              aguarde outro clube publicar uma oferta.
            </p>
          </section>
        )}
        <section className="fb-panel">
          <h3>Suas negociações encerradas</h3>
          {listings
            .filter(
              (l) =>
                l.status !== "OPEN" &&
                (l.sellerId === clubId || l.buyerId === clubId),
            )
            .map((l) => (
              <p key={l.id}>
                {f.catalog.find((c) => c.id === l.editionId)?.player} ·{" "}
                {l.status === "SOLD" ? "Transferência concluída" : "Cancelado"}{" "}
                · {Number(l.price).toLocaleString("pt-BR")} Coins
              </p>
            ))}
        </section>
      </>
    );
  const players = (data?.players ?? [])
    .filter((p) => !position || p.role === position || p.position === position)
    .sort((a, b) => {
      const val = (p: typeof a) =>
        metric === "average"
          ? p.ratedMatches
            ? p.ratingTotal / p.ratedMatches
            : 0
          : p[metric as "goals" | "assists" | "appearances" | "cleanSheets"];
      return (
        val(b) - val(a) ||
        b.appearances - a.appearances ||
        a.playerId.localeCompare(b.playerId)
      );
    });
  return (
    <>
      <section className="fb-panel">
        <p className="eyebrow">FUTEBOL EM DISPUTA</p>
        <h2>Rankings da instalação</h2>
        <p>
          Somente clubes de usuários reais nesta base. Desempenho dos atletas
          computado pelos eventos do motor V2; edições de qualidade não
          equivalem a desempenho em campo.
        </p>
        <div className="fb-actions">
          <label>
            Ranking de clubes
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="global">Global · acumulado</option>
              <option value="division">Por divisão</option>
              <option value="season">Temporada atual de cada clube</option>
            </select>
          </label>
          {scope === "division" && (
            <label>
              Divisão
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                {["D", "C", "B", "A"].map((d, i) => (
                  <option key={d} value={i}>
                    Série {d}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="v2-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "#",
                  "Clube",
                  "Div.",
                  "Pontos",
                  "J",
                  "V/E/D",
                  "SG",
                  "Títulos",
                  "Acessos",
                  "Forma",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.clubs.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>
                    <button
                      className="v2-name-link"
                      onClick={() => onClub(c.id)}
                    >
                      {c.name}
                    </button>
                  </td>
                  <td>{["D", "C", "B", "A"][c.division]}</td>
                  <td>
                    {scope === "season" ? c.seasonPoints : c.career.points}
                  </td>
                  <td>
                    {scope === "season"
                      ? c.seasonRecord.played
                      : c.career.matches}
                  </td>
                  <td>
                    {scope === "season" ? c.seasonRecord.wins : c.career.wins}/
                    {scope === "season" ? c.seasonRecord.draws : c.career.draws}
                    /
                    {scope === "season"
                      ? c.seasonRecord.losses
                      : c.career.losses}
                  </td>
                  <td>
                    {scope === "season"
                      ? c.seasonRecord.gf - c.seasonRecord.ga
                      : c.career.gf - c.career.ga}
                  </td>
                  <td>{c.career.titles}</td>
                  <td>{c.career.promotions}</td>
                  <td>{c.career.form.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small>
          Acumulados esportivos disponíveis desde a temporada registrada pelo
          pivot. Consulte o perfil para o histórico.
        </small>
      </section>
      <section className="fb-panel">
        <h2>Jogadores</h2>
        <div className="fb-actions">
          <button aria-pressed={!quality} onClick={() => setQuality(false)}>
            Desempenho em partidas
          </button>
          <button aria-pressed={quality} onClick={() => setQuality(true)}>
            Qualidade das cartas
          </button>
          <label>
            Posição
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">Todas</option>
              {["GOL", "LAT", "ZAG", "VOL", "MEI", "PON", "ATA"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {!quality && (
            <label>
              Ordenar desempenho
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="goals">Gols</option>
                <option value="assists">Assistências</option>
                <option value="appearances">Partidas</option>
                <option value="cleanSheets">Goleiros sem sofrer gols</option>
                <option value="average">Média por eventos</option>
              </select>
            </label>
          )}
          {quality && (
            <label>
              Ordenar qualidade
              <select
                value={qualitySort}
                onChange={(e) => setQualitySort(e.target.value)}
              >
                <option value="ovr">Maior OVR base</option>
                <option value="rarity">Maior raridade</option>
              </select>
            </label>
          )}
        </div>
        <div className="v2-scroll">
          <table>
            <thead>
              <tr>
                {(quality
                  ? ["#", "Jogador", "Pos.", "OVR", "Raridade", "Edição"]
                  : ["#", "Jogador", "J", "G", "A", "Sem sofrer", "Média"]
                ).map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quality
                ? (data?.quality ?? [])
                    .filter(
                      (c) =>
                        !position ||
                        c.role === position ||
                        c.position === position,
                    )
                    .sort(
                      (a, b) =>
                        (qualitySort === "rarity"
                          ? rarities.indexOf(b.rarity) -
                            rarities.indexOf(a.rarity)
                          : b.rating - a.rating) ||
                        b.rating - a.rating ||
                        a.id.localeCompare(b.id),
                    )
                    .slice(0, 100)
                    .map((c, i) => (
                      <tr key={c.id}>
                        <td>{i + 1}</td>
                        <td>
                          <button
                            className="v2-name-link"
                            onClick={() => onPlayer(c)}
                          >
                            {c.player}
                          </button>
                        </td>
                        <td>{c.role ?? c.position}</td>
                        <td>{c.rating}</td>
                        <td>{c.rarity}</td>
                        <td>{c.edition}</td>
                      </tr>
                    ))
                : players
                    .filter(
                      (p) => metric !== "cleanSheets" || p.position === "GOL",
                    )
                    .slice(0, 100)
                    .map((p, i) => (
                      <tr key={p.playerId}>
                        <td>{i + 1}</td>
                        <td>
                          <button
                            className="v2-name-link"
                            onClick={() => {
                              const c = f.catalog.find(
                                (c) => c.id === p.editionId,
                              );
                              if (c) onPlayer(c);
                            }}
                          >
                            {p.name}
                          </button>
                        </td>
                        <td>{p.appearances}</td>
                        <td>{p.goals}</td>
                        <td>{p.assists}</td>
                        <td>{p.position === "GOL" ? p.cleanSheets : "—"}</td>
                        <td>
                          {p.ratedMatches
                            ? (p.ratingTotal / p.ratedMatches).toFixed(1)
                            : "—"}
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
        {!quality && !players.length && (
          <p>
            O ranking de desempenho será preenchido com as partidas do motor V2.
            Nenhuma estatística foi inventada.
          </p>
        )}
      </section>
    </>
  );
}
export function ClubSheet({
  id,
  f,
  onClose,
  onPlayer,
}: {
  id: string;
  f: FootballView;
  onClose: () => void;
  onPlayer: (c: CardEdition) => void;
}) {
  const [club, setClub] = useState<ClubPublicView | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (id.startsWith("AI-")) return;
    let active = true;
    void api<ClubPublicView>(`/brasfoot/clubs/${id}`)
      .then((c) => {
        if (active) setClub(c);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const ai = f.season.table.find((t) => t.id === id),
    aiMatches = f.season.fixtures.filter((m) => m.home === id || m.away === id);
  return (
    <div className="v2-shade">
      <section
        className="v2-player-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Perfil do clube"
      >
        <button className="v2-close" onClick={onClose}>
          Fechar perfil
        </button>
        {id.startsWith("AI-") ? (
          <>
            <p className="eyebrow">ADVERSÁRIO AI · NÃO É CONTA HUMANA</p>
            <h2>{ai?.name ?? "Clube AI"}</h2>
            <p>
              Referência histórica 2024 · Série{" "}
              {["D", "C", "B", "A"][f.season.division]}. Elenco de simulação
              escolhido do catálogo do jogo, sem representar escalação real
              atual.
            </p>
            <p>
              {ai?.points} pontos · {ai?.wins}V {ai?.draws}E {ai?.losses}D
            </p>
            {aiMatches.map((m) => (
              <p key={m.id}>
                Rodada {m.round} ·{" "}
                {f.season.table.find((t) => t.id === m.home)?.name}{" "}
                {m.score?.join(" × ") ?? "×"}{" "}
                {f.season.table.find((t) => t.id === m.away)?.name}
              </p>
            ))}
          </>
        ) : club ? (
          <>
            <h2>{club.name}</h2>
            <p>
              Série {["D", "C", "B", "A"][club.division]} · temporada{" "}
              {club.season}
            </p>
            <div className="v2-stat-strip">
              <span>
                <strong>{club.career.titles}</strong>títulos
              </span>
              <span>
                <strong>{club.career.promotions}</strong>acessos
              </span>
              <span>
                <strong>{club.career.wins}</strong>vitórias
              </span>
              <span>
                <strong>{club.career.matches}</strong>jogos
              </span>
            </div>
            <h3>Elenco público</h3>
            {club.roster.map(({ card, edition, starter }) => (
              <p key={card.id}>
                <button
                  className="v2-name-link"
                  onClick={() => {
                    onClose();
                    onPlayer(edition);
                  }}
                >
                  {edition.player}
                </button>{" "}
                · {edition.position} · {edition.rating} ·{" "}
                {starter ? "Titular" : "Reserva"}
              </p>
            ))}
            <h3>Resultados</h3>
            {club.results.map((m) => (
              <p key={m.id}>
                {m.homeName} {m.score?.join(" × ")} {m.awayName}
              </p>
            ))}
            <h3>Temporadas encerradas</h3>
            {club.seasons.map((s) => (
              <p key={s.number}>
                Temporada {s.number} · Série {["D", "C", "B", "A"][s.division]}{" "}
                · {s.position}º
              </p>
            ))}
          </>
        ) : (
          <p>{error || "Carregando perfil…"}</p>
        )}
      </section>
    </div>
  );
}
