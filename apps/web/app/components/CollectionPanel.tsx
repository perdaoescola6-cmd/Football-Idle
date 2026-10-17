"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Athlete,
  AthleteFilter,
  GameView,
  SaleQuote,
} from "../../../../packages/contracts/index";
import {
  matchesFilter,
  naturalOvr,
  npcPrice,
  unavailableReason,
} from "../../../../packages/contracts/roster";
import { regions } from "../../../../packages/contracts/world";
import { AthleteCard, AthleteDialog } from "./Roster";
import { PixelPortrait, SceneBanner } from "./PixelArt";
export type SendAction = (
  path: string,
  body: Record<string, unknown>,
) => Promise<any>;
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="operation-dialog"
      onCancel={onClose}
      aria-label={title}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button
          className="secondary"
          autoFocus
          onClick={onClose}
          aria-label="Fechar confirmação"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function CollectionPanel({
  game: g,
  disabled,
  send,
  depot = false,
}: {
  game: GameView;
  disabled: boolean;
  send: SendAction;
  depot?: boolean;
}) {
  const [filter, setFilter] = useState<AthleteFilter>({
      storage: depot ? "DEPOT" : "COLLECTION",
    }),
    [sort, setSort] = useState("potential"),
    [mode, setMode] = useState("list"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [detail, setDetail] = useState<string | null>(null),
    [unlock, setUnlock] = useState<Athlete | null>(null),
    [quote, setQuote] = useState<SaleQuote | null>(null),
    [ack, setAck] = useState(false),
    [allFiltered, setAllFiltered] = useState(false),
    [listing, setListing] = useState<Athlete | null>(null),
    [price, setPrice] = useState("100"),
    [days, setDays] = useState(7);
  const owned = useMemo(
    () => new Map(g.athletes.map((a) => [a.id, a])),
    [g.athletes],
  );
  const context = useMemo(
    () => ({
      lineup: g.lineup.athleteIds,
      training: g.gameplay.training.map((t) => t.athleteId),
      active: g.currentMatch?.home.map((a) => a.id) ?? [],
      locked: g.market
        .filter((l) => l.sellerId === g.club.id)
        .map((l) => l.athlete.id),
    }),
    [
      g.lineup.athleteIds.join(),
      g.gameplay.training.map((t) => t.athleteId).join(),
      g.currentMatch?.id,
      g.market
        .filter((l) => l.sellerId === g.club.id)
        .map((l) => l.athlete.id)
        .join(),
    ],
  );
  const visible = useMemo(
    () =>
      g.athletes
        .filter((a) => matchesFilter(a, filter, context))
        .sort((a, b) =>
          sort === "name"
            ? a.displayName.localeCompare(b.displayName)
            : sort === "ovr"
              ? b.ovr - a.ovr
              : sort === "level"
                ? BigInt(a.level) > BigInt(b.level)
                  ? -1
                  : BigInt(a.level) < BigInt(b.level)
                    ? 1
                    : 0
                : naturalOvr(b) - naturalOvr(a),
        ),
    [g.athletes, filter, context, sort],
  );
  const size = mode === "list" ? 50 : 12,
    pages = Math.max(1, Math.ceil(visible.length / size)),
    current = Math.min(page, pages - 1),
    items = visible.slice(current * size, (current + 1) * size),
    focused = g.athletes.find((a) => a.id === detail),
    starters = g.lineup.athleteIds
      .map((id) => g.athletes.find((a) => a.id === id)!)
      .filter(Boolean);
  const update = (key: keyof AthleteFilter, value: unknown) => {
    setFilter((f) => ({
      ...f,
      [key]: value === undefined || value === "" ? undefined : value,
    }));
    setPage(0);
    setSelected(new Set());
    setAllFiltered(false);
  };
  const select = (ids: string[], all = false) => {
    setAllFiltered(all);
    setSelected(
      new Set(
        ids.filter((id) => {
          const a = owned.get(id);
          return a && !unavailableReason(a, context);
        }),
      ),
    );
  };
  const selectedValue = g.athletes
    .filter((a) => selected.has(a.id))
    .reduce((s, a) => s + BigInt(npcPrice(a)), 0n);
  const action = async (
    a: Athlete,
    name: string,
    extra: Record<string, unknown> = {},
  ) => {
    await send("/roster/action", { action: name, athleteId: a.id, ...extra });
  };
  return (
    <>
      <SceneBanner
        scene="locker"
        title={depot ? "Depósito de atletas" : "Vestiário do clube"}
        subtitle={`${g.athletes.filter((a) => (a.storage ?? "COLLECTION") === (depot ? "DEPOT" : "COLLECTION")).length} atletas · espaço sem limite fixo · decisões sob seu controle`}
      />
      <section className="panel collection-manager">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {depot ? "RESERVAS PARA AVALIAÇÃO" : "COLEÇÃO E DESENVOLVIMENTO"}
            </p>
            <h2>{visible.length} atletas encontrados</h2>
          </div>
          <div className="segmented">
            <button
              className={mode === "list" ? "" : "secondary"}
              onClick={() => {
                setMode("list");
                setPage(0);
              }}
            >
              Lista
            </button>
            <button
              className={mode === "cards" ? "" : "secondary"}
              onClick={() => {
                setMode("cards");
                setPage(0);
              }}
            >
              Cartas
            </button>
          </div>
        </div>
        <div className="roster-filters">
          <label>
            Nome
            <input
              value={filter.search ?? ""}
              onChange={(e) => update("search", e.target.value)}
              placeholder="Buscar nome…"
            />
          </label>
          <label>
            Posição
            <select
              value={filter.position ?? ""}
              onChange={(e) => update("position", e.target.value)}
            >
              <option value="">Todas</option>
              {["GOL", "ZAG", "MEI", "ATA"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Potencial P
            <select
              value={filter.rarity ?? ""}
              onChange={(e) => update("rarity", e.target.value)}
            >
              <option value="">P1–P5</option>
              {["P1", "P2", "P3", "P4", "P5"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Local
            <select
              value={filter.storage ?? ""}
              onChange={(e) => update("storage", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="COLLECTION">Coleção</option>
              <option value="DEPOT">Depósito</option>
            </select>
          </label>
          <label>
            Teto mínimo
            <input
              type="number"
              min="0"
              max="99"
              value={filter.minPotential ?? ""}
              onChange={(e) =>
                update(
                  "minPotential",
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            OVR máximo
            <input
              type="number"
              min="0"
              max="99"
              value={filter.maxOvr ?? ""}
              onChange={(e) =>
                update(
                  "maxOvr",
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Ordenar
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="potential">Maior teto natural</option>
              <option value="ovr">Maior OVR</option>
              <option value="level">Maior nível</option>
              <option value="name">Nome</option>
            </select>
          </label>
        </div>
        <details className="advanced-filters">
          <summary>Mais filtros combináveis</summary>
          <div className="roster-filters">
            <label>
              OVR mínimo
              <input
                type="number"
                min="0"
                max="99"
                value={filter.minOvr ?? ""}
                onChange={(e) =>
                  update(
                    "minOvr",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>
            <label>
              Teto máximo
              <input
                type="number"
                min="0"
                max="99"
                value={filter.maxPotential ?? ""}
                onChange={(e) =>
                  update(
                    "maxPotential",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>
            <label>
              Nível mínimo
              <input
                inputMode="numeric"
                value={filter.minLevel ?? ""}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value))
                    update("minLevel", e.target.value.replace(/^0+/, ""));
                }}
              />
            </label>
            <label>
              Nível máximo
              <input
                inputMode="numeric"
                value={filter.maxLevel ?? ""}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value))
                    update("maxLevel", e.target.value.replace(/^0+/, ""));
                }}
              />
            </label>
            <label>
              Região de origem
              <select
                value={filter.region ?? ""}
                onChange={(e) => update("region", e.target.value)}
              >
                <option value="">Todas / legado</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Escalação
              <select
                value={filter.role ?? "ALL"}
                onChange={(e) => update("role", e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="BENCH">Reservas</option>
                <option value="STARTER">Titulares</option>
              </select>
            </label>
            <label>
              Proteção
              <select
                value={
                  filter.protected === undefined ? "" : String(filter.protected)
                }
                onChange={(e) =>
                  update(
                    "protected",
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  )
                }
              >
                <option value="">Todas</option>
                <option value="true">Protegidos</option>
                <option value="false">Sem proteção</option>
              </select>
            </label>
          </div>
        </details>
        <div className="bulk-toolbar">
          <button
            className="secondary"
            onClick={() => select(items.map((a) => a.id))}
          >
            Selecionar página
          </button>
          <button
            className="secondary"
            onClick={() =>
              select(
                visible.map((a) => a.id),
                true,
              )
            }
          >
            Selecionar todos do filtro
          </button>
          <button
            className="text-button"
            onClick={() => setSelected(new Set())}
          >
            Desmarcar
          </button>
          <strong>
            {selected.size} selecionados · {selectedValue.toString()} Coins
          </strong>
          <button
            disabled={disabled || !selected.size}
            onClick={async () => {
              const q = await send(
                "/roster/sell/preview",
                allFiltered ? { filter } : { ids: [...selected] },
              );
              if (q) {
                setAck(false);
                setQuote(q);
              }
            }}
          >
            Revisar venda ao NPC
          </button>
        </div>
        <p className="small muted">
          Titulares, protegidos, atletas em treino, em partida ou anunciados
          ficam fora da seleção de venda. Preço NPC fixado no nascimento.
        </p>
        {mode === "list" ? (
          <div className="table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Sel.</th>
                  <th>Atleta</th>
                  <th>Pos.</th>
                  <th>P</th>
                  <th>OVR / teto</th>
                  <th>Nível</th>
                  <th>NPC</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const reason = unavailableReason(a, context);
                  return (
                    <tr
                      key={a.id}
                      className={selected.has(a.id) ? "row-selected" : ""}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          disabled={!!reason}
                          title={reason ?? "Selecionar para venda"}
                          aria-label={`Selecionar ${a.displayName}`}
                          onChange={(e) => {
                            setAllFiltered(false);
                            setSelected((old) => {
                              const n = new Set(old);
                              e.target.checked ? n.add(a.id) : n.delete(a.id);
                              return n;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button
                          className="athlete-name"
                          onClick={() => setDetail(a.id)}
                        >
                          <PixelPortrait athlete={a} />
                          <span>
                            <b>{a.displayName}</b>
                            <small>
                              {reason ??
                                (a.storage === "DEPOT"
                                  ? "Depósito"
                                  : "Coleção")}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>{a.position}</td>
                      <td>
                        <span className={`rarity rarity-${a.rarity}`}>
                          {a.rarity}
                        </span>
                      </td>
                      <td>
                        {a.ovr} <span className="muted">/ {naturalOvr(a)}</span>
                      </td>
                      <td>{a.level}</td>
                      <td>{npcPrice(a)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="secondary"
                            disabled={disabled}
                            aria-label={`${a.protected ? "Desbloquear" : "Proteger"} ${a.displayName}`}
                            onClick={() =>
                              a.protected
                                ? setUnlock(a)
                                : void action(a, "PROTECT")
                            }
                          >
                            {a.protected ? "▣" : "▢"}
                          </button>
                          <button
                            className="secondary"
                            disabled={
                              disabled ||
                              !!unavailableReason(
                                { ...a, protected: false },
                                context,
                              )
                            }
                            title="Mover entre Coleção e Depósito"
                            onClick={() =>
                              void action(
                                a,
                                a.storage === "DEPOT" ? "COLLECTION" : "DEPOT",
                              )
                            }
                          >
                            {a.storage === "DEPOT" ? "↑" : "↓"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="athlete-grid">
            {items.map((a) => (
              <article className="selectable-card" key={a.id}>
                <label className="card-selection">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    disabled={!!unavailableReason(a, context)}
                    onChange={(e) =>
                      setSelected((old) => {
                        const n = new Set(old);
                        e.target.checked ? n.add(a.id) : n.delete(a.id);
                        return n;
                      })
                    }
                  />
                  Selecionar · {npcPrice(a)} Coins
                </label>
                <AthleteCard
                  clubName={g.club.name}
                  athlete={a}
                  starter={g.lineup.athleteIds.includes(a.id)}
                  onClick={() => setDetail(a.id)}
                />
                <button
                  className="secondary full"
                  disabled={disabled}
                  onClick={() =>
                    a.protected ? setUnlock(a) : void action(a, "PROTECT")
                  }
                >
                  {a.protected ? "▣ Desbloquear" : "▢ Proteger"}
                </button>
              </article>
            ))}
          </div>
        )}
        {!items.length ? (
          <p className="empty-state">
            Nenhum atleta com estes filtros. O olheiro pode encaminhar novas
            descobertas para este local.
          </p>
        ) : null}
        <div className="pagination">
          <button
            className="secondary"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </button>
          <span>
            Página {current + 1} / {pages} · {size} por página
          </span>
          <button
            className="secondary"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </button>
        </div>
      </section>
      {focused ? (
        <>
          <AthleteDialog
            clubName={g.club.name}
            athlete={focused}
            onClose={() => setDetail(null)}
            compare={starters}
          >
            <div className="row-actions detail-actions">
              <button
                className="secondary"
                disabled={disabled}
                onClick={() =>
                  focused.protected
                    ? (setDetail(null), setUnlock(focused))
                    : void action(focused, "PROTECT")
                }
              >
                {focused.protected ? "Desbloquear" : "Proteger"}
              </button>
              <button
                className="secondary"
                disabled={
                  disabled ||
                  !!unavailableReason({ ...focused, protected: false }, context)
                }
                onClick={async () => {
                  await action(
                    focused,
                    focused.storage === "DEPOT" ? "COLLECTION" : "DEPOT",
                  );
                  setDetail(null);
                }}
              >
                Mover para{" "}
                {focused.storage === "DEPOT" ? "Coleção" : "Depósito"}
              </button>
              <button
                disabled={
                  disabled ||
                  g.gameplay.training.length >= g.gameplay.trainingSlots ||
                  !!unavailableReason({ ...focused, protected: false }, context)
                }
                onClick={async () => {
                  const result = await send("/club/command", {
                    action: "TRAIN_START",
                    athleteId: focused.id,
                  });
                  if (result) setDetail(null);
                }}
              >
                Treinar reserva no CT
              </button>
              <button
                className="secondary"
                disabled={
                  disabled ||
                  g.testMode.used ||
                  !focused.tradeEligible ||
                  !!unavailableReason(focused, context)
                }
                onClick={() => {
                  setListing(focused);
                  setDetail(null);
                }}
              >
                Anunciar no P2P
              </button>
            </div>
          </AthleteDialog>
        </>
      ) : null}
      {listing ? (
        <Modal
          title={`Anunciar ${listing.displayName}`}
          onClose={() => setListing(null)}
        >
          <p>
            Preço livre. Comissão de 15% na venda. O atleta ficará indisponível
            enquanto anunciado.
          </p>
          <label>
            Preço em Coins
            <input
              inputMode="numeric"
              value={price}
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
                <option value={d} key={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </label>
          {/^[1-9]\d*$/.test(price) ? (
            <p>
              Líquido estimado:{" "}
              {(BigInt(price) - (BigInt(price) * 15n + 99n) / 100n).toString()}{" "}
              Coins
            </p>
          ) : null}
          <button
            disabled={disabled || !/^[1-9]\d*$/.test(price)}
            onClick={async () => {
              const result = await send("/market/command", {
                action: "LIST",
                athleteId: listing.id,
                price,
                days,
              });
              if (result) setListing(null);
            }}
          >
            Confirmar anúncio
          </button>
        </Modal>
      ) : null}
      {unlock ? (
        <Modal
          title={`Desbloquear ${unlock.displayName}`}
          onClose={() => setUnlock(null)}
        >
          <p>
            Sem o cadeado, este atleta poderá ser selecionado para venda.
            Desbloquear não vende o atleta.
          </p>
          <button
            className="danger"
            disabled={disabled}
            onClick={async () => {
              await action(unlock, "UNPROTECT", { confirmed: true });
              setUnlock(null);
            }}
          >
            Confirmar desbloqueio de {unlock.displayName}
          </button>
        </Modal>
      ) : null}
      {quote ? (
        <Modal title="Revisar venda em lote" onClose={() => setQuote(null)}>
          <p>
            <strong>
              {quote.athletes.length} atletas · {quote.total} Coins
            </strong>
          </p>
          <p className="muted">
            {quote.excluded.length} excluídos por segurança. A operação será
            revalidada ao confirmar.
          </p>
          <div className="sale-review-list">
            {quote.athletes.map((a) => (
              <div key={a.id}>
                <span>
                  {a.name}
                  {a.warning ? " · ⚠ talento de alto potencial" : ""}
                </span>
                <b>{a.price} Coins</b>
              </div>
            ))}
          </div>
          {quote.warnings ? (
            <label className="check-label">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              Entendo que a seleção contém {quote.warnings} talentos raros ou de
              alto teto.
            </label>
          ) : null}
          <button
            className="danger full"
            disabled={
              disabled || !quote.athletes.length || (!!quote.warnings && !ack)
            }
            onClick={async () => {
              const result = await send("/roster/sell/commit", {
                quoteId: quote.id,
                confirmed: true,
                acknowledgeRare: ack,
              });
              if (result) {
                setSelected(new Set());
                setQuote(null);
              }
            }}
          >
            Confirmar venda de {quote.athletes.length} atletas por {quote.total}{" "}
            Coins
          </button>
          <p className="small muted">
            Nenhum atleta é vendido automaticamente. Prévia válida por cinco
            minutos.
          </p>
        </Modal>
      ) : null}
    </>
  );
}
