"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, GameView } from "../../../../packages/contracts";
import {
  rarities,
  phenomenonChance,
  slotOdds,
  type OwnedCard,
  type Formation,
  type Tactic,
  type PackReceipt,
  type CardEdition,
} from "../../../../packages/contracts/brasfoot";
import { api } from "./api";
import "../football.css";
import "../football-v2.css";
import PlayerDetails, { PlayerPortrait } from "./PlayerDetails";
import FootballCatalogue from "./FootballCatalogue";
import FootballCommunity, { ClubSheet } from "./FootballCommunity";
import { PreMatch, MatchExperience, SeasonCalendar } from "./MatchExperience";
import { RoundCenter } from "./RoundCenter";
import { playingMinute } from "../../../../packages/contracts/match-management";
import { effectiveCard } from "../../../../packages/contracts/card-model";

import {
  FOCUS_PACK_VERSION,
  packFocuses,
  packFocusNames,
  type PackFocus,
} from "../../../../packages/contracts/pack-focus";
import { playerArchetype } from "../../../../packages/contracts/player-specialties";
const number = (n: number | string) => Number(n).toLocaleString("pt-BR");
export default function FootballApp() {
  const [boot, setBoot] = useState<Bootstrap | null>(null),
    [game, setGame] = useState<GameView | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [name, setName] = useState(""),
    [tab, setTab] = useState("Campeonato");
  const [search, setSearch] = useState(""),
    [rarity, setRarity] = useState(""),
    [position, setPosition] = useState(""),
    [storage, setStorage] = useState(""),
    [duplicates, setDuplicates] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [confirmSale, setConfirmSale] = useState(false);
  const [lineup, setLineup] = useState<string[]>([]),
    [bench, setBench] = useState<string[]>([]),
    [formation, setFormation] = useState<Formation>("4-4-2"),
    [tactic, setTactic] = useState<Tactic>("BALANCED"),
    [dirty, setDirty] = useState(false);
  const [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [revealed, setRevealed] = useState(0),
    [clock, setClock] = useState(Date.now()),
    [replay, setReplay] = useState(0),
    [receivedAt, setReceivedAt] = useState(Date.now());
  const [packFocus, setPackFocus] = useState<PackFocus>("GENERAL");
  const f = game?.brasfoot;
  const focusGaps =
    packFocus === "GENERAL"
      ? []
      : rarities.filter(
          (r) =>
            f &&
            !f.catalog.some((c) => c.rarity === r && c.position === packFocus),
        );
  const [sheet, setSheet] = useState<{
      card: CardEdition;
      ownedId?: string;
    } | null>(null),
    [clubSheet, setClubSheet] = useState<string | null>(null);
  const catalogRequest = useRef<Promise<CardEdition[]> | null>(null);
  const requestSequence = useRef(0);
  const [collectionLimit, setCollectionLimit] = useState(60);
  const definitions = useMemo(
    () => new Map(f?.catalog.map((c) => [c.id, c])),
    [f?.catalog],
  );
  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of f?.cards ?? [])
      counts.set(card.editionId, (counts.get(card.editionId) ?? 0) + 1);
    return counts;
  }, [f?.cards]);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    catalogRequest.current ??= api<{ catalog: CardEdition[] }>(
      "/brasfoot/catalog",
    )
      .then((r) => r.catalog)
      .catch((error) => {
        catalogRequest.current = null;
        throw error;
      });
    const [b, catalog] = await Promise.all([
      api<Bootstrap>("/bootstrap"),
      catalogRequest.current,
    ]);
    if (b.game?.brasfoot) b.game.brasfoot.catalog = catalog;
    if (sequence !== requestSequence.current) return;
    setBoot(b);
    setGame(b.game);
    setReceivedAt(Date.now());
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setMessage(e.message));
    const timer = setInterval(
      () => void refresh().catch((e) => setMessage(e.message)),
      f?.match ? 1000 : 3000,
    );
    return () => clearInterval(timer);
  }, [refresh, Boolean(f?.match)]);
  useEffect(() => {
    if (!f?.match || f.match.pausedAt !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [Boolean(f?.match), f?.match?.pausedAt]);
  useEffect(() => {
    if (f && !dirty) {
      setLineup(f.lineup);
      setBench(f.bench);
      setFormation(f.formation);
      setTactic(f.tactic);
    }
  }, [f, dirty]);
  async function perform(run: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await run();
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }
  async function command(body: unknown) {
    const r = await api<{ message: string; receipt?: PackReceipt }>(
      "/brasfoot/command",
      "POST",
      body,
    );
    setMessage(r.message);
    if (r.receipt) {
      setReceipt(r.receipt);
      setRevealed(0);
    }
    return r;
  }
  const def = (card: OwnedCard) => definitions.get(card.editionId)!;
  const openPlayer = (card: CardEdition, owned?: OwnedCard) =>
    setSheet({ card, ownedId: owned?.id });
  function ledgerLabel(reason?: string) {
    if (reason?.startsWith("PACK:")) {
      const parts = reason.split(":");
      return `Pack ${game?.brasfoot?.packs.find((p) => p.id === parts[2])?.name ?? parts[2]}${parts[3] ? ` · ${packFocusNames[parts[3] as PackFocus] ?? parts[3]}` : ""}`;
    }
    if (reason?.startsWith("BR_OFFICIAL_MATCH"))
      return "Recompensa de partida oficial";
    if (reason?.startsWith("BR_P2P_BUY")) return "Compra no mercado";
    if (reason?.startsWith("BR_P2P_SALE"))
      return "Venda no mercado · líquido após 15%";
    if (reason?.startsWith("BR_SEASON_PRIZE")) return "Premiação da temporada";
    if (reason === "BR_CARD_TRAINING") return "Treino de atleta";
    if (reason === "BR_NPC_BATCH_SALE") return "Venda de cartas ao NPC";
    if (reason === "BR_ONBOARDING_ONCE") return "Boas-vindas do clube";
    return "Histórico de Coins";
  }
  async function marketCommand(body: unknown) {
    setBusy(true);
    try {
      const result = await api<{ message: string }>(
        "/brasfoot/market",
        "POST",
        body,
      );
      setMessage(result.message);
      await refresh();
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no mercado.");
      throw error;
    } finally {
      setBusy(false);
    }
  }
  const title = () => (
    <>
      <p className="eyebrow">FUTIDLE / CLUBE PERMANENTE</p>
      <h1>Seu clube. Seu futebol.</h1>
      <p>Onze em campo. Uma temporada de cada vez.</p>
    </>
  );
  if (!boot)
    return (
      <main className="football">
        <p role="status">{message || "Carregando seu clube…"}</p>
        <button onClick={() => void refresh()}>Tentar novamente</button>
      </main>
    );
  if (!boot.account || !game)
    return (
      <main className="football">
        <section className="fb-welcome">
          {title()}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                if (!boot.account) await api("/auth/guest", "POST", {});
                await api("/clubs", "POST", { name });
                await command({ action: "INIT" });
              });
            }}
          >
            <label>
              Nome do clube
              <input
                required
                minLength={3}
                maxLength={32}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="União da Vila"
              />
            </label>
            <button disabled={busy}>Criar meu clube</button>
          </form>
          <p role="status">{message}</p>
          <small>Desenvolvimento local · sessão salva neste navegador</small>
        </section>
      </main>
    );
  if (!f)
    return (
      <main className="football">
        <section className="fb-welcome">
          {title()}
          <h2>{game.club.name}</h2>
          <p>
            Seu saldo e histórico serão preservados. O modo 11v11 inicia uma
            nova coleção, com onze titulares e um pack de boas-vindas.
          </p>
          <button
            disabled={busy}
            onClick={() => void perform(() => command({ action: "INIT" }))}
          >
            Ativar futebol 11v11
          </button>
          <p role="status">{message}</p>
          {game.currentMatch && (
            <p>
              A partida anterior será concluída antes da ativação. Restam{" "}
              {Math.max(
                0,
                Math.ceil((game.currentMatch.endAt - game.serverTime) / 1000),
              )}{" "}
              segundos simulados.
            </p>
          )}
        </section>
      </main>
    );
  const season = f.season,
    own = season.table.find((t) => t.id === game.club.id)!,
    next = season.fixtures.find(
      (m) =>
        m.round === season.round &&
        (m.home === game.club.id || m.away === game.club.id),
    );
  const opponent = next
    ? season.table.find(
        (t) => t.id === (next.home === game.club.id ? next.away : next.home),
      )
    : null;
  const now = f.serverTime + Math.max(0, clock - receivedAt); // presentation only; server controls elapsed events and settlement
  const live = f.match,
    match = live ?? f.history[replay] ?? null;
  const minute = live ? Math.floor(playingMinute(live, now)) : 90;
  const events = match?.events.filter((e) => e.minute <= minute) ?? [],
    last = events.at(-1);
  const score = match?.score ?? [
    events.filter((e) => e.type === "GOAL" && e.side === "HOME").length,
    events.filter((e) => e.type === "GOAL" && e.side === "AWAY").length,
  ];
  const visible = f.cards.filter((c) => {
    const d = def(c);
    return (
      d.player.toLowerCase().includes(search.toLowerCase()) &&
      (!rarity || d.rarity === rarity) &&
      (!position || d.position === position) &&
      (!storage || c.storage === storage) &&
      (!duplicates || (duplicateCounts.get(c.editionId) ?? 0) > 1)
    );
  });
  const prices = [200, 500, 1500, 6000, 20000],
    saleTotal = selected.reduce((sum, id) => {
      const c = f.cards.find((c) => c.id === id);
      return sum + (c ? prices[rarities.indexOf(def(c).rarity)] : 0);
    }, 0);
  const shape =
    formation === "4-2-3-1" ? [4, 5, 1] : formation.split("-").map(Number);
  const expected = [
    "GOL",
    ...Array(shape[0]).fill("DEF"),
    ...Array(shape[1]).fill("MEI"),
    ...Array(shape[2]).fill("ATA"),
  ];
  function renderCard(card: OwnedCard, index?: number) {
    const d = effectiveCard(def(card), card),
      starter = f!.lineup.includes(card.id),
      reserve = f!.bench.includes(card.id);
    return (
      <article
        key={card.id}
        className={`fb-card rarity-${rarities.indexOf(d.rarity)}`}
      >
        <div className="fb-card-top">
          <strong>{d.rating}</strong>
          <span>{d.role ?? d.position}</span>
          <span>{d.rarity}</span>
        </div>
        <PlayerPortrait card={d} />
        <button
          className="v2-name-link v2-card-name"
          onClick={() => openPlayer(def(card), card)}
        >
          {d.player}
        </button>
        <small>
          {d.profile?.flag} {d.profile?.club ?? "Referência Brasil 2024"}
        </small>
        <small>{d.edition}</small>
        <p className="archetype-chip">{playerArchetype(d).label}</p>
        <p>
          {starter ? "Titular" : reserve ? "Banco" : "Reserva"} ·{" "}
          {card.storage === "DEPOT" ? "Depósito" : "Coleção"}
          {(duplicateCounts.get(card.editionId) ?? 0) > 1 ? " · Duplicata" : ""}
        </p>
        {index === undefined && (
          <div className="fb-card-actions">
            <button
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  command({
                    action: "LOCK",
                    id: card.id,
                    locked: !card.locked,
                  }),
                )
              }
            >
              {card.locked ? "Desbloquear" : "Proteger"}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  command({
                    action: "MOVE",
                    id: card.id,
                    storage: card.storage === "DEPOT" ? "COLLECTION" : "DEPOT",
                  }),
                )
              }
            >
              {card.storage === "DEPOT"
                ? "Trazer à coleção"
                : "Mover ao depósito"}
            </button>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(card.id)}
                disabled={
                  starter ||
                  reserve ||
                  card.locked ||
                  busy ||
                  f?.listed?.includes(card.id)
                }
                onChange={(e) => {
                  setConfirmSale(false);
                  setSelected(
                    e.target.checked
                      ? [...selected, card.id]
                      : selected.filter((id) => id !== card.id),
                  );
                }}
              />{" "}
              Vender · {number(prices[rarities.indexOf(d.rarity)])}
            </label>
          </div>
        )}
      </article>
    );
  }
  return (
    <main className="football">
      <header className="fb-header">
        <div>
          <p className="eyebrow">FUTIDLE / FOOTBALL CARD MANAGER</p>
          <h1>{game.club.name}</h1>
          <p>
            Brasileirão Série {["D", "C", "B", "A"][season.division]} ·
            Temporada {season.number}
          </p>
        </div>
        <div className="fb-wallet">
          <small>COINS DO CLUBE</small>
          <strong>
            {number(game.wallet.available ?? game.wallet.balance)}
          </strong>
          <span>Nível {game.club.level} · progresso permanente</span>
        </div>
      </header>
      <nav className="fb-nav" aria-label="Seções do clube">
        {[
          "Campeonato",
          "Elenco",
          "Packs",
          "Coleção",
          "Catálogo",
          "Rankings",
          ...(f.listed?.length ? ["Mercado"] : []),
          "Histórico",
        ].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => {
              setTab(t);
              setConfirmSale(false);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="fb-status" role="status" aria-live="polite">
        {busy
          ? "Salvando no clube…"
          : message || "Tudo pronto para a próxima rodada."}
      </div>
      {!f.welcomeClaimed && (
        <aside className="fb-banner">
          <div>
            <strong>Seu primeiro reforço chegou.</strong>
            <p>Pack de boas-vindas: cinco cartas, ao menos uma Prata.</p>
          </div>
          <button
            disabled={busy}
            onClick={() => void perform(() => command({ action: "WELCOME" }))}
          >
            Abrir boas-vindas
          </button>
        </aside>
      )}
      {receipt && (
        <section className="fb-reveal" aria-label="Revelação de pack">
          <h2>Cinco novas histórias no clube</h2>
          <p>
            Foco: {packFocusNames[receipt.focus ?? "GENERAL"]}.{" "}
            {receipt.fallbackSlots?.length
              ? `Catálogo geral usado nos slots ${receipt.fallbackSlots.map((x) => x + 1).join(", ")} por ausência de carta do setor na raridade sorteada.`
              : ""}
          </p>
          <p>
            As cinco cartas já foram salvas. Revele cada uma para conhecer seus
            reforços.
          </p>
          <div className="fb-cards">
            {receipt.cardIds.map((id, i) => {
              const c = f.cards.find((c) => c.id === id);
              return i < revealed && c ? (
                renderCard(c, i)
              ) : (
                <button
                  className="fb-card fb-back"
                  key={id}
                  onClick={() => setRevealed(Math.max(revealed, i + 1))}
                >
                  FUTIDLE
                  <br />
                  Revelar carta {i + 1}
                </button>
              );
            })}
          </div>
          <div className="fb-actions">
            <button onClick={() => setRevealed(5)}>Revelar todas</button>
            <button onClick={() => setReceipt(null)}>Fechar revelação</button>
          </div>
        </section>
      )}
      {tab === "Campeonato" && (
        <>
          <div className="fb-grid">
            <section className="fb-panel" id="round-controls">
              <p className="eyebrow">CALENDÁRIO OFICIAL DO JOGO</p>
              <h2>
                {live
                  ? "Bola rolando"
                  : season.round <= 14
                    ? `Rodada ${season.round} de 14`
                    : "Temporada concluída"}
              </h2>
              {opponent && (
                <p className="fb-versus">
                  {game.club.name} × {opponent.name}{" "}
                  <small>
                    AI · {next?.home === game.club.id ? "em casa" : "fora"}
                  </small>
                </p>
              )}
              <p>
                90 segundos de bola rolando · 11v11 · todos os jogos da rodada
                juntos
              </p>
              <button
                disabled={busy || Boolean(live)}
                onClick={() =>
                  void perform(() =>
                    command({
                      action: season.round > 14 ? "NEXT_SEASON" : "PLAY",
                    }),
                  )
                }
              >
                {live
                  ? "Partida em andamento"
                  : season.round > 14
                    ? "Iniciar próxima temporada"
                    : "Disputar rodada"}
              </button>
              <p>
                {own.points} pontos · {own.wins}V {own.draws}E {own.losses}D ·
                saldo {own.gf - own.ga}
              </p>
              <p>
                {season.table.findIndex((t) => t.id === game.club.id) + 1}º
                lugar · restam {14 - own.played} rodadas e até{" "}
                {(14 - own.played) * 3} pontos.{" "}
                {season.division < 3
                  ? season.table.findIndex((t) => t.id === game.club.id) < 2
                    ? "Você está na faixa de acesso."
                    : `Distância em pontos para o 2º: ${Math.max(0, season.table[1].points - own.points)}.`
                  : "Disputa pelo título da Série A."}
              </p>
            </section>
            <section className="fb-panel">
              <h2>Regulamento experimental</h2>
              <p>
                Base de clubes: 2024. Formato compacto: seu clube + 7 clubes AI,
                turno e returno. Os dois primeiros sobem; os dois últimos descem
                entre D, C, B e A. Série D é o piso.
              </p>
              <p>
                Desempate: pontos, vitórias, saldo, gols e identificador
                estável. As rodadas avançam ao concluir o jogo do seu clube.
              </p>
              <small>
                {season.rulesVersion} · formato próprio, adaptado dos
                campeonatos brasileiros
              </small>
            </section>
          </div>
          {!live && season.round <= 14 && (
            <PreMatch f={f} onPlayer={openPlayer} />
          )}
          <RoundCenter
            f={f}
            now={now}
            busy={busy}
            execute={(body) => perform(() => command(body))}
            onPlayer={openPlayer}
          />
          {!f.lastRound && !live && match ? (
            <MatchExperience
              match={match}
              live={false}
              minute={90}
              onPlayer={openPlayer}
            />
          ) : null}
          <SeasonCalendar f={f} onClub={setClubSheet} />
          <section className="fb-panel" id="championship-table">
            <h2 id="championship-heading">
              Classificação · Série {["D", "C", "B", "A"][season.division]}
            </h2>
            <p className="fb-table-hint" id="championship-scroll-hint">
              Deslize para ver todas as colunas. No teclado, selecione a tabela
              com Tab e use as setas para os lados.
            </p>
            <div
              className="fb-standings-scroll"
              role="region"
              aria-labelledby="championship-heading"
              aria-describedby="championship-scroll-hint"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    {[
                      ["#", "Posição"],
                      ["Clube", "Clube"],
                      ["P", "Pontos"],
                      ["J", "Jogos"],
                      ["V", "Vitórias"],
                      ["E", "Empates"],
                      ["D", "Derrotas"],
                      ["SG", "Saldo de gols"],
                    ].map(([label, description]) => (
                      <th
                        key={label}
                        scope="col"
                        aria-label={description}
                        title={description}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {season.table.map((t, i) => (
                    <tr
                      key={t.id}
                      className={t.id === game.club.id ? "fb-own" : ""}
                    >
                      <td>{i + 1}</td>
                      <td>
                        <button
                          className="v2-name-link"
                          onClick={() => setClubSheet(t.id)}
                        >
                          {t.name}
                        </button>
                        {t.ai ? " · AI" : " · Você"}
                      </td>
                      <td>
                        <strong>{t.points}</strong>
                      </td>
                      <td>{t.played}</td>
                      <td>{t.wins}</td>
                      <td>{t.draws}</td>
                      <td>{t.losses}</td>
                      <td>{t.gf - t.ga}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="fb-panel">
            <h2>Jogos do clube</h2>
            <div className="fb-fixtures">
              {season.fixtures
                .filter(
                  (m) => m.home === game.club.id || m.away === game.club.id,
                )
                .map((m) => (
                  <p key={m.id}>
                    R{m.round} ·{" "}
                    {season.table.find((t) => t.id === m.home)?.name}{" "}
                    <strong>{m.score ? m.score.join(" × ") : "×"}</strong>{" "}
                    {season.table.find((t) => t.id === m.away)?.name}
                  </p>
                ))}
            </div>
          </section>
        </>
      )}
      {tab === "Elenco" && (
        <section className="fb-panel">
          <h2>Escalação e tática</h2>
          <p>
            Escolha onze jogadores únicos nas posições da formação. Até sete
            cartas no banco. Alterações valem para a próxima partida.
          </p>
          <div className="fb-actions">
            <label>
              Formação
              <select
                value={formation}
                onChange={(e) => {
                  setDirty(true);
                  setFormation(e.target.value as Formation);
                }}
              >
                {["4-4-2", "4-3-3", "4-2-3-1", "3-5-2"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Tática
              <select
                value={tactic}
                onChange={(e) => {
                  setDirty(true);
                  setTactic(e.target.value as Tactic);
                }}
              >
                <option value="BALANCED">Equilibrada</option>
                <option value="ATTACK">Ofensiva</option>
                <option value="DEFEND">Defensiva</option>
              </select>
            </label>
          </div>
          <div className="fb-actions">
            <button
              disabled={busy || Boolean(live)}
              onClick={() =>
                void perform(async () => {
                  await command({ action: "AUTO_LINEUP", formation, tactic });
                  setDirty(false);
                })
              }
            >
              Sugerir e aplicar melhor escalação
            </button>
            <label>
              Capitão
              <select
                value={f.captain ?? ""}
                disabled={busy || Boolean(live)}
                onChange={(e) =>
                  void perform(() =>
                    command({ action: "CAPTAIN", id: e.target.value }),
                  )
                }
              >
                <option value="">Escolha um titular</option>
                {f.lineup.map((id) => {
                  const c = f.cards.find((c) => c.id === id)!;
                  return (
                    <option key={id} value={id}>
                      {def(c).player}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
          <p>
            O capitão concede um bônus de liderança de 1,5% na criação de
            chances. A sugestão usa OVR efetivo, posições e identidades únicas.
          </p>
          <div className="fb-lineup">
            {lineup.map((id, i) => (
              <label key={i}>
                Titular {i + 1} · {expected[i]}
                <select
                  value={id}
                  onChange={(e) => {
                    setDirty(true);
                    setLineup(
                      lineup.map((old, j) => (i === j ? e.target.value : old)),
                    );
                  }}
                >
                  {f.cards
                    .filter((c) => !f.listed?.includes(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {def(c).position} · {def(c).player} ·{" "}
                        {effectiveCard(def(c), c).rating} · {c.id.slice(0, 4)}
                      </option>
                    ))}
                </select>
                {f.cards.find((c) => c.id === id) &&
                  def(f.cards.find((c) => c.id === id)!).position !==
                    expected[i] && (
                    <small className="v2-position-warning">
                      Fora do grupo indicado: esperado {expected[i]}. Confira os
                      totais da formação.
                    </small>
                  )}
              </label>
            ))}
          </div>
          <small>
            A ordem é organizada por posição ao salvar. É necessário um goleiro,{" "}
            {shape[0]} defensores, {shape[1]} meias e {shape[2]} atacantes; o
            servidor também recusa identidades repetidas.
          </small>
          <h3>Banco ({bench.length}/7)</h3>
          <div className="fb-bench">
            {f.cards
              .filter((c) => !lineup.includes(c.id))
              .map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={bench.includes(c.id)}
                    disabled={!bench.includes(c.id) && bench.length >= 7}
                    onChange={(e) => {
                      setDirty(true);
                      setBench(
                        e.target.checked
                          ? [...bench, c.id]
                          : bench.filter((id) => id !== c.id),
                      );
                    }}
                  />
                  {def(c).player} · {def(c).position} · {c.id.slice(0, 4)}
                </label>
              ))}
          </div>
          <button
            disabled={busy || Boolean(live)}
            onClick={() =>
              void perform(async () => {
                await command({
                  action: "LINEUP",
                  ids: lineup,
                  bench,
                  formation,
                  tactic,
                });
                setDirty(false);
              })
            }
          >
            Salvar escalação
          </button>
        </section>
      )}
      {tab === "Packs" && (
        <>
          <section className="fb-panel">
            <h2>Reforce o seu clube</h2>
            <label className="pack-focus-picker">
              Setor dos reforços
              <select
                value={packFocus}
                onChange={(e) => setPackFocus(e.target.value as PackFocus)}
              >
                {packFocuses.map((focus) => (
                  <option key={focus} value={focus}>
                    {packFocusNames[focus]}
                  </option>
                ))}
              </select>
            </label>
            <p>
              O foco muda somente as cartas elegíveis dentro de cada raridade.
              Preço, cinco cartas, chances e pisos permanecem iguais. A seleção
              entre edições elegíveis é uniforme; duplicatas continuam
              possíveis.
            </p>
            {focusGaps.length ? (
              <p className="pack-focus-notice" role="note">
                Não há cartas de {packFocusNames[packFocus]} nas raridades:{" "}
                {focusGaps.join(", ")}. Nesses resultados, o slot usa o catálogo
                geral. Não há garantia de cinco cartas do setor.
              </p>
            ) : null}
            <p>
              Somente Coins conquistadas no jogo. Cada pack contém exatamente
              cinco cartas. Garantias são pisos mínimos; os outros slots podem
              trazer qualquer raridade.
            </p>
            <small>
              {packFocus === "GENERAL" ? f.packVersion : FOCUS_PACK_VERSION} ·
              probabilidades experimentais, versionadas em cada abertura
            </small>
          </section>
          <div className="fb-packs">
            {f.packs.map((p) => (
              <section className="fb-panel" key={p.id}>
                <h2>{p.name}</h2>
                <strong className="fb-price">{number(p.price)} Coins</strong>
                <p>
                  {p.floors
                    .filter((x) => x > 0)
                    .map((r, i) => (
                      <span key={i}>
                        1 {rarities[r]} ou superior
                        <br />
                      </span>
                    ))}
                </p>
                <button
                  disabled={
                    busy ||
                    BigInt(game.wallet.available ?? game.wallet.balance) <
                      BigInt(p.price)
                  }
                  onClick={() =>
                    void perform(() =>
                      command({
                        action: "PACK",
                        packId: p.id,
                        focus: packFocus,
                      }),
                    )
                  }
                >
                  Abrir {p.name} · {packFocusNames[packFocus]}
                </button>
                <details>
                  <summary>
                    Probabilidades, garantias e catálogo elegível
                  </summary>
                  <p>
                    {rarities
                      .map((r) => {
                        const n = f.catalog.filter(
                            (c) =>
                              c.rarity === r &&
                              (packFocus === "GENERAL" ||
                                c.position === packFocus),
                          ).length,
                          total = f.catalog.filter(
                            (c) => c.rarity === r,
                          ).length;
                        return `${r}: ${n ? `${n} edições do foco` : `${total} edições gerais (sem carta do setor)`}`;
                      })
                      .join(" · ")}
                  </p>
                  <p>
                    Por slot livre:{" "}
                    {p.weights
                      .map(
                        (w, i) =>
                          `${rarities[i]} ${(w / 100).toLocaleString("pt-BR")}%`,
                      )
                      .join(" · ")}
                  </p>
                  <p>
                    Soma exata: {p.weights.reduce((a, b) => a + b, 0) / 100}%.
                  </p>
                  <p>
                    Ao menos um Fenômeno no pack:{" "}
                    {(phenomenonChance(p) * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits: 4,
                    })}
                    %.
                  </p>
                  {p.floors.map((floor, slot) => (
                    <p key={slot}>
                      Slot {slot + 1} (
                      {floor ? `mín. ${rarities[floor]}` : "livre"}):{" "}
                      {slotOdds(p, slot)
                        .map((w, i) => `${rarities[i]} ${w / 100}%`)
                        .join(" / ")}
                    </p>
                  ))}
                </details>
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "Coleção" && (
        <>
          <section className="fb-panel">
            <h2>Coleção · {f.cards.length} cartas</h2>
            <div className="fb-filters">
              <label>
                Jogador
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome"
                />
              </label>
              <label>
                Raridade
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                >
                  <option value="">Todas</option>
                  {rarities.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Posição
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="">Todas</option>
                  {["GOL", "DEF", "MEI", "ATA"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Local
                <select
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="COLLECTION">Coleção</option>
                  <option value="DEPOT">Depósito</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={duplicates}
                  onChange={(e) => setDuplicates(e.target.checked)}
                />
                Só duplicatas
              </label>
            </div>
            <details>
              <summary>Olheiro organizador</summary>
              <p>
                Organiza novas cartas, sem gerar atletas ou vender
                automaticamente. Duplicatas vão ao depósito; Lendário/Fenômeno
                ficam protegidos.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={f.organizer.enabled}
                  disabled={busy}
                  onChange={(e) =>
                    void perform(() =>
                      command({
                        action: "ORGANIZER",
                        enabled: e.target.checked,
                        duplicateToDepot: true,
                        lockAt: 3,
                      }),
                    )
                  }
                />
                Organizar cartas recebidas
              </label>
            </details>
            <div className="fb-actions">
              <p>
                {selected.length} selecionadas · {number(saleTotal)} Coins
              </p>
              <button
                disabled={busy || !selected.length}
                onClick={() => setConfirmSale(true)}
              >
                Revisar venda em lote
              </button>
              <button
                onClick={() => {
                  setSelected([]);
                  setConfirmSale(false);
                }}
              >
                Limpar seleção
              </button>
            </div>
            {confirmSale && (
              <aside className="fb-sale">
                <h3>Confirmar venda para o NPC</h3>
                <p>
                  {selected.length} cartas por {number(saleTotal)} Coins. Cartas
                  vendidas saem da coleção. O servidor revalida proteção e
                  escalação para todo o lote.
                </p>
                <p>
                  {selected
                    .map((id) => f.cards.find((c) => c.id === id))
                    .filter(Boolean)
                    .map((c) => def(c!).player)
                    .join(", ")}
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await command({ action: "SELL", ids: selected });
                      setSelected([]);
                      setConfirmSale(false);
                    })
                  }
                >
                  Confirmar venda por {number(saleTotal)} Coins
                </button>
                <button onClick={() => setConfirmSale(false)}>Cancelar</button>
              </aside>
            )}
          </section>
          <div className="fb-cards">
            {visible.slice(0, collectionLimit).map((c) => renderCard(c))}
          </div>
          {visible.length > collectionLimit && (
            <button onClick={() => setCollectionLimit(collectionLimit + 60)}>
              Mostrar mais cartas ({visible.length - collectionLimit})
            </button>
          )}
          {!visible.length && <p>Nenhuma carta corresponde aos filtros.</p>}
        </>
      )}
      {tab === "Histórico" && (
        <>
          <section className="fb-panel">
            <h2>Resultados e temporadas</h2>
            {f.history.map((m, i) => (
              <p key={m.id}>
                {m.homeName} {m.score?.join(" × ")} {m.awayName} · +
                {number(m.reward ?? 0)} Coins{" "}
                <button
                  onClick={() => {
                    setReplay(i);
                    setTab("Campeonato");
                  }}
                >
                  Ver eventos
                </button>
              </p>
            ))}
            {f.seasons.map((s) => (
              <p key={s.number}>
                Temporada {s.number} · Série {["D", "C", "B", "A"][s.division]}{" "}
                · {s.position}º → Série {["D", "C", "B", "A"][s.nextDivision]}
              </p>
            ))}
          </section>
          <section className="fb-panel">
            <h2>Extrato de Coins</h2>
            {game.ledger.map((e) => (
              <p key={e.id}>
                #{e.version} · {ledgerLabel(e.reason)} · {number(e.delta)} ·
                saldo {number(e.balanceAfter)}
              </p>
            ))}
          </section>
          <section className="fb-panel">
            <h2>Aberturas auditadas</h2>
            {f.receipts
              .slice(-20)
              .reverse()
              .map((r) => (
                <details key={r.id}>
                  <summary>
                    {f.packs.find((p) => p.id === r.packId)?.name} ·{" "}
                    {number(r.price)} Coins · {r.version}
                  </summary>
                  <p>Recibo {r.id}</p>
                  <p>
                    {r.editionIds
                      .map((id) => f.catalog.find((c) => c.id === id)?.player)
                      .join(" · ")}
                  </p>
                  <p>
                    Pesos: {r.weights.join("/")} em 10.000 · pisos:{" "}
                    {r.floors.join("/")} · rolls: {r.rolls.join("/")}
                  </p>
                </details>
              ))}
          </section>
        </>
      )}
      {tab === "Catálogo" && (
        <FootballCatalogue catalog={f.catalog} onPlayer={openPlayer} />
      )}
      {(tab === "Rankings" || tab === "Mercado") && (
        <FootballCommunity
          legacyOnly
          panel={tab}
          f={f}
          clubId={game.club.id}
          busy={busy}
          onPlayer={openPlayer}
          onClub={setClubSheet}
          onMarket={marketCommand}
        />
      )}
      {sheet && (
        <PlayerDetails
          card={definitions.get(sheet.card.id) ?? sheet.card}
          owned={
            sheet.ownedId
              ? f.cards.find((c) => c.id === sheet.ownedId)
              : undefined
          }
          f={f}
          busy={busy}
          balance={game.wallet.available ?? game.wallet.balance}
          onCommand={(body) => perform(() => command(body))}
          feedback={message}
          onClose={() => setSheet(null)}
        />
      )}
      {clubSheet && (
        <ClubSheet
          id={clubSheet}
          f={f}
          onClose={() => setClubSheet(null)}
          onPlayer={openPlayer}
        />
      )}
      <footer className="fb-footer">
        Protótipo local · catálogo histórico 2022/2024 · ratings de jogo
        experimentais · arte original sem fotos ou escudos licenciados ·
        direitos pendentes para publicação
      </footer>
    </main>
  );
}
