"use client";
import { useState, type CSSProperties } from "react";
import type { GameView, Region } from "../../../../packages/contracts/index";
import { regions, regionInfo } from "../../../../packages/contracts/world";
export type HubTab =
  "Mapa" | "Olheiro" | "Mercado" | "Centro de treino" | "Liga";
type Props = {
  tab: HubTab;
  game: GameView;
  now: number;
  disabled: boolean;
  act: (body: Record<string, unknown>, market?: boolean) => Promise<void>;
  travel: (region: Region) => Promise<void>;
};
export function WorldMap({
  game,
  disabled,
  travel,
}: Pick<Props, "game" | "disabled" | "travel">) {
  const [region, setRegion] = useState<Region>(game.farm.regionId),
    [zoom, setZoom] = useState(1);
  const r = regionInfo(region),
    unlocked = BigInt(game.club.level) >= BigInt(r.level);
  return (
    <section className="panel world-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">A JORNADA DO SEU CLUBE</p>
          <h2>Do bairro ao mundo.</h2>
          <p className="muted">
            Explore sete circuitos. Cada conquista abre um novo caminho.
          </p>
        </div>
        <span className="tag">
          {
            regions.filter((r) => BigInt(game.club.level) >= BigInt(r.level))
              .length
          }{" "}
          / 7 REGIÕES
        </span>
      </div>
      <div className="world-layout">
        <div className="world-window">
          <div className="world-canvas" style={{ transform: `scale(${zoom})` }}>
            <svg
              viewBox="0 0 1000 650"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="mapGrid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M40 0H0V40" fill="none" stroke="#80c9b00c" />
                </pattern>
                <linearGradient id="land" x2="1" y2="1">
                  <stop stopColor="#234e4b" />
                  <stop offset="1" stopColor="#142c3a" />
                </linearGradient>
              </defs>
              <rect width="1000" height="650" fill="url(#mapGrid)" />
              <path
                d="M74 416L113 312L216 330L249 258L337 281L385 210L467 231L509 129L604 143L657 67L766 79L809 15L933 47L968 137L903 223L953 316L859 393L790 352L718 464L597 421L528 539L392 513L322 607L207 556L157 620L87 531Z"
                fill="url(#land)"
                stroke="#527f6b"
                strokeWidth="2"
              />
              <path
                d="M120 500 Q160 350 280 397 T440 494 T520 286 T690 390 T780 188 T890 85"
                fill="none"
                stroke="#a7cf8050"
                strokeWidth="4"
                strokeDasharray="8 10"
              />
              {Array.from({ length: 24 }, (_, i) => (
                <path
                  key={i}
                  d={`M${130 + i * 30} ${260 + Math.sin(i) * 100}l12 -20 12 20Z`}
                  fill="#56846c22"
                />
              ))}
            </svg>
            {regions.map((r) => {
              const open = BigInt(game.club.level) >= BigInt(r.level);
              return (
                <button
                  key={r.id}
                  className={`map-node ${open ? "unlocked" : "locked"} ${region === r.id ? "selected" : ""}`}
                  style={
                    {
                      left: `${r.x}%`,
                      top: `${r.y}%`,
                      "--region-color": r.color,
                    } as CSSProperties
                  }
                  onClick={() => setRegion(r.id)}
                  aria-pressed={region === r.id}
                  aria-label={`${r.name}, nível ${r.level}${open ? ", liberada" : ", bloqueada"}`}
                >
                  <span>{open ? "⚑" : "▣"}</span>
                  <strong>{r.name}</strong>
                  <small>NV. {r.level}</small>
                </button>
              );
            })}
          </div>
          <div className="map-legend">
            ● DISPONÍVEL <span>▣ REQUER PROGRESSO DO CLUBE</span>
          </div>
        </div>
        <aside
          className="region-sheet"
          style={{ "--region-color": r.color } as CSSProperties}
        >
          <img
            className="region-scene"
            src={`/assets/e2/region-${r.id.toLowerCase()}.svg`}
            alt={`Circuito ${r.name}`}
          />
          <p className="eyebrow">
            CIRCUITO{" "}
            {String(regions.findIndex((x) => x.id === r.id) + 1).padStart(
              2,
              "0",
            )}
          </p>
          <h2>{r.name}</h2>
          <span className={`tag ${unlocked ? "positive" : ""}`}>
            {unlocked ? "EXPLORAÇÃO LIBERADA" : `BLOQUEADA · NÍVEL ${r.level}`}
          </span>
          <div className="region-emblem">⚽</div>
          <h3>{r.venue}</h3>
          <dl className="region-facts">
            <div>
              <dt>Rivais</dt>
              <dd>
                OVR {r.opponent}–{r.opponent + 4}
              </dd>
            </div>
            <div>
              <dt>Formato</dt>
              <dd>5v5 · 90 segundos</dd>
            </div>
            <div>
              <dt>Coins por jogo</dt>
              <dd>
                {r.coins}–
                {r.id === "VARZEA"
                  ? 15
                  : r.id === "REGIONAL"
                    ? 18
                    : r.coins + 8}
              </dd>
            </div>
            <div>
              <dt>Atletas</dt>
              <dd>Somente online</dd>
            </div>
          </dl>
          <progress
            value={Math.min(Number(game.club.level), r.level)}
            max={r.level}
            aria-label={`Progresso para ${r.name}`}
          />
          <p className="small muted">
            Seu clube: nível {game.club.level}. Os desbloqueios são permanentes.
          </p>
          <button
            className="full"
            disabled={
              disabled || !unlocked || game.farm.running || !!game.currentMatch
            }
            onClick={() => void travel(r.id)}
          >
            Jogar em {r.name}
          </button>
          {game.farm.running || game.currentMatch ? (
            <p className="small muted">
              Pare o farm e aguarde o apito final para viajar.
            </p>
          ) : null}
        </aside>
      </div>
      <label className="map-zoom">
        Zoom do mapa
        <input
          type="range"
          min="1"
          max="1.6"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
    </section>
  );
}
export function ClubHub({ tab, game: g, now, disabled, act, travel }: Props) {
  const cmd = (action: string) => void act({ action });
  if (tab === "Mapa")
    return <WorldMap game={g} disabled={disabled} travel={travel} />;
  if (tab === "Liga") {
    const l = g.gameplay.league,
      active = l && l.endsAt > now;
    return (
      <div className="hub-grid">
        <section className="panel league-hero">
          <p className="eyebrow">COMPETIÇÃO ASSÍNCRONA</p>
          <div className="league-cup">♜</div>
          <h2>Liga dos Clubes</h2>
          <p className="muted">
            Uma temporada. Vinte partidas. Seu lugar na história.
          </p>
          <span className="tag">14 DIAS · ATÉ 20 JOGOS</span>
          <p className="small muted">
            Adversários sorteados entre clubes ativos da mesma divisão. Se não
            houver outro clube disponível, você enfrenta um NPC. A campanha é
            individual.
          </p>
          {active ? (
            <>
              <h3>
                Divisão {l.division} ·{" "}
                {Math.max(0, Math.ceil((l.endsAt - now) / 86400000))} dias
                restantes
              </h3>
              <div className="league-stats">
                <div>
                  <strong>{l.points}</strong>
                  <span>PONTOS</span>
                </div>
                <div>
                  <strong>{l.games}/20</strong>
                  <span>JOGOS</span>
                </div>
                <div>
                  <strong>{l.goalsFor - l.goalsAgainst}</strong>
                  <span>SALDO</span>
                </div>
              </div>
              <button
                className="full"
                disabled={
                  disabled ||
                  l.games >= 20 ||
                  g.farm.running ||
                  !!g.currentMatch
                }
                onClick={() => cmd("LEAGUE_PLAY")}
              >
                Disputar próxima partida
              </button>
              {g.farm.running || g.currentMatch ? (
                <p className="small muted">
                  Pare o farm e aguarde a partida atual terminar.
                </p>
              ) : null}
              <p className="muted">
                {l.wins} vitórias · {l.draws} empates · {l.losses} derrotas
              </p>
            </>
          ) : (
            <button
              className="full"
              disabled={disabled}
              onClick={() => cmd("LEAGUE_JOIN")}
            >
              Entrar na temporada
            </button>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">CAMPANHA DA TEMPORADA</p>
          <h2>Resultados</h2>
          {l?.records.length ? (
            <div className="league-results">
              {l.records.map((r, i) => (
                <div key={r.matchId}>
                  <span>Jogo {i + 1}</span>
                  <strong>{r.score}</strong>
                  <span className="tag">
                    {r.outcome === "WIN"
                      ? "VITÓRIA"
                      : r.outcome === "DRAW"
                        ? "EMPATE"
                        : "DERROTA"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Seu primeiro desafio espera por você.</p>
          )}
        </section>
      </div>
    );
  }

  return null;
}
