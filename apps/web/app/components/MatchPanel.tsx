"use client";
import { useEffect, useState, useRef } from "react";
import type {
  Athlete,
  MatchEvent,
  MatchView,
} from "../../../../packages/contracts/index";
import { regionInfo } from "../../../../packages/contracts/world";
import { AthleteDialog } from "./Roster";
import { PixelPlayer, clubColor, PlayPreferences } from "./PixelArt";
function eventText(e: MatchEvent, m: MatchView) {
  const a =
    [...m.home, ...m.away].find((a) => a.id === e.payload.actorId)
      ?.displayName ?? "A equipe";
  if (e.type === "TACKLE") return `${a} vence a disputa e recupera a posse.`;
  if (e.type === "GOALKEEPER_SAVE") return `${a} segura a bola após a defesa.`;
  if (e.type === "RESTART")
    return e.payload.outcome === "KICKOFF"
      ? "Bola no centro. Recomeça o jogo."
      : "Tiro de meta: o goleiro reinicia a jogada.";
  if (e.type === "MATCH_STARTED") return "Apita o árbitro. Começa a partida!";
  if (e.type === "MATCH_ENDED") return "Fim de jogo! Resultado confirmado.";
  if (e.type === "POSSESSION_CHANGED") return `${a} domina e organiza a saída.`;
  if (e.type === "PASS_COMPLETED")
    return `${a} recebe um passe e acelera o jogo.`;
  if (e.type === "CHANCE_CREATED")
    return `${a} avança e prepara a finalização…`;
  return e.payload.outcome === "GOAL"
    ? `GOOOL! ${a} manda para a rede!`
    : e.payload.outcome === "SAVED"
      ? `Chute de ${a}! O goleiro faz a defesa.`
      : `${a} arrisca, mas a bola passa para fora.`;
}
const formation = [
  [6.5, 50],
  [26, 26],
  [26, 74],
  [43, 35],
  [46, 68],
];
export function MatchPanel({
  match: m,
  now,
  replay = false,
  speed = 1,
}: {
  match: MatchView;
  now: number;
  replay?: boolean;
  speed?: number;
}) {
  const [replayMs, setReplayMs] = useState(0),
    [playing, setPlaying] = useState(false),
    [selected, setSelected] = useState<Athlete | null>(null),
    [sound, setSound] = useState(false),
    [heard, setHeard] = useState(""),
    [reduced, setReduced] = useState(false),
    [frameNow, setFrameNow] = useState(now),
    [visiblePage, setVisiblePage] = useState(true);
  const anchor = useRef({ game: now, real: 0 });
  useEffect(() => {
    anchor.current = { game: now, real: performance.now() };
    if (visiblePage) setFrameNow(now);
  }, [now, visiblePage]);
  useEffect(() => {
    const saved = localStorage.getItem("fi-transmission-v2");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setReduced(!!p.reduced);
        setSound(!!p.sound);
      } catch {}
    } else setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const change = () => setVisiblePage(!document.hidden);
    change();
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  const preferences = (r: boolean, s: boolean) => {
    setReduced(r);
    setSound(s);
    localStorage.setItem(
      "fi-transmission-v2",
      JSON.stringify({ reduced: r, sound: s }),
    );
  };
  useEffect(() => {
    if (replay || reduced || !visiblePage) return;
    let handle = 0,
      last = 0;
    const frame = (t: number) => {
      if (t - last >= 32) {
        last = t;
        setFrameNow(anchor.current.game + (t - anchor.current.real) * speed);
      }
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [replay, reduced, visiblePage, speed]);
  useEffect(() => {
    setReplayMs(0);
    setPlaying(false);
  }, [m.id]);
  useEffect(() => {
    if (!playing || !visiblePage) return;
    const t = setInterval(
      () => setReplayMs((v) => Math.min(90000, v + 300)),
      50,
    );
    return () => clearInterval(t);
  }, [playing, visiblePage]);
  useEffect(() => {
    if (replayMs >= 90000) setPlaying(false);
  }, [replayMs]);
  const elapsed = replay
    ? replayMs
    : Math.max(
        0,
        Math.min(
          90000,
          (reduced ? now : frameNow) - m.startAt - (speed === 1 ? 1200 : 0),
        ),
      );
  const visible = m.events.filter((e) => e.offsetMs <= elapsed),
    last = visible.at(-1),
    touch = visible.filter((e) => e.payload.actorId).at(-1);
  const score = visible
    .filter((e) => e.payload.homeGoals !== undefined)
    .at(-1)?.payload;
  const homeGoals = score?.homeGoals ?? 0,
    awayGoals = score?.awayGoals ?? 0;
  const age = last ? elapsed - last.offsetMs : 100000,
    goal =
      last?.payload.outcome === "GOAL" && age < Math.max(3000, speed * 1500);
  const position = (i: number, home: boolean) => {
    const b = formation[i],
      attacking = touch?.payload.team === (home ? "HOME" : "AWAY");
    const active = touch?.payload.actorId === (home ? m.home : m.away)[i]?.id;
    const p = touch?.payload.stage;
    if (active && i > 0 && p) {
      const t = Math.max(
        0,
        Math.min(1, (elapsed - touch!.offsetMs) / p.durationMs),
      );
      if (touch?.type === "SHOT_RESOLVED") return p.from;
      return {
        x: p.from.x + (p.to.x - p.from.x) * t,
        y: p.from.y + (p.to.y - p.from.y) * t,
      };
    }
    const x = i === 0 ? b[0] : b[0] + (active ? 20 : attacking ? 8 : -3),
      y = b[1];
    return { x: home ? x : 100 - x, y };
  };
  let ball = { x: 50, y: 50 };
  if (touch) {
    const home = touch.payload.team === "HOME",
      team = home ? m.home : m.away,
      index = Math.max(
        1,
        team.findIndex((a) => a.id === touch.payload.actorId),
      );
    const p = position(index, home);
    ball = { x: p.x + 1.8, y: p.y + 2 };
    if (last?.type === "PASS_COMPLETED" && age < 800) {
      const source = team.findIndex((a) => a.id === last.payload.sourceActorId),
        from = position(Math.max(1, source), home),
        t = Math.min(1, age / 800);
      ball = { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t };
    }
    if (last?.type === "SHOT_RESOLVED" && age < 2300)
      ball = {
        x: home ? 94 : 6,
        y: last.payload.outcome === "MISSED" ? 20 : 50,
      };
    if (goal && age > 1700) ball = { x: 50, y: 50 };
  }
  if (last?.payload.stage) {
    const p = last.payload.stage,
      t = Math.max(0, Math.min(1, (elapsed - last.offsetMs) / p.durationMs));
    ball = {
      x: p.from.x + (p.to.x - p.from.x) * t,
      y: p.from.y + (p.to.y - p.from.y) * t,
    };
  }
  const shots = (team: "HOME" | "AWAY") =>
    visible.filter((e) => e.type === "SHOT_RESOLVED" && e.payload.team === team)
      .length;
  const possession = visible.filter((e) => e.type === "POSSESSION_CHANGED"),
    homePoss = possession.length
      ? Math.round(
          (possession.filter((e) => e.payload.team === "HOME").length /
            possession.length) *
            100,
        )
      : 50;
  useEffect(() => {
    if (
      !visiblePage ||
      !sound ||
      !goal ||
      !last ||
      heard === `${m.id}:${last.sequence}`
    )
      return;
    setHeard(`${m.id}:${last.sequence}`);
    const ctx = new AudioContext(),
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.07, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.6);
    o.onended = () => void ctx.close();
  }, [sound, goal, last, heard, m.id, visiblePage]);
  return (
    <section
      className="panel match-panel broadcast"
      aria-label={replay ? "Replay da partida" : "Partida atual"}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {replay ? "CENTRAL DE REPLAYS · 6×" : "TRANSMISSÃO · 5 CONTRA 5"}
          </p>
          <h2>{regionInfo(m.regionId).venue}</h2>
        </div>
        <span className="tag live-tag">
          {replay ? "REPLAY" : "● AO VIVO"} · #{m.sequence}
        </span>
      </div>
      <div className="broadcast-board">
        <span className="team-badge">FI</span>
        <span className="team-title">
          {m.homeName ?? "SEU CLUBE"}
          <small>MANDANTE</small>
        </span>
        <strong
          className="broadcast-score"
          key={`${m.id}:${homeGoals}:${awayGoals}`}
          aria-label={`Placar ${homeGoals} a ${awayGoals}`}
        >
          {homeGoals}
          <i>:</i>
          {awayGoals}
        </strong>
        <span className="team-title">
          {m.awayName ?? "VISITANTE"}
          <small>
            {m.leagueSeasonId
              ? m.awayClubId
                ? "LIGA · CLUBE"
                : "LIGA · NPC"
              : "RIVAL LOCAL"}
          </small>
        </span>
        <span className="team-badge rival-badge">FC</span>
      </div>
      <div className="stadium">
        <div className="stadium-crowd">
          FOOTBALL IDLE <span>JOGUE. EVOLUA. CONQUISTE.</span> CLUB ARENA
        </div>
        <div
          className={`pitch animated-pitch retro-pitch ${goal ? "goal-moment" : ""} ${reduced ? "reduced-motion" : ""}`}
          aria-label="Campo animado com um goleiro e quatro atletas de linha por equipe"
        >
          <div className="penalty-area left-area" />
          <div className="penalty-area right-area" />
          <div className="goal left-goal" />
          <div className="goal right-goal" />
          <div className="pitch-center" />
          {([true, false] as const).flatMap((home) =>
            (home ? m.home : m.away).map((a, i) => {
              const p = position(i, home);
              return (
                <button
                  type="button"
                  key={`${home}:${a.id}`}
                  className={`player ${home ? "home" : "away"} ${i === 0 ? "keeper" : ""} ${touch?.payload.actorId === a.id ? "on-ball" : ""}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  onClick={() => setSelected(a)}
                  aria-label={`Ver carta de ${a.displayName}${i === 0 ? ", goleiro" : ""}`}
                >
                  <PixelPlayer
                    athlete={{ ...a, number: i === 0 ? 1 : a.number }}
                    color={
                      i === 0
                        ? home
                          ? "#e4b764"
                          : "#ae9bce"
                        : clubColor(
                            home
                              ? (m.homeName ?? "home")
                              : (m.awayName ?? "away"),
                          )
                    }
                    pose={
                      reduced
                        ? "idle"
                        : last?.type === "GOALKEEPER_SAVE" &&
                            last.payload.actorId === a.id &&
                            age < 1200
                          ? "save"
                          : goal && last?.payload.actorId === a.id
                            ? "celebrate"
                            : last?.type === "SHOT_RESOLVED" &&
                                last.payload.actorId === a.id &&
                                age < 700
                              ? "kick"
                              : "run"
                    }
                  />
                  <small>
                    {a.displayName.split(" ").at(-1)}
                    {i === 0 ? " · GOL" : ""}
                  </small>
                </button>
              );
            }),
          )}
          <span
            className="match-ball"
            style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
            aria-hidden="true"
          />
          {goal ? (
            <div
              className={`goal-celebration ${last?.payload.team === "AWAY" ? "away-goal" : ""}`}
              key={`${m.id}:${last?.sequence}`}
            >
              <span>GOOOOL!</span>
              <strong>
                {
                  [...m.home, ...m.away].find(
                    (a) => a.id === last?.payload.actorId,
                  )?.displayName
                }
              </strong>
              <div className="confetti" />
            </div>
          ) : null}
        </div>
        <div className="stadium-crowd bottom-boards">
          ★ CLUBE PEQUENO. SONHOS GIGANTES. ★
        </div>
      </div>
      <div className="match-clock">
        <b>
          {String(Math.floor(elapsed / 1000)).padStart(2, "0")}′{" "}
          <span className="muted">
            / 90′ · {Math.floor(elapsed / 1000)}s de jogo
          </span>
        </b>
        <PlayPreferences
          reduced={reduced}
          onReduced={(r) => preferences(r, sound)}
          sound={sound}
          onSound={(v) => preferences(reduced, v)}
        />
      </div>
      <progress value={elapsed} max={90000} aria-label="Tempo da partida" />
      <p className="commentary" aria-live="polite">
        {last
          ? eventText(last, m)
          : "As equipes se preparam para o apito inicial."}
      </p>
      <div className="match-statistics">
        <div>
          <b>{homePoss}%</b>
          <span>POSSE POR LANCES</span>
          <b>{100 - homePoss}%</b>
        </div>
        <div>
          <b>{shots("HOME")}</b>
          <span>FINALIZAÇÕES</span>
          <b>{shots("AWAY")}</b>
        </div>
      </div>
      {replay ? (
        <div className="replay-controls">
          <button
            className="secondary"
            onClick={() => {
              if (replayMs >= 90000) setReplayMs(0);
              setPlaying(!playing);
            }}
          >
            {playing ? "Pausar" : "Reproduzir"}
          </button>
          <input
            type="range"
            min={0}
            max={90000}
            step={100}
            value={replayMs}
            aria-label="Posição no replay"
            onChange={(e) => {
              setPlaying(false);
              setReplayMs(Number(e.target.value));
            }}
          />
        </div>
      ) : (
        <p className="small muted">
          {elapsed >= 90000
            ? "Confirmando resultado e recompensas…"
            : speed > 1
              ? `God mode ${speed}× · eventos acelerados`
              : "Placar e eventos confirmados pelo servidor. Clique em um atleta para abrir sua carta."}
        </p>
      )}
      <details className="broadcast-events">
        <summary>Lances da partida · {visible.length} eventos</summary>
        <ol className="event-list">
          {[...visible].reverse().map((e) => (
            <li key={e.sequence}>
              <time>{e.offsetMs / 1000}′</time> {eventText(e, m)}
            </li>
          ))}
        </ol>
      </details>
      {selected ? (
        <AthleteDialog
          athlete={selected}
          clubName={
            m.home.some((a) => a.id === selected.id) ? m.homeName : m.awayName
          }
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
