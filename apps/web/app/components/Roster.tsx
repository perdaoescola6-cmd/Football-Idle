"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Athlete } from "../../../../packages/contracts/index";
import {
  attributeKeys,
  attributeLabels,
} from "../../../../packages/contracts/index";
import { naturalOvr, npcPrice } from "../../../../packages/contracts/roster";
import { PixelPortrait } from "./PixelArt";
export function Portrait({ athlete }: { athlete: Athlete }) {
  return <PixelPortrait athlete={athlete} />;
}
export function AthleteCard({
  athlete: a,
  starter,
  onClick,
  staticCard = false,
  clubName,
}: {
  athlete: Athlete;
  starter?: boolean;
  onClick?: () => void;
  staticCard?: boolean;
  clubName?: string;
}) {
  const [open, setOpen] = useState(false),
    Tag = staticCard ? "div" : "button";
  return (
    <>
      <Tag
        className={`fut-card fut-${a.rarity} retro-card ${a.protected ? "is-protected" : ""}`}
        onClick={staticCard ? undefined : (onClick ?? (() => setOpen(true)))}
        aria-label={`Ver carta de ${a.displayName}`}
      >
        <div className="fut-rating">
          <strong>{a.ovr}</strong>
          <span>{a.position ?? "MEI"}</span>
        </div>
        <span className="fut-edition">
          {a.rarity}{" "}
          {a.rarity === "P5"
            ? "★★★★★"
            : a.rarity === "P4"
              ? "★★★★"
              : a.rarity === "P3"
                ? "★★★"
                : a.rarity === "P2"
                  ? "★★"
                  : "★"}
        </span>
        <PixelPortrait athlete={a} />
        <h3>{a.displayName}</h3>
        {clubName ? (
          <p className="card-club" title={clubName}>
            {clubName}
          </p>
        ) : null}
        <div className="card-natural">
          <span>POTENCIAL NATURAL</span>
          <strong>{naturalOvr(a)}</strong>
        </div>
        <div className="fut-bottom">
          Nv. {a.level} ·{" "}
          {starter === undefined ? "ATLETA" : starter ? "TITULAR" : "RESERVA"}{" "}
          {a.protected ? "· ▣" : ""}
        </div>
        {a.tradeEligible ? (
          <span className="trade-seal">◆ SELO P2P</span>
        ) : null}
      </Tag>
      {open ? (
        <AthleteDialog
          athlete={a}
          clubName={clubName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
export function AthleteDialog({
  athlete: a,
  onClose,
  compare,
  children,
  clubName,
}: {
  athlete: Athlete;
  onClose: () => void;
  compare?: Athlete[];
  children?: ReactNode;
  clubName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [rival, setRival] = useState(compare?.[0]?.id ?? "");
  const other = compare?.find((x) => x.id === rival);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="athlete-dialog"
      aria-label={`Ficha de ${a.displayName}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="dialog-close secondary"
        autoFocus
        aria-label="Fechar ficha"
        onClick={onClose}
      >
        ✕
      </button>
      <div className="athlete-detail">
        <AthleteCard athlete={a} clubName={clubName} staticCard />
        <div>
          <p className="eyebrow">FICHA DO ATLETA · {a.rarity}</p>
          <h2>{a.displayName}</h2>
          <p className="muted">
            {a.position} · Nv. {a.level} · {a.xpTotal} XP ·{" "}
            {a.protected ? "Protegido" : "Sem proteção"}
          </p>
          {compare?.length ? (
            <label>
              Comparar com titular
              <select value={rival} onChange={(e) => setRival(e.target.value)}>
                {compare.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.displayName} · OVR {x.ovr}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <dl className="scouting-stats">
            {attributeKeys.map((k) => (
              <div key={k}>
                <dt>{attributeLabels[k]}</dt>
                <dd>
                  <strong>{a.attributes[k]}</strong>
                  <span> / {a.caps[k]} teto</span>
                  {other ? (
                    <em
                      className={
                        a.caps[k] >= other.caps[k] ? "positive" : "negative"
                      }
                    >
                      {" "}
                      {a.caps[k] - other.caps[k] >= 0 ? "+" : ""}
                      {a.caps[k] - other.caps[k]} vs teto
                    </em>
                  ) : null}
                </dd>
                <progress
                  value={a.attributes[k]}
                  max={99}
                  aria-label={attributeLabels[k]}
                />
              </div>
            ))}
          </dl>
          <p className="small muted">
            OVR {a.ovr} → teto natural {naturalOvr(a)}. Nível ilimitado,
            atributos limitados aos tetos individuais.
          </p>
          <p className="small muted">
            Valor NPC de nascimento: {npcPrice(a)} Coins. Treinar não aumenta
            esse preço.
          </p>
          {a.scoutReason ? (
            <p className="scout-reason">{a.scoutReason}</p>
          ) : null}
          <span className="tag">
            {a.tradeEligible ? "◆ Selo de negociação P2P" : "Sem selo P2P"}
          </span>
          {children}
        </div>
      </div>
    </dialog>
  );
}
