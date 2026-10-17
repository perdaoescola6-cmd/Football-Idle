"use client";
import { useEffect, useState } from "react";
import type { GameView } from "../../../../packages/contracts/index";
export function ClubJournal({ game: g }: { game: GameView }) {
  const career = g.career ?? {
      matches: "0",
      wins: "0",
      draws: "0",
      losses: "0",
      goals: "0",
      coins: "0",
      drops: "0",
    },
    [baseline, setBaseline] = useState(career),
    storageKey = `fi-session-v2:${g.club.id}`;
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const saved = JSON.parse(stored);
        if (
          ["matches", "coins", "drops"].every(
            (k) => typeof saved[k] === "string" && /^\d+$/.test(saved[k]),
          )
        )
          setBaseline(saved);
      } else sessionStorage.setItem(storageKey, JSON.stringify(career));
    } catch {
      /* Storage is optional. */
    }
  }, [storageKey]);
  const reset = () => {
    setBaseline({ ...career });
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(career));
    } catch {
      /* Storage is optional. */
    }
  };
  const badges = [
    {
      title: "Primeiro apito",
      detail: "Uma partida concluída",
      earned: BigInt(career.matches) >= 1n,
    },
    {
      title: "Camisa de dez",
      detail: "Dez vitórias",
      earned: BigInt(career.wins) >= 10n,
    },
    {
      title: "Olho no talento",
      detail: "Dez atletas encontrados no farm",
      earned: BigInt(career.drops) >= 10n,
    },
    {
      title: "Clube regional",
      detail: "Nível 12 permanente",
      earned: BigInt(g.club.level) >= 12n,
    },
    {
      title: "Clube centenário",
      detail: "Cem partidas concluídas",
      earned: BigInt(career.matches) >= 100n,
    },
    {
      title: "A elite espera",
      detail: "Circuito Elite liberado",
      earned: BigInt(g.club.level) >= 1100n,
    },
  ];
  const highlights = g.recentMatches
    .flatMap((m) =>
      m.events
        .filter(
          (e) =>
            e.type === "SHOT_RESOLVED" &&
            e.payload.outcome === "GOAL" &&
            e.payload.team === "HOME",
        )
        .map((e) => ({
          id: m.id + ":" + e.sequence,
          name:
            m.home.find((a) => a.id === e.payload.actorId)?.displayName ??
            "Atleta",
          minute: e.offsetMs / 1000,
          sequence: m.sequence,
        })),
    )
    .slice(0, 5);
  return (
    <section className="panel club-journal">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DIÁRIO DO CLUBE</p>
          <h2>Uma história em construção</h2>
        </div>
        <button className="text-button" onClick={reset}>
          Reiniciar medição da sessão
        </button>
      </div>
      <div className="session-statistics">
        <span>
          <b>{String(BigInt(career.matches) - BigInt(baseline.matches))}</b>
          jogos nesta sessão
        </span>
        <span>
          <b>{String(BigInt(career.coins) - BigInt(baseline.coins))}</b>Coins de
          partidas
        </span>
        <span>
          <b>{String(BigInt(career.drops) - BigInt(baseline.drops))}</b>
          descobertas do farm
        </span>
        <span>
          <b>{career.wins}</b>vitórias na história
        </span>
      </div>
      <div className="club-badges">
        {badges.map((b) => (
          <div className={b.earned ? "earned" : ""} key={b.title}>
            <span>{b.earned ? "★" : "☆"}</span>
            <b>{b.title}</b>
            <small>{b.detail}</small>
          </div>
        ))}
      </div>
      <div className="journal-highlights">
        <h3>Melhores lances dos últimos jogos</h3>
        {highlights.length ? (
          highlights.map((h) => (
            <p key={h.id}>
              <b>GOL</b> {h.name} · {h.minute}′ · partida #{h.sequence}
            </p>
          ))
        ) : (
          <p className="muted">Os gols do seu clube aparecerão aqui.</p>
        )}
      </div>
      <p className="small muted">
        Marcos de reconhecimento, sem Coins ou materiais adicionais. O farm
        continua durante a navegação.
      </p>
    </section>
  );
}
