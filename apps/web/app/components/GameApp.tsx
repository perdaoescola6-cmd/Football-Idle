"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  Bootstrap,
  GameView,
  PresenceReply,
  Region,
  Athlete,
} from "../../../../packages/contracts/index";
import { api, ApiError } from "./api";
import { AthleteDialog } from "./Roster";
import { CollectionPanel } from "./CollectionPanel";
import { ScoutingPanel } from "./ScoutingPanel";
import { TrainingPanel } from "./TrainingPanel";
import { MarketPanel } from "./MarketPanel";
import { SceneBanner } from "./PixelArt";
import { MaterialInventory } from "./MaterialInventory";
import { ClubJournal } from "./ClubJournal";
import { MatchPanel } from "./MatchPanel";
import { GameIcon, type IconName } from "./GameIcon";
import { GodMode } from "./GodMode";
import { ClubHub, type HubTab } from "./ClubHub";
import { regions } from "../../../../packages/contracts/world";
const format = new Intl.NumberFormat("pt-BR");
const regionLabels = Object.fromEntries(regions.map((r) => [r.id, r.name]));
const tabIcons: Record<Tab, IconName> = {
  Clube: "club",
  Coleção: "players",
  Depósito: "box",
  Histórico: "history",
  Mapa: "map",
  Olheiro: "scout",
  Mercado: "store",
  "Centro de treino": "training",
  Liga: "trophy",
};
type Tab = "Clube" | "Coleção" | "Depósito" | "Histórico" | HubTab;
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível conectar. Tente novamente.";
}
function duration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
export default function GameApp() {
  const [revealedAthlete, setRevealedAthlete] = useState<Athlete | null>(null);
  const [game, setGame] = useState<GameView | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [godAvailable, setGodAvailable] = useState(false),
    [godOpen, setGodOpen] = useState(false);
  const [name, setName] = useState(""),
    [tab, setTab] = useState<Tab>("Clube"),
    [lease, setLease] = useState<PresenceReply | null>(null),
    [draft, setDraft] = useState<string[]>([]),
    [region, setRegion] = useState<Region>("VARZEA");
  const [now, setNow] = useState(Date.now()),
    [replayId, setReplayId] = useState<string | null>(null);
  const instance = useRef(""),
    sequence = useRef(0),
    mounted = useRef(true);
  const contentAnchor = useRef<HTMLDivElement>(null);
  const discoverySeen = useRef<{
    club: string;
    ids: Set<string>;
    level: bigint;
  } | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  useEffect(() => {
    if (!game) return;
    const discoveries = game.gameplay.discoveries ?? [],
      previous = discoverySeen.current;
    if (previous?.club === game.club.id) {
      const messages = discoveries
        .filter(
          (d) =>
            !previous.ids.has(d.athleteId) && ["P4", "P5"].includes(d.rarity),
        )
        .map(
          (d) =>
            d.rarity +
            " encontrado: " +
            d.name +
            " · confira a avaliação do olheiro.",
        );
      for (const r of regions)
        if (
          previous.level < BigInt(r.level) &&
          BigInt(game.club.level) >= BigInt(r.level)
        )
          messages.push("Nova região liberada: " + r.name);
      if (messages.length)
        setHighlights((old) => [...messages, ...old].slice(0, 3));
    }
    discoverySeen.current = {
      club: game.club.id,
      ids: new Set(discoveries.map((d) => d.athleteId)),
      level: BigInt(game.club.level),
    };
  }, [game]);
  useEffect(() => {
    contentAnchor.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [tab]);
  const savedLineup = useRef<{ clubId: string; version: number } | null>(null);
  const revision = useRef<{
    clubId: string;
    value: bigint;
    time: number;
  } | null>(null);
  const gameClock = useRef({
    realAnchor: Date.now(),
    gameAnchor: Date.now(),
    speed: 1,
  });
  const clientId = useCallback(() => {
    if (!instance.current) instance.current = crypto.randomUUID();
    return instance.current;
  }, []);
  const acceptGame = useCallback((value: GameView) => {
    const previous = revision.current,
      nextRevision = BigInt(value.revision ?? "0");
    if (
      previous?.clubId === value.club.id &&
      (nextRevision < previous.value ||
        (nextRevision === previous.value && value.serverTime < previous.time))
    )
      return;
    revision.current = {
      clubId: value.club.id,
      value: nextRevision,
      time: value.serverTime,
    };
    setGame(value);
    gameClock.current = {
      realAnchor: Date.now(),
      gameAnchor: value.serverTime,
      speed: value.testMode?.speed ?? 1,
    };
    setNow(value.serverTime);
    if (
      savedLineup.current?.clubId !== value.club.id ||
      savedLineup.current.version !== value.lineup.version
    ) {
      savedLineup.current = {
        clubId: value.club.id,
        version: value.lineup.version,
      };
      setDraft(value.lineup.athleteIds);
    }
  }, []);
  const rosterCache = useRef<{ revision?: string; athletes: Athlete[] }>({
    athletes: [],
  });
  const refresh = useCallback(
    async (lite = false) => {
      let next = await api<GameView>(lite ? "/club?omitRoster=1" : "/club");
      if (
        next.rosterOmitted &&
        next.rosterRevision !== rosterCache.current.revision
      )
        next = await api<GameView>("/club");
      if (next.rosterOmitted)
        next = { ...next, athletes: rosterCache.current.athletes };
      else
        rosterCache.current = {
          revision: next.rosterRevision,
          athletes: next.athletes,
        };
      if (mounted.current) acceptGame(next);
    },
    [acceptGame],
  );
  const acquire = useCallback(async () => {
    const id = clientId();
    const next = await api<PresenceReply>("/presence/acquire", "POST", {
      clientInstanceId: id,
    });
    if (mounted.current) {
      sequence.current = 0;
      setLease(next);
      setError("");
    }
  }, [clientId]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void (async () => {
      try {
        const data = await api<Bootstrap>("/bootstrap");
        if (!active) return;
        setGodAvailable(data.devTools?.godMode ?? false);
        if (data.game) {
          acceptGame(data.game);
          await acquire();
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [acceptGame, acquire]);
  const clubId = game?.club.id,
    farmRegion = game?.farm.regionId;
  const leaseGeneration = lease?.generation;
  const testSpeed = game?.testMode?.speed ?? 1;
  useEffect(() => {
    if (farmRegion) setRegion(farmRegion);
  }, [farmRegion]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      const c = gameClock.current;
      setNow(c.gameAnchor + (Date.now() - c.realAnchor) * c.speed);
    }, 1000);
    return () => clearInterval(timer);
  }, [tab, testSpeed]);
  useEffect(() => {
    if (!clubId) return;
    let active = true,
      inFlight = false,
      lastPoll = 0;
    const timer = setInterval(async () => {
      if (inFlight || (document.hidden && Date.now() - lastPoll < 15000))
        return;
      lastPoll = Date.now();
      inFlight = true;
      try {
        await refresh(true);
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        inFlight = false;
      }
    }, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [clubId, refresh, testSpeed]);
  useEffect(() => {
    if (!clubId || !leaseGeneration) return;
    let active = true,
      inFlight = false;
    const generation = leaseGeneration;
    const timer = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await api<PresenceReply>("/presence/heartbeat", "POST", {
          clientInstanceId: clientId(),
          leaseGeneration: generation,
          sequence: ++sequence.current,
        });
      } catch (e) {
        if (active) {
          setError(errorMessage(e));
          if (e instanceof ApiError && e.status === 409) setLease(null);
        }
      } finally {
        inFlight = false;
      }
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [clubId, leaseGeneration, clientId]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/guest", "POST", {});
      await api("/clubs", "POST", { name });
      await refresh();
      await acquire();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const headers: Record<string, string> = lease
    ? { "x-presence-generation": String(lease.generation) }
    : {};
  async function sendAction(path: string, body: Record<string, unknown>) {
    let result: any;
    await perform(async () => {
      result = await api<any>(
        path,
        "POST",
        { ...body, clientInstanceId: clientId() },
        headers,
      );
      if (result.message) setNotice(result.message);
      if (result.athlete) setRevealedAthlete(result.athlete);
    });
    return result;
  }
  if (loading)
    return (
      <main className="welcome">
        <p className="eyebrow">Football Idle</p>
        <h1>Preparando seu clube…</h1>
      </main>
    );
  if (!game)
    return (
      <main className="welcome">
        <span className="tag">Alpha local · E1</span>
        <h1>
          Um clube pequeno.
          <br />
          Uma história para crescer.
        </h1>
        <p>
          Comece na Várzea com cinco atletas. Monte seu time e deixe a bola
          rolar em partidas automáticas de 90 segundos.
        </p>
        <form onSubmit={create}>
          <label htmlFor="club-name">Nome do seu clube</label>
          <input
            id="club-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={32}
            placeholder="Ex.: União da Vila"
            required
            autoComplete="organization"
          />
          <button disabled={busy}>
            {busy ? "Criando seu clube…" : "Criar meu clube"}
          </button>
        </form>
        {error ? (
          <p className="message error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="small muted">
          Seu progresso fica salvo neste navegador e no banco local. Mantenha os
          dados do navegador para voltar ao clube. Login entre dispositivos
          chegará depois.
        </p>
      </main>
    );
  const xp = BigInt(game.club.xpTotal),
    nextRegion = regions.find((r) => BigInt(game.club.level) < BigInt(r.level)),
    targetXp = nextRegion ? (nextRegion.level - 1) * 100 : 109900,
    progress = Number(xp > BigInt(targetXp) ? BigInt(targetXp) : xp);
  const disabled = busy || !lease || game.offline.catchUpPending;
  const replay =
    game.recentMatches.find((m) => m.id === replayId) ?? game.recentMatches[0];
  const latest = game.recentMatches[0];
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brand-mark">
            <GameIcon name="club" size={25} />
          </span>{" "}
          FOOTBALL<span>IDLE</span>
        </a>
        <span className="prototype">
          CLUB MANAGER <b> / </b>{" "}
          {game.testMode?.used ? "CLUBE DE TESTES" : "ALPHA"}
        </span>
        {godAvailable ? (
          <button
            className={`god-toggle ${testSpeed > 1 ? "active" : ""}`}
            aria-expanded={godOpen}
            onClick={() => setGodOpen((value) => !value)}
          >
            <GameIcon name="bolt" size={16} />
            God mode{testSpeed > 1 ? <b>{testSpeed}×</b> : null}
          </button>
        ) : null}
        <span className="connection">
          <i className={lease ? "online" : ""} />
          {lease ? "Conectado" : "Sem controle"}
        </span>
      </header>
      <main className="dashboard">
        <div className="club-title">
          <div className="club-crest" aria-hidden="true">
            <GameIcon name="club" size={28} />
            <strong>
              {game.club.name
                .split(/\s+/)
                .filter(
                  (word) =>
                    !["da", "de", "do", "das", "dos"].includes(
                      word.toLowerCase(),
                    ),
                )
                .slice(0, 2)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </strong>
            <small>FOOTBALL CLUB</small>
          </div>
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="live-dot" />
              Seu clube · {regionLabels[game.farm.regionId]}
              {game.testMode?.used ? (
                <span className="test-run-label">TESTE</span>
              ) : null}
            </p>
            <h1>{game.club.name}</h1>
            <p className="muted">
              Da Várzea ao topo. Sua jornada começa dentro de campo.
            </p>
          </div>
          <div className="club-level">
            <GameIcon name="trophy" size={24} />
            <span>Nível do clube</span>
            <strong>{game.club.level}</strong>
          </div>
        </div>
        {godAvailable && godOpen ? (
          <GodMode
            speed={testSpeed}
            used={game.testMode?.used ?? false}
            busy={busy || !lease || game.offline.catchUpPending}
            onSpeed={(speed) =>
              void perform(async () => {
                await api(
                  "/dev/god-mode",
                  "POST",
                  { clientInstanceId: clientId(), speed },
                  headers,
                );
                setNotice(
                  speed === 1
                    ? "Velocidade normal restaurada. O progresso de teste foi mantido."
                    : `God mode ${speed}× ativo. Inicie o farm para acelerar seu progresso.`,
                );
              })
            }
          />
        ) : null}
        {testSpeed > 1 && !godOpen ? (
          <div className="god-status">
            <GameIcon name="bolt" size={16} />
            <strong>God mode {testSpeed}× ativo</strong>
            <span>Tempo e progresso acelerados neste clube.</span>
            <button className="text-button" onClick={() => setGodOpen(true)}>
              Ajustar velocidade
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="message error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              Fechar
            </button>
          </div>
        ) : null}
        {highlights.length ? (
          <aside className="rare-notifications" aria-live="polite">
            {highlights.map((h, i) => (
              <div key={h}>
                <span>{h}</span>
                <button
                  className="secondary"
                  aria-label="Dispensar destaque"
                  onClick={() =>
                    setHighlights((old) => old.filter((_, j) => i !== j))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </aside>
        ) : null}
        {notice ? (
          <p className="message" role="status">
            {notice}
          </p>
        ) : null}
        {!lease ? (
          <div className="message">
            <span>
              Retome o controle para escalar e manter sua presença online.
            </span>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void perform(acquire)}
            >
              Assumir controle nesta aba
            </button>
          </div>
        ) : null}
        {game.offline.catchUpPending ? (
          <p className="message" role="status">
            Processando partidas da sua ausência. O saldo será atualizado em
            lotes.
          </p>
        ) : null}
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-icon coins-icon">
              <GameIcon name="coin" />
            </span>
            <span>Coins</span>
            <strong>{format.format(BigInt(game.wallet.balance))}</strong>
            <small>
              Saldo total · {game.wallet.reserved ?? "0"} reservados
            </small>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <GameIcon name="players" />
            </span>
            <span>Atletas na Coleção</span>
            <strong>{game.athletes.length}</strong>
            <small>5 titulares · {game.athletes.length - 5} reservas</small>
          </div>
          <div className="stat">
            <span className="stat-icon xp-icon">
              <GameIcon name="xp" />
            </span>
            <span>Progresso permanente</span>
            <strong>
              {format.format(xp)} <small>XP</small>
            </strong>
            <small>Independe da escalação</small>
          </div>
          <div className="stat">
            <span className="stat-icon clock-icon">
              <GameIcon name="clock" />
            </span>
            <span>Crédito offline</span>
            <strong>{duration(game.offline.remainingMs)}</strong>
            <small>
              {game.offline.qualifyingOnlineMs >= 600000
                ? "Renovação qualificada"
                : "Renova após 10min online contínuos"}
            </small>
          </div>
        </div>
        <nav className="tabs" aria-label="Áreas do clube">
          {(
            [
              "Clube",
              "Mapa",
              "Coleção",
              "Olheiro",
              "Mercado",
              "Centro de treino",
              "Liga",
              "Depósito",
              "Histórico",
            ] as Tab[]
          ).map((item) => (
            <button
              key={item}
              aria-current={tab === item ? "page" : undefined}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              <GameIcon name={tabIcons[item]} size={18} />
              {item}
              {item === "Coleção" ? (
                <span className="nav-count">{game.athletes.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="game-content-anchor" ref={contentAnchor} />
        {game.currentMatch && tab !== "Clube" && tab !== "Histórico" ? (
          <button className="match-ticker" onClick={() => setTab("Clube")}>
            <span className="live-dot" />
            <strong>PARTIDA AO VIVO</strong>
            <span>
              Seu clube {game.currentMatch.liveScore?.homeGoals ?? 0} :{" "}
              {game.currentMatch.liveScore?.awayGoals ?? 0} Rival
            </span>
            <span className="ticker-link">Assistir →</span>
          </button>
        ) : null}
        {tab === "Clube" ? (
          <>
            <div className="content-grid">
              <div>
                {game.currentMatch ? (
                  <MatchPanel
                    match={game.currentMatch}
                    now={now}
                    speed={testSpeed}
                  />
                ) : (
                  <section className="panel idle-panel">
                    <p className="eyebrow">
                      <GameIcon name="play" size={14} /> Pronto para a próxima
                      partida
                    </p>
                    <h2>O campo é seu.</h2>
                    <p className="muted">
                      Ative o farm para jogar 5v5 e evoluir seu clube. Cada
                      partida leva 90 segundos.
                    </p>
                    <div className="empty-pitch" aria-hidden="true">
                      <div className="empty-pitch-ring" />
                      <strong>
                        5 <span>×</span> 5
                      </strong>
                      <small>MONTE SEU TIME. CONSTRUA SEU CLUBE.</small>
                    </div>
                  </section>
                )}
                {latest?.reward ? (
                  <section className="panel reward-strip">
                    <div>
                      <p className="eyebrow">
                        Última recompensa · jogo #{latest.sequence}
                      </p>
                      <strong>
                        +{latest.reward.coins} Coins · +{latest.reward.clubXp}{" "}
                        XP de clube
                      </strong>
                      <p className="muted small">
                        {latest.reward.mode === "ONLINE"
                          ? "Online"
                          : latest.reward.mode === "OFFLINE"
                            ? "Offline"
                            : latest.reward.mode === "INELIGIBLE"
                              ? "Sem elegibilidade"
                              : "Online/offline"}{" "}
                        · {latest.result?.homeGoals} ×{" "}
                        {latest.result?.awayGoals}
                        {latest.reward.athlete
                          ? ` · Novo atleta ${latest.reward.athlete.rarity}`
                          : ""}
                        {latest.reward.material ? " · +1 Suprimento comum" : ""}
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        setReplayId(latest.id);
                        setTab("Histórico");
                      }}
                    >
                      Ver replay
                    </button>
                  </section>
                ) : null}
              </div>
              <aside className="sidebar">
                <section className="panel farm-panel">
                  <p className="eyebrow">Ciclo de jogo</p>
                  <h2>Farm automático</h2>
                  <p className="muted small">
                    {game.farm.running
                      ? "Ativo: o próximo jogo começa automaticamente."
                      : "Parado: nenhuma nova partida será iniciada."}
                  </p>
                  <label htmlFor="region">Região da próxima sessão</label>
                  <select
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as Region)}
                    disabled={disabled || game.farm.running}
                  >
                    {regions.map((r) => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={BigInt(game.club.level) < BigInt(r.level)}
                      >
                        {r.name}
                        {BigInt(game.club.level) < BigInt(r.level)
                          ? ` · nível ${r.level}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="full"
                    disabled={
                      disabled || Boolean(game.currentMatch?.leagueSeasonId)
                    }
                    onClick={() =>
                      void perform(async () => {
                        await api(
                          `/farm/${game.farm.running ? "stop" : "start"}`,
                          "POST",
                          {
                            clientInstanceId: clientId(),
                            regionId: game.farm.running
                              ? game.farm.regionId
                              : region,
                          },
                          headers,
                        );
                        setNotice(
                          game.farm.running
                            ? "Farm parado. A partida atual termina normalmente."
                            : "Farm iniciado. Boa partida!",
                        );
                      })
                    }
                  >
                    <GameIcon
                      name={game.farm.running ? "clock" : "play"}
                      size={16}
                    />
                    {busy
                      ? "Aguarde…"
                      : game.farm.running
                        ? "Parar após esta partida"
                        : "Iniciar farm"}
                  </button>
                </section>
                <section className="panel objective-panel">
                  <span className="objective-icon">
                    <GameIcon name="trophy" size={23} />
                  </span>
                  <p className="eyebrow">Próximo objetivo</p>
                  <h2>
                    {nextRegion
                      ? `Chegar a ${nextRegion.name}`
                      : "Elite conquistada"}
                  </h2>
                  <p className="muted small">
                    {nextRegion
                      ? `Nível ${nextRegion.level} permanente do clube.${nextRegion.id === "REGIONAL" ? " Cerca de 1h de farm online neste perfil." : " Continue evoluindo seu clube."}`
                      : "Todas as regiões estão liberadas. Explore o mapa e desenvolva seu elenco."}
                  </p>
                  <progress
                    max={targetXp}
                    value={progress}
                    aria-label={`Progresso para ${nextRegion?.name ?? "Elite"}`}
                  />
                  <div className="progress-label">
                    {format.format(progress)} / {format.format(targetXp)} XP
                  </div>
                </section>
                <section className="panel compact">
                  <h3>Durante sua ausência</h3>
                  <p className="muted small">
                    Até 24h com crédito: 50% de XP e Coins, materiais comuns
                    possíveis e nenhum atleta.
                  </p>
                  <p className="small muted">
                    Online reconhecido:{" "}
                    {Math.floor(game.offline.qualifyingOnlineMs / 1000)} / 600s
                    para renovar.
                  </p>
                </section>
              </aside>
            </div>
            <section className="panel lineup-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Você escolhe quem joga</p>
                  <h2>Escalação manual</h2>
                </div>
                <span className="tag">5 titulares</span>
              </div>
              <p className="muted small">
                Alterações valem para a próxima partida. Os atletas em campo
                mantêm seu XP desta partida.
              </p>
              <div className="lineup-slots">
                {draft.map((id, index) => (
                  <div key={index}>
                    <label htmlFor={`slot-${index}`}>
                      {
                        [
                          "Goleiro",
                          "Defensor esquerdo",
                          "Defensor direito",
                          "Meia",
                          "Atacante",
                        ][index]
                      }
                    </label>
                    <select
                      id={`slot-${index}`}
                      value={id}
                      disabled={disabled}
                      onChange={(e) =>
                        setDraft((old) =>
                          old.map((value, i) =>
                            i === index ? e.target.value : value,
                          ),
                        )
                      }
                    >
                      {game.athletes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName} · {a.rarity} · OVR {a.ovr}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                className="secondary"
                disabled={
                  disabled ||
                  new Set(draft).size !== 5 ||
                  draft.every((id, i) => id === game.lineup.athleteIds[i])
                }
                onClick={() =>
                  void perform(async () => {
                    await api(
                      "/lineup",
                      "PUT",
                      {
                        clientInstanceId: clientId(),
                        slots: draft.map((athleteId, i) => ({
                          slot: i + 1,
                          athleteId,
                        })),
                      },
                      { ...headers, "if-match": `"${game.lineup.version}"` },
                    );
                    setNotice("Escalação salva para a próxima partida.");
                  })
                }
              >
                Salvar escalação
              </button>
              {new Set(draft).size !== 5 ? (
                <p className="small error-text">
                  Escolha cinco atletas diferentes.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
        {tab === "Clube" ? <ClubJournal game={game} /> : null}
        {tab === "Coleção" ? (
          <CollectionPanel game={game} disabled={disabled} send={sendAction} />
        ) : null}
        {tab === "Centro de treino" ? (
          <TrainingPanel game={game} disabled={disabled} send={sendAction} />
        ) : null}
        {tab === "Mercado" ? (
          <MarketPanel game={game} disabled={disabled} send={sendAction} />
        ) : null}
        {tab === "Olheiro" ? (
          <ScoutingPanel
            game={game}
            disabled={disabled}
            send={sendAction}
            now={now}
          />
        ) : null}
        {tab === "Depósito" ? (
          <>
            <SceneBanner
              scene="depot"
              title="Almoxarifado do clube"
              subtitle="Materiais reais, reservas organizadas e nenhuma venda automática."
            />
            <section className="panel material-inventory">
              <MaterialInventory
                game={game}
                disabled={disabled}
                send={sendAction}
              />
            </section>
            <CollectionPanel
              key="depot"
              game={game}
              disabled={disabled}
              send={sendAction}
              depot
            />
          </>
        ) : null}
        {tab === "Histórico" ? (
          <div className="content-grid">
            <div>
              {replay ? (
                <MatchPanel key={replay.id} match={replay} now={now} replay />
              ) : (
                <section className="panel">
                  <h2>Ainda não há partidas concluídas.</h2>
                  <p className="muted">
                    Ative o farm para começar seu histórico.
                  </p>
                </section>
              )}
              <section className="panel">
                <h2>Últimas partidas</h2>
                <div className="match-history">
                  {game.recentMatches.map((m) => (
                    <button
                      className={`history-row ${replay?.id === m.id ? "selected" : ""}`}
                      key={m.id}
                      onClick={() => setReplayId(m.id)}
                    >
                      <span>
                        #{m.sequence} · {regionLabels[m.regionId]}
                        {m.testRun ? (
                          <em className="test-run-label">TESTE</em>
                        ) : null}
                      </span>
                      <strong>
                        {m.result?.homeGoals} × {m.result?.awayGoals}
                      </strong>
                      <span>+{m.reward?.coins} Coins</span>
                      <small>Rever</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <section className="panel ledger">
              <p className="eyebrow">Saldo auditável</p>
              <h2>Livro-razão de Coins</h2>
              {game.ledger.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Entrada</th>
                        <th>Coins</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {game.ledger.map((e) => (
                        <tr key={e.id}>
                          <td>
                            {
                              (
                                {
                                  MATCH_REWARD: "Partida",
                                  NPC_ATHLETE_SALE: "Venda de atleta",
                                  NPC_SUPPLY_SALE: "Venda de suprimento",
                                  NPC_BULK_SALE: "Venda em lote",
                                  SCOUT_SEARCH: "Olheiro",
                                  CT_MAINTENANCE: "Treino",
                                  CT_EXPANSION: "Expansão CT",
                                  P2P_PURCHASE: "Compra P2P",
                                  P2P_SALE_NET_15_PERCENT:
                                    "Venda P2P (líquida)",
                                } as Record<string, string>
                              )[e.reason ?? "MATCH_REWARD"]
                            }{" "}
                            · #{e.version}
                          </td>
                          <td
                            className={BigInt(e.delta) > 0n ? "positive" : ""}
                          >
                            {BigInt(e.delta) > 0n ? "+" : ""}
                            {e.delta}
                          </td>
                          <td>{e.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Suas recompensas aparecerão aqui.</p>
              )}
              <p className="small muted">
                Últimas 20 entradas. Cada recompensa só pode ser concedida uma
                vez.
              </p>
            </section>
          </div>
        ) : null}
        {(["Mapa", "Liga"] as string[]).includes(tab) ? (
          <ClubHub
            key={tab}
            tab={tab as HubTab}
            game={game}
            now={now}
            disabled={disabled}
            act={async (body, market) => {
              await perform(async () => {
                const result = await api<{
                  message: string;
                  athlete?: Athlete;
                }>(
                  market ? "/market/command" : "/club/command",
                  "POST",
                  { ...body, clientInstanceId: clientId() },
                  headers,
                );
                setNotice(result.message);
                if (result.athlete) setRevealedAthlete(result.athlete);
                if (body.action === "LEAGUE_PLAY") setTab("Clube");
              });
            }}
            travel={async (regionId) => {
              await perform(async () => {
                await api(
                  "/farm/start",
                  "POST",
                  { clientInstanceId: clientId(), regionId },
                  headers,
                );
                setNotice(`Farm iniciado em ${regionLabels[regionId]}.`);
                setTab("Clube");
              });
            }}
          />
        ) : null}
        {revealedAthlete ? (
          <AthleteDialog
            athlete={revealedAthlete}
            onClose={() => setRevealedAthlete(null)}
          />
        ) : null}
        <footer>
          Football Idle · Retro E2 · Balanceamento experimental · Progresso
          salvo no servidor local
        </footer>
      </main>
    </div>
  );
}
