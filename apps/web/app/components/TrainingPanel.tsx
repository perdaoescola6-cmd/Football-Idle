"use client";
import { useState } from "react";
import type { GameView } from "../../../../packages/contracts/index";
import { attributeKeys } from "../../../../packages/contracts/index";
import {
  naturalOvr,
  unavailableReason,
} from "../../../../packages/contracts/roster";
import { threshold } from "../../../../packages/game/rules";
import { alphaParameters as p } from "../../../../packages/contracts/world";
import { SceneBanner } from "./PixelArt";
import { AthleteCard, AthleteDialog } from "./Roster";
import type { SendAction } from "./CollectionPanel";
export function TrainingPanel({
  game: g,
  disabled,
  send,
}: {
  game: GameView;
  disabled: boolean;
  send: SendAction;
}) {
  const [chosen, setChosen] = useState(""),
    [detail, setDetail] = useState<string | null>(null),
    training = g.gameplay.training;
  const context = {
    lineup: g.lineup.athleteIds,
    training: training.map((t) => t.athleteId),
    locked: g.market
      .filter((l) => l.sellerId === g.club.id)
      .map((l) => l.athlete.id),
    active: g.currentMatch?.home.map((a) => a.id) ?? [],
  };
  const available = g.athletes.filter(
      (a) => !unavailableReason({ ...a, protected: false }, context),
    ),
    selected = available.find((a) => a.id === chosen) ?? available[0],
    focused = g.athletes.find((a) => a.id === detail),
    active = training.filter((t) => !t.paused && t.status !== "CAPPED");
  return (
    <>
      <SceneBanner
        scene="training"
        title="Centro de desenvolvimento"
        subtitle="Reservas de hoje. Titulares de amanhã."
      />
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PLANEJE O FUTURO DO ELENCO</p>
            <h2>
              {training.length} / {g.gameplay.trainingSlots} vagas ocupadas
            </h2>
          </div>
          <span className="tag">ATÉ 5 VAGAS</span>
        </div>
        <div className="training-facts">
          <span>
            <b>{p.trainingCost * 60} Coins/h</b>por atleta em treino efetivo
          </span>
          <span>
            <b>{p.trainingXp * 60} XP/h online</b>eficiência menor que o farm
          </span>
          <span>
            <b>50% de XP offline</b>com crédito renovado do clube
          </span>
          <span>
            <b>
              {BigInt(g.wallet.available ?? g.wallet.balance) >=
              BigInt(p.trainingCost)
                ? active.length * p.trainingCost * 60
                : 0}{" "}
              Coins/h
            </b>
            custo atual estimado do CT
          </span>
        </div>
        <div className="training-grid">
          {Array.from({ length: g.gameplay.trainingSlots }, (_, i) => {
            const t = training[i],
              a = g.athletes.find((a) => a.id === t?.athleteId);
            if (!t || !a)
              return (
                <div className="training-slot" key={i}>
                  <p className="eyebrow">VAGA {i + 1}</p>
                  <div className="training-empty">＋</div>
                  <h3>Pronto para um reserva</h3>
                  <p className="muted small">Sem manutenção enquanto vazio.</p>
                </div>
              );
            const distance = Math.max(
                ...attributeKeys.map((k) => a.caps[k] - a.attributes[k]),
              ),
              capped = distance === 0,
              need =
                threshold(BigInt(a.level) + BigInt(distance)) -
                BigInt(a.xpTotal),
              minutes =
                need > 0n
                  ? (need + BigInt(p.trainingXp) - 1n) / BigInt(p.trainingXp)
                  : 0n,
              status = capped
                ? "TETO ATINGIDO"
                : t.paused
                  ? "PAUSADO"
                  : t.status === "NO_COINS"
                    ? "PAUSADO · SEM COINS"
                    : "EM DESENVOLVIMENTO";
            return (
              <article className="training-slot occupied" key={i}>
                <p className="eyebrow">VAGA {i + 1}</p>
                <AthleteCard
                  clubName={g.club.name}
                  athlete={a}
                  onClick={() => setDetail(a.id)}
                />
                <div className="training-status">{status}</div>
                <progress
                  value={a.ovr}
                  max={Math.max(1, naturalOvr(a))}
                  aria-label={`Desenvolvimento de ${a.displayName}`}
                />
                <p className="small">
                  OVR {a.ovr} / {naturalOvr(a)} teto · {t.paidSteps} ciclos
                  pagos
                </p>
                <p className="small muted">
                  {capped
                    ? "Sem cobrança após o teto."
                    : `Até os tetos: ~${minutes.toLocaleString("pt-BR")} min online elegíveis. Estimativa sem refinamento.`}
                </p>
                <div className="row-actions">
                  <button
                    className="secondary"
                    disabled={disabled || capped}
                    onClick={() =>
                      void send("/roster/action", {
                        action: t.paused ? "TRAIN_RESUME" : "TRAIN_PAUSE",
                        athleteId: a.id,
                      })
                    }
                  >
                    {t.paused ? "Retomar" : "Pausar"}
                  </button>
                  <button
                    className="secondary"
                    disabled={disabled}
                    onClick={() =>
                      void send("/club/command", {
                        action: "TRAIN_STOP",
                        athleteId: a.id,
                      })
                    }
                  >
                    Liberar vaga
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hub-controls">
          <label>
            Reserva para desenvolvimento
            <select
              value={selected?.id ?? ""}
              onChange={(e) => setChosen(e.target.value)}
            >
              <option value="" disabled>
                Escolha um reserva livre
              </option>
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} · OVR {a.ovr} → {naturalOvr(a)} ·{" "}
                  {a.protected ? "protegido" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={
              disabled ||
              !selected ||
              training.length >= g.gameplay.trainingSlots
            }
            onClick={() =>
              void send("/club/command", {
                action: "TRAIN_START",
                athleteId: selected?.id,
              })
            }
          >
            Iniciar desenvolvimento
          </button>
          <button
            className="secondary"
            disabled={
              disabled ||
              g.gameplay.trainingSlots >= 5 ||
              BigInt(g.wallet.available ?? g.wallet.balance) <
                BigInt(p.trainingSlotCost)
            }
            onClick={() =>
              void send("/club/command", { action: "TRAIN_EXPAND" })
            }
          >
            Ampliar · {p.trainingSlotCost} Coins
          </button>
        </div>
        <p className="small muted">
          Somente reservas fora da partida e do mercado. Atletas protegidos
          podem treinar. Pausar ou atingir o teto interrompe a manutenção.
          Refinamento ainda não possui custo ou efeito aprovado.
        </p>
      </section>
      {focused ? (
        <AthleteDialog
          clubName={g.club.name}
          athlete={focused}
          onClose={() => setDetail(null)}
          compare={g.athletes.filter((a) => g.lineup.athleteIds.includes(a.id))}
        />
      ) : null}
    </>
  );
}
