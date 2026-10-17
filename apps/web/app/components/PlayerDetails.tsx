"use client";
import {
  playerArchetype,
  playerSpecialties,
} from "../../../../packages/contracts/player-specialties";
import { useEffect, useRef, useState } from "react";
import type {
  CardEdition,
  FootballView,
  OwnedCard,
} from "../../../../packages/contracts/brasfoot";
import {
  attributeNames,
  effectiveCard,
  playerIdentity,
  roleNames,
  stableNumber,
  ovrWeights,
} from "../../../../packages/contracts/card-model";
export function PlayerPortrait({ card }: { card: CardEdition }) {
  const seed = card.portraitSeed ?? stableNumber(card.id),
    skin = ["#bd8060", "#e8bb97", "#8b563e", "#d49e76", "#704737"][seed % 5],
    hair = ["#241d1a", "#5c3925", "#b99d63", "#161b1d"][seed % 4],
    kit = ["#7fa48d", "#78a0c3", "#a3a088", "#b67a69", "#a395b6"][seed % 5];
  return (
    <svg
      className="v2-portrait"
      viewBox="0 0 140 140"
      role="img"
      aria-label={`Avatar ilustrado original de ${card.player}`}
    >
      <defs>
        <linearGradient id={`bg-${card.id}`} x2="0" y2="1">
          <stop stopColor={kit} stopOpacity=".25" />
          <stop offset="1" stopColor="#14231f" />
        </linearGradient>
      </defs>
      <rect width="140" height="140" rx="10" fill={`url(#bg-${card.id})`} />
      <path d="M14 140V113Q22 91 54 88H86Q118 91 126 113V140" fill={kit} />
      <path d="M57 74h26v21Q70 107 57 95" fill={skin} />
      <ellipse cx="70" cy="53" rx={24 + (seed % 4)} ry="31" fill={skin} />
      <path
        d={
          seed % 2
            ? "M44 54V31Q47 10 75 18Q101 18 97 48L86 34L54 39Z"
            : "M44 50V31Q55 13 84 20L99 37L95 50L84 32L48 40Z"
        }
        fill={hair}
      />
      <path d="M54 54h9m15 0h9" stroke="#332720" strokeWidth="2" />
      <path d="M65 71q6 4 12-1" fill="none" stroke="#634332" strokeWidth="2" />
      <path
        d="M54 94l16 13 16-13M70 107v33"
        fill="none"
        stroke="#e9e9cf"
        strokeWidth="3"
      />
      <text
        x="70"
        y="133"
        textAnchor="middle"
        fontSize="17"
        fontWeight="800"
        fill="#f1f4e2"
      >
        {card.position}
      </text>
    </svg>
  );
}
export default function PlayerDetails({
  card,
  owned,
  f,
  busy,
  balance,
  onCommand,
  onClose,
  feedback,
}: {
  card: CardEdition;
  owned?: OwnedCard;
  f: FootballView;
  busy: boolean;
  balance: string;
  onCommand: (body: unknown) => Promise<unknown>;
  onClose: () => void;
  feedback?: string;
}) {
  const [compare, setCompare] = useState(""),
    dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  const current = effectiveCard(card, owned),
    p = card.profile,
    stats = f.performance?.[playerIdentity(card)],
    seasonStats = stats?.seasons[String(f.season.number)],
    other = f.catalog.find((c) => c.id === compare),
    attributes = current.attributes,
    archetype = playerArchetype(current);
  const today = new Date(f.serverTime),
    born = p?.birthDate ? new Date(`${p.birthDate}T00:00:00Z`) : null;
  const age = born
    ? today.getUTCFullYear() -
      born.getUTCFullYear() -
      (today.getUTCMonth() < born.getUTCMonth() ||
      (today.getUTCMonth() === born.getUTCMonth() &&
        today.getUTCDate() < born.getUTCDate())
        ? 1
        : 0)
    : null;
  const keys = (
    card.position === "GOL"
      ? ["diving", "handling", "reflexes", "kicking", "positioning"]
      : ["pace", "finishing", "passing", "dribbling", "defending", "physical"]
  ) as (keyof NonNullable<CardEdition["attributes"]>)[];
  return (
    <div
      className="v2-shade"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="v2-player-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${card.player}`}
        tabIndex={-1}
        ref={dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const focusable = dialog.current?.querySelectorAll<HTMLElement>(
              "button,input,select,a[href]",
            );
            if (!focusable?.length) return;
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialog.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          className="v2-close"
          onClick={onClose}
          aria-label="Fechar ficha"
        >
          ✕
        </button>
        {feedback && <p role="status">{feedback}</p>}
        <div className="v2-sheet-hero">
          <PlayerPortrait card={card} />
          <div>
            <p className="eyebrow">
              {card.rarity} · {card.edition}
            </p>
            <h2>{card.player}</h2>
            <p>
              {p?.flag} {p?.country ?? "Origem não informada"} ·{" "}
              {card.role ? roleNames[card.role] : card.position}
            </p>
            <strong className="v2-ovr">
              {current.rating} <small>OVR</small>
            </strong>
            <p>
              {p?.club ?? "Clube não informado"} · referência{" "}
              {p?.referenceYear ?? "—"}
            </p>
          </div>
        </div>
        <div className="v2-facts">
          <p>
            <small>Nome completo na fonte</small>
            {p?.fullName ?? "Não informado"}
          </p>
          <p>
            <small>Nascimento / idade calculada</small>
            {p?.birthDate
              ? `${p.birthDate.split("-").reverse().join("/")} · ${age} anos`
              : "Não informado"}
          </p>
          <p>
            <small>Altura / pé preferido</small>
            {p?.heightCm ? `${p.heightCm} cm` : "Altura não informada"} ·{" "}
            {p?.preferredFoot ?? "Pé não informado"}
          </p>
          <p>
            <small>Posição da fonte / secundárias confirmadas</small>
            {p?.factualPosition ?? card.position} ·{" "}
            {card.secondaryRoles?.length
              ? card.secondaryRoles.map((r) => roleNames[r]).join(", ")
              : "Não documentadas"}
          </p>
        </div>
        <p className="v2-note">
          {p?.roleNote} Atributos, OVR e potencial abaixo são balanceamento
          experimental do jogo. Avatar original decorativo.
        </p>
        <section className="archetype-profile">
          <span className="eyebrow">
            ARQUÉTIPO DA FUNÇÃO · LEITURA DOS ATRIBUTOS
          </span>
          <h3>{archetype.label}</h3>
          <div>
            {archetype.strengths.map((s) => (
              <span key={s.label}>
                {s.label} <b>{s.value}</b>
              </span>
            ))}
          </div>
          {archetype.development ? (
            <p>
              Menor valor entre os atributos relevantes da função:{" "}
              {archetype.development.label} ({archetype.development.value}).
            </p>
          ) : null}
          <small>
            Perfil descritivo dos atributos atuais do jogo. Não concede bônus e
            não altera a carta, seu potencial ou suas probabilidades.
          </small>
        </section>
        <p className="manager-specialties">
          <strong>Perfil no jogo:</strong>{" "}
          {playerSpecialties(current).join(" · ") || "Sem atributos detalhados"}
          . Destaques calculados pelos atributos desta função; não são
          habilidades adicionais.
        </p>
        <label>
          Comparar atributos com
          <select value={compare} onChange={(e) => setCompare(e.target.value)}>
            <option value="">Escolha uma edição</option>
            {f.catalog
              .filter((c) => c.position === card.position && c.id !== card.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.player} · {c.rating} · {c.rarity}
                </option>
              ))}
          </select>
        </label>
        <div className="v2-attributes">
          {keys.map((key) => (
            <div key={key}>
              <span>{attributeNames[key]}</span>
              <meter min="0" max="99" value={attributes?.[key] ?? 0} />
              <strong>{attributes?.[key] ?? "—"}</strong>
              {other && <em>{other.attributes?.[key] ?? "—"}</em>}
            </div>
          ))}
        </div>
        <details>
          <summary>Como o OVR desta função é calculado</summary>
          <p>
            {Object.entries(
              ovrWeights[
                card.role ??
                  (card.position === "GOL"
                    ? "GOL"
                    : card.position === "DEF"
                      ? "ZAG"
                      : card.position === "MEI"
                        ? "MEI"
                        : "ATA")
              ],
            )
              .map(
                ([key, weight]) =>
                  `${attributeNames[key as keyof typeof attributeNames]} ${Math.round(weight! * 100)}%`,
              )
              .join(" · ")}
            . Soma ponderada arredondada, de 1 a 99.
          </p>
        </details>
        <section>
          <h3>Evolução limitada</h3>
          <p>
            OVR base {card.rating} · potencial até{" "}
            {card.potential ?? card.rating} · evolução {owned?.upgrades ?? 0}/3.
            Cada treino melhora os atributos em 1, com teto 99.
          </p>
          {owned && (
            <button
              disabled={
                busy ||
                (owned.upgrades ?? 0) >= 3 ||
                BigInt(balance) < BigInt(2500 * ((owned.upgrades ?? 0) + 1))
              }
              onClick={() => void onCommand({ action: "TRAIN", id: owned.id })}
            >
              Treinar ·{" "}
              {(2500 * ((owned.upgrades ?? 0) + 1)).toLocaleString("pt-BR")}{" "}
              Coins
            </button>
          )}
        </section>
        <section>
          <h3>Desempenho no seu clube</h3>
          {stats ? (
            <>
              <div className="v2-stat-strip">
                <span>
                  <strong>{stats.appearances}</strong>jogos
                </span>
                <span>
                  <strong>{stats.goals}</strong>gols
                </span>
                <span>
                  <strong>{stats.assists}</strong>assistências
                </span>
                <span>
                  <strong>
                    {stats.ratedMatches
                      ? (stats.ratingTotal / stats.ratedMatches).toFixed(1)
                      : "—"}
                  </strong>
                  nota por eventos
                </span>
                {card.position === "GOL" && (
                  <span>
                    <strong>{stats.cleanSheets}</strong>sem sofrer gols
                  </span>
                )}
              </div>
              <p>
                Temporada {f.season.number}: {seasonStats?.appearances ?? 0}{" "}
                jogos, {seasonStats?.goals ?? 0} gols e{" "}
                {seasonStats?.assists ?? 0} assistências.
              </p>
              <p>
                {stats.passes} passes · {stats.shots} finalizações ·{" "}
                {stats.saves} defesas · {stats.minutes} minutos.
              </p>
            </>
          ) : (
            <p>
              Ainda não há partidas registradas pelo motor V2. Estatísticas
              antigas incompletas não foram preenchidas artificialmente.
            </p>
          )}
        </section>
        <section>
          <h3>Histórico desta carta</h3>
          {owned ? (
            owned.clubHistory?.length ? (
              owned.clubHistory.map((h, i) => (
                <p key={i}>
                  {h.kind === "TRANSFER"
                    ? "Transferência para"
                    : "Adquirida por"}{" "}
                  {h.name} · {new Date(h.at).toLocaleDateString("pt-BR")}
                </p>
              ))
            ) : (
              <p>Carta adquirida antes do registro de transferências V2.</p>
            )
          ) : (
            <p>Consulte uma instância da coleção para ver sua trajetória.</p>
          )}
        </section>
        <p>
          <a
            href={`${p?.source ?? card.source}${p?.sourcePage ? `#page=${p.sourcePage}` : ""}`}
            target="_blank"
            rel="noreferrer"
          >
            Consultar fonte histórica
          </a>{" "}
          · dados da seleção/representação esportiva na fonte; não representa
          vínculo atual.
        </p>
        {!!p?.sources?.length && (
          <details>
            <summary>Fontes complementares da ficha</summary>
            {p.sources.map((url, i) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  Fonte complementar {i + 1}
                </a>
              </p>
            ))}
          </details>
        )}
        {p?.verifiedAt && (
          <small>
            Biografia consultada em{" "}
            {p.verifiedAt.split("-").reverse().join("/")}. O ano do clube de
            referência pode ser anterior à consulta.
          </small>
        )}
      </div>
    </div>
  );
}
