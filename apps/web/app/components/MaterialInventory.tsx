"use client";
import { useState } from "react";
import type { GameView } from "../../../../packages/contracts/index";
import { alphaParameters } from "../../../../packages/contracts/world";
import { Modal, type SendAction } from "./CollectionPanel";

export function MaterialInventory({
  game,
  disabled,
  send,
}: {
  game: GameView;
  disabled: boolean;
  send: SendAction;
}) {
  const [quantity, setQuantity] = useState("1"),
    [review, setReview] = useState(false);
  const amount = /^\d{1,6}$/.test(quantity) ? Number(quantity) : 0;
  const valid =
    amount >= 1 &&
    amount <= 100000 &&
    BigInt(amount) <= BigInt(game.inventory.commonSupply);
  const total = BigInt(amount) * BigInt(alphaParameters.supplyValue);
  return (
    <article className="material-tile">
      <img
        src="/assets/e2/item-common-supply.svg"
        alt="Caixa de suprimentos comuns"
      />
      <div>
        <span className="eyebrow">MATERIAL · COMUM</span>
        <h2>Suprimento comum</h2>
        <strong>{game.inventory.commonSupply} unidades</strong>
        <p>
          Recebido em partidas elegíveis. Uso atual: venda ao empresário NPC por{" "}
          {alphaParameters.supplyValue} Coins/unidade. O CT consome Coins, sem
          gastar estes materiais.
        </p>
        <p className="small muted">
          Refinamento e negociação de materiais entre clubes aguardam regras
          próprias. Nenhum material raro ou excepcional foi acrescentado.
        </p>
        <div className="row-actions">
          <label>
            Quantidade para venda
            <input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={disabled || !valid}
            onClick={() => setReview(true)}
          >
            Revisar venda · {total.toString()} Coins
          </button>
        </div>
        {!valid ? (
          <p className="small muted">
            Escolha entre 1 e 100.000 unidades disponíveis por operação.
          </p>
        ) : null}
      </div>
      {review ? (
        <Modal
          title="Revisar venda de suprimentos"
          onClose={() => setReview(false)}
        >
          <p>
            {amount} unidades de suprimento comum por{" "}
            <b>{total.toString()} Coins</b>. Os atletas não fazem parte desta
            venda.
          </p>
          <button
            disabled={disabled || !valid}
            onClick={async () => {
              const result = await send("/club/command", {
                action: "SUPPLY_SELL",
                quantity: amount,
              });
              if (result) setReview(false);
            }}
          >
            Confirmar venda de {amount} suprimentos
          </button>
        </Modal>
      ) : null}
    </article>
  );
}
