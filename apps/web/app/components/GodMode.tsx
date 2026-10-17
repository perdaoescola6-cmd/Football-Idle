import { GameIcon } from "./GameIcon";
export function GodMode({
  speed,
  used,
  busy,
  onSpeed,
}: {
  speed: 1 | 10 | 60;
  used: boolean;
  busy: boolean;
  onSpeed: (speed: 1 | 10 | 60) => void;
}) {
  return (
    <section
      className={`god-panel ${speed > 1 ? "god-active" : ""}`}
      aria-label="God mode para testes"
    >
      <div className="god-icon">
        <GameIcon name="bolt" size={24} />
      </div>
      <div className="god-copy">
        <p className="eyebrow">Laboratório local</p>
        <h2>
          God mode{" "}
          <span>
            {speed > 1
              ? `${speed}× ATIVO`
              : used
                ? "VELOCIDADE NORMAL"
                : "PRONTO PARA TESTAR"}
          </span>
        </h2>
        <p>
          Acelera partidas, XP, drops e progresso do seu clube. Ative o farm
          para jogar.
        </p>
        <small>
          Os ganhos ficam salvos. A velocidade também vale para o offline.
        </small>
      </div>
      <div
        className="speed-controls"
        role="group"
        aria-label="Velocidade de teste"
      >
        {([1, 10, 60] as const).map((value) => (
          <button
            key={value}
            disabled={busy}
            aria-pressed={speed === value}
            className={speed === value ? "selected" : ""}
            onClick={() => onSpeed(value)}
          >
            {value === 1 ? "Normal" : `${value}×`}
            <small>
              {value === 1
                ? "90s / jogo"
                : value === 10
                  ? "9s / jogo"
                  : "1,5s / jogo"}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
