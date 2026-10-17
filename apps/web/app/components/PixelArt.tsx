"use client";
import { useState, type CSSProperties } from "react";
import type { Athlete } from "../../../../packages/contracts/index";
export const kitColors = [
  "#d5df7e",
  "#7fb5d5",
  "#deae83",
  "#9bc3a4",
  "#b7a2d5",
  "#e2d8c1",
];
export const clubColor = (name: string) =>
  kitColors[
    [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % kitColors.length
  ];
export function PixelPlayer({
  athlete: a,
  color,
  pose = "run",
}: {
  athlete: Athlete;
  color: string;
  pose?: "run" | "idle" | "kick" | "save" | "celebrate";
}) {
  const n = a.portrait ?? 0,
    skin = ["#efc59d", "#d6a37d", "#b5805e", "#936147", "#704934", "#c7956a"][
      n % 6
    ],
    hair = ["#282b2e", "#57402e", "#967448", "#d3b278"][Math.floor(n / 7) % 4];
  return (
    <svg
      className={`pixel-player pose-${pose}`}
      viewBox="0 0 20 30"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ "--kit": color } as CSSProperties}
    >
      <ellipse cx="10" cy="28" rx="8" ry="2" fill="#061b2580" />
      <g className="sprite-body">
        <path d="M6 2h8v2h2v7h-2v2H6v-2H4V4h2Z" fill={skin} />
        <path d="M5 2h10v3H7v2H4V3h1Z" fill={hair} />
        <path d="M6 8h2v1H6m6-1h2v1h-2" fill="#252e35" />
        <path d="M5 13h10v9H5Z" fill={color} />
        <path d="M8 13h4v2H8" fill="#e4e7d6" />
        <path d="M6 21h8v3H6Z" fill="#1b3443" />
        <text
          x="10"
          y="20"
          fill="#173341"
          fontFamily="monospace"
          fontSize="5"
          fontWeight="900"
          textAnchor="middle"
        >
          {a.number ?? 10}
        </text>
        <path
          className="sprite-arm arm-left"
          d={
            pose === "celebrate" || pose === "save"
              ? "M2 6h3v10H2Z"
              : "M2 14h3v7H2Z"
          }
          fill={skin}
        />
        <path
          className="sprite-arm arm-right"
          d={
            pose === "celebrate" || pose === "save"
              ? "M15 6h3v10h-3Z"
              : "M15 14h3v7h-3Z"
          }
          fill={skin}
        />
      </g>
      <g className="sprite-leg leg-left">
        <path d="M6 23h3v4H6Z" fill={skin} />
        <path d="M5 27h4v2H5Z" fill="#142331" />
      </g>
      <g className="sprite-leg leg-right">
        <path
          d={pose === "kick" ? "M11 22h6v3h-6Z" : "M11 23h3v4h-3Z"}
          fill={skin}
        />
        <path
          d={pose === "kick" ? "M16 22h3v4h-3Z" : "M11 27h4v2h-4Z"}
          fill="#142331"
        />
      </g>
    </svg>
  );
}
export function PixelPortrait({
  athlete: a,
  color = clubColor(a.id),
}: {
  athlete: Athlete;
  color?: string;
}) {
  const n = a.portrait ?? 0,
    skin = ["#efc59d", "#d6a37d", "#b5805e", "#936147", "#704934", "#c7956a"][
      n % 6
    ],
    hair = ["#242a32", "#4b352b", "#80613d", "#bb9353", "#c4c9bf"][
      Math.floor(n / 7) % 5
    ],
    style = Math.floor(n / 43) % 6,
    beard = Math.floor(n / 127) % 4 === 0;
  return (
    <svg
      viewBox="0 0 48 56"
      className="portrait pixel-portrait"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d="M6 56V46h4v-4h12v-7h6v7h10v4h4v10Z" fill={color} />
      <path d="M20 41h8v5h-8Z" fill={skin} />
      <path d="M15 9h18v3h4v20h-4v6H17v-4h-4V13h2Z" fill={skin} />
      <path
        d={
          [
            "M14 9h20v7H18v4h-5v-9h1Z",
            "M15 7h16v3h5v9h-4v-6H15v7h-3V11h3Z",
            "M14 11h21v4H14Z",
            "M14 8h6v-3h11v3h4v11h-4v-7H14Z",
            "M13 12h4V8h16v5h4v10h-4v-8H17v7h-4Z",
            "M17 10h16v3H17Z",
          ][style]
        }
        fill={hair}
      />
      <path d="M17 23h4v2h-4m10-2h4v2h-4" fill="#28323b" />
      <path d="M23 26h2v5h-2m-3 3h9v1h-9" fill="#95624e" />
      {beard ? (
        <path d="M16 29h3v4h11v-3h4v6h-3v3H19v-2h-3Z" fill={hair} />
      ) : null}
      <path d="M18 43h4v3h4v-3h4v4h-4v3h-4v-3h-4Z" fill="#e2e4c9" />
      <path d="M9 49h3v7H9m27-7h3v7h-3" fill="#ffffff30" />
    </svg>
  );
}
export function SceneBanner({
  scene,
  title,
  subtitle,
}: {
  scene: string;
  title: string;
  subtitle: string;
}) {
  return (
    <figure className={`scene-banner scene-${scene}`}>
      <img src={`/assets/e2/environment-${scene}.svg`} alt="" />
      <figcaption>
        <span className="eyebrow">FOOTBALL IDLE · CLUBE</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </figcaption>
    </figure>
  );
}
export function PlayPreferences({
  reduced,
  onReduced,
  sound,
  onSound,
}: {
  reduced: boolean;
  onReduced: (v: boolean) => void;
  sound: boolean;
  onSound: (v: boolean) => void;
}) {
  return (
    <div className="play-preferences">
      <button
        className="secondary"
        aria-pressed={reduced}
        onClick={() => onReduced(!reduced)}
      >
        {reduced ? "Animação reduzida" : "Animação completa"}
      </button>
      <button
        className="secondary"
        aria-pressed={sound}
        onClick={() => onSound(!sound)}
      >
        {sound ? "Som ligado" : "Som desligado"}
      </button>
    </div>
  );
}
