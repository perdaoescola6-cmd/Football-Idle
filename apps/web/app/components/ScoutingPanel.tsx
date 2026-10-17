"use client";
import { useState } from "react";
import type {
  GameView,
  ScoutRule,
  ScoutingConfig,
  ScoutCondition,
} from "../../../../packages/contracts/index";
import { defaultScouting } from "../../../../packages/game/scouting";
import { naturalOvr } from "../../../../packages/contracts/roster";
import { SceneBanner } from "./PixelArt";
import { AthleteDialog } from "./Roster";
import type { SendAction } from "./CollectionPanel";
const labels: Record<ScoutCondition["field"], string> = {
  rarity: "Potencial P",
  position: "Posição",
  potential: "Teto natural OVR",
  birthOvr: "OVR de nascimento",
  finishing: "Teto de finalização",
  passing: "Teto de passe",
  control: "Teto de controle",
  pace: "Teto de velocidade",
  marking: "Teto de marcação",
  defending: "Teto de defesa",
};
export function ScoutingPanel({
  game: g,
  disabled,
  send,
  now,
}: {
  game: GameView;
  disabled: boolean;
  send: SendAction;
  now: number;
}) {
  const [config, setConfig] = useState<ScoutingConfig>(() =>
      structuredClone(g.gameplay.scouting ?? defaultScouting()),
    ),
    [detail, setDetail] = useState<string | null>(null),
    [dirty, setDirty] = useState(false);
  const change = (next: ScoutingConfig) => {
    setConfig(next);
    setDirty(true);
  };
  const patch = (id: string, part: Partial<ScoutRule>) =>
    change({
      ...config,
      rules: config.rules.map((r) => (r.id === id ? { ...r, ...part } : r)),
    });
  const condition = (r: ScoutRule, i: number, p: Partial<ScoutCondition>) =>
    patch(r.id, {
      conditions: r.conditions.map((c, j) => (i === j ? { ...c, ...p } : c)),
    });
  const move = (index: number, delta: number) => {
    const rules = [...config.rules];
    [rules[index], rules[index + delta]] = [rules[index + delta], rules[index]];
    change({ ...config, rules });
  };
  const athlete = g.athletes.find((a) => a.id === detail),
    starters = g.athletes.filter((a) => g.lineup.athleteIds.includes(a.id));
  return (
    <>
      <SceneBanner
        scene="scout"
        title="Departamento de scouting"
        subtitle="Matias avalia cada descoberta. Você decide o que merece ficar."
      />
      <div className="scout-layout">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AVALIAÇÃO AUTOMÁTICA · GRATUITA</p>
              <h2>Regras de descoberta</h2>
            </div>
            <span className="tag">NÃO VENDE ATLETAS</span>
          </div>
          <p className="muted">
            A primeira regra compatível decide o destino do novo drop. P5 é
            sempre guardado na Coleção e protegido. As chances de encontrar
            atletas continuam iguais.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => change({ ...config, enabled: e.target.checked })}
            />
            Ativar avaliador automático
          </label>
          <div className="scout-controls">
            <label>
              Quando nenhuma regra combinar
              <select
                value={config.fallback}
                onChange={(e) =>
                  change({
                    ...config,
                    fallback: e.target.value as "DEPOT" | "COLLECTION",
                  })
                }
              >
                <option value="DEPOT">Enviar ao Depósito</option>
                <option value="COLLECTION">Guardar na Coleção</option>
              </select>
            </label>
            <label>
              Alerta de teto natural alto
              <input
                type="number"
                min="0"
                max="99"
                value={config.rareWarningPotential}
                onChange={(e) =>
                  change({
                    ...config,
                    rareWarningPotential: Math.max(
                      0,
                      Math.min(99, Number(e.target.value)),
                    ),
                  })
                }
              />
            </label>
          </div>
          <div className="scout-presets">
            <button
              className="secondary"
              onClick={() => change(defaultScouting())}
            >
              Preset: raros + teto 70
            </button>
            <button
              className="secondary"
              onClick={() =>
                change({
                  ...defaultScouting(),
                  fallback: "COLLECTION",
                  rules: [],
                })
              }
            >
              Preset: guardar todos
            </button>
          </div>
          {config.rules.map((r, index) => (
            <article className="scout-rule" key={r.id}>
              <div className="rule-heading">
                <span className="rule-order">{index + 1}</span>
                <input
                  aria-label={`Nome da regra ${index + 1}`}
                  value={r.name}
                  maxLength={80}
                  onChange={(e) => patch(r.id, { name: e.target.value })}
                />
                <button
                  className="secondary"
                  disabled={!index}
                  aria-label={`Subir regra ${index + 1}`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="secondary"
                  disabled={index === config.rules.length - 1}
                  aria-label={`Descer regra ${index + 1}`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  className="text-button"
                  aria-label={`Excluir regra ${index + 1}`}
                  onClick={() =>
                    change({
                      ...config,
                      rules: config.rules.filter((x) => x.id !== r.id),
                    })
                  }
                >
                  ✕
                </button>
              </div>
              <div className="rule-options">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => patch(r.id, { enabled: e.target.checked })}
                  />
                  Ativa
                </label>
                <label>
                  Condições
                  <select
                    value={r.mode}
                    onChange={(e) =>
                      patch(r.id, { mode: e.target.value as "ALL" | "ANY" })
                    }
                  >
                    <option value="ALL">Todas (E)</option>
                    <option value="ANY">Qualquer (OU)</option>
                  </select>
                </label>
                <label>
                  Destino
                  <select
                    value={r.destination}
                    onChange={(e) =>
                      patch(r.id, {
                        destination: e.target.value as "COLLECTION" | "DEPOT",
                      })
                    }
                  >
                    <option value="COLLECTION">Coleção</option>
                    <option value="DEPOT">Depósito</option>
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={r.protect}
                    onChange={(e) => patch(r.id, { protect: e.target.checked })}
                  />
                  Proteger
                </label>
              </div>
              {r.conditions.map((c, i) => (
                <div className="rule-condition" key={i}>
                  <select
                    aria-label={`Campo ${i + 1} da regra ${index + 1}`}
                    value={c.field}
                    onChange={(e) =>
                      condition(r, i, {
                        field: e.target.value as ScoutCondition["field"],
                        op: "EQ",
                        value:
                          e.target.value === "rarity"
                            ? "P4"
                            : e.target.value === "position"
                              ? "GOL"
                              : "70",
                      })
                    }
                  >
                    {Object.entries(labels).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Operador ${i + 1} da regra ${index + 1}`}
                    value={c.op}
                    onChange={(e) =>
                      condition(r, i, {
                        op: e.target.value as ScoutCondition["op"],
                      })
                    }
                  >
                    <option value="EQ">igual</option>
                    {!["rarity", "position"].includes(c.field) ? (
                      <>
                        <option value="GTE">pelo menos</option>
                        <option value="LTE">no máximo</option>
                      </>
                    ) : null}
                  </select>
                  {c.field === "rarity" || c.field === "position" ? (
                    <select
                      aria-label={`Valor ${i + 1} da regra ${index + 1}`}
                      value={c.value}
                      onChange={(e) =>
                        condition(r, i, { value: e.target.value })
                      }
                    >
                      {(c.field === "rarity"
                        ? ["P1", "P2", "P3", "P4", "P5"]
                        : ["GOL", "ZAG", "MEI", "ATA"]
                      ).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={`Valor ${i + 1} da regra ${index + 1}`}
                      type="number"
                      min="0"
                      max="99"
                      value={c.value}
                      onChange={(e) =>
                        condition(r, i, { value: e.target.value })
                      }
                    />
                  )}
                  <button
                    className="text-button"
                    disabled={r.conditions.length <= 1}
                    aria-label={`Excluir condição ${i + 1} da regra ${index + 1}`}
                    onClick={() =>
                      patch(r.id, {
                        conditions: r.conditions.filter((_, j) => j !== i),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                disabled={r.conditions.length >= 12}
                onClick={() =>
                  patch(r.id, {
                    conditions: [
                      ...r.conditions,
                      { field: "potential", op: "GTE", value: "70" },
                    ],
                  })
                }
              >
                ＋ condição
              </button>
            </article>
          ))}
          <div className="scout-presets">
            <button
              className="secondary"
              disabled={config.rules.length >= 40}
              onClick={() =>
                change({
                  ...config,
                  rules: [
                    ...config.rules,
                    {
                      id: crypto.randomUUID(),
                      name: "Nova regra",
                      enabled: true,
                      mode: "ALL",
                      conditions: [
                        { field: "potential", op: "GTE", value: "70" },
                      ],
                      destination: "COLLECTION",
                      protect: false,
                    },
                  ],
                })
              }
            >
              ＋ Adicionar regra
            </button>
            <button
              disabled={
                disabled || !dirty || config.rules.some((r) => !r.name.trim())
              }
              onClick={async () => {
                const result = await send("/scouting/config", { config });
                if (result) setDirty(false);
              }}
            >
              Salvar regras {dirty ? "●" : ""}
            </button>
          </div>
          <p className="small muted">
            Regras valem apenas para novos drops online; organização manual e
            atletas já existentes são preservados.
          </p>
          {g.gameplay.scout ? (
            <div className="message">
              <p>
                Você possui uma busca paga da versão anterior. Ela continua
                disponível para resgate.
              </p>
              <button
                disabled={disabled || now < g.gameplay.scout.readyAt}
                onClick={() =>
                  void send("/club/command", { action: "SCOUT_CLAIM" })
                }
              >
                Resgatar busca já paga
              </button>
            </div>
          ) : null}
        </section>
        <aside className="panel discoveries">
          <p className="eyebrow">RELATÓRIO DO OLHEIRO</p>
          <h2>Descobertas recentes</h2>
          {g.gameplay.discoveries?.length ? (
            g.gameplay.discoveries.slice(0, 30).map((d, i) => {
              const a = g.athletes.find((a) => a.id === d.athleteId),
                best = a ? Math.max(...starters.map((s) => naturalOvr(s))) : 0;
              return (
                <article
                  className={`discovery discovery-${d.rarity}`}
                  key={`${d.athleteId}:${i}`}
                >
                  <span className={`rarity rarity-${d.rarity}`}>
                    {d.rarity}
                  </span>
                  <h3>{d.name}</h3>
                  <p>
                    {d.storage === "COLLECTION" ? "Coleção" : "Depósito"} ·{" "}
                    {d.reason}
                  </p>
                  {a ? (
                    <>
                      <small>
                        Teto {naturalOvr(a)} ·{" "}
                        {naturalOvr(a) > best
                          ? "Pode superar o teto do melhor titular"
                          : "Compare com seu elenco por posição"}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => setDetail(a.id)}
                      >
                        Abrir e comparar →
                      </button>
                    </>
                  ) : (
                    <small>Atleta já negociado</small>
                  )}
                </article>
              );
            })
          ) : (
            <p className="empty-state">
              Os próximos atletas encontrados no farm aparecerão aqui, com a
              regra que decidiu seu destino.
            </p>
          )}
          <p className="small muted">
            Até 200 decisões recentes são mantidas. P5 recebe proteção
            obrigatória na descoberta.
          </p>
        </aside>
      </div>
      {athlete ? (
        <AthleteDialog
          clubName={g.club.name}
          athlete={athlete}
          onClose={() => setDetail(null)}
          compare={starters}
        />
      ) : null}
    </>
  );
}
