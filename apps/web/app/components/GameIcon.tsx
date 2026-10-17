export type IconName =
  | "club"
  | "coin"
  | "players"
  | "xp"
  | "clock"
  | "bolt"
  | "box"
  | "history"
  | "trophy"
  | "play"
  | "map"
  | "scout"
  | "store"
  | "training";
const paths: Record<IconName, string[]> = {
  map: ["m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z", "M9 3v16M15 5v16"],
  scout: ["M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14", "m15 15 6 6", "m7 10 2 2 4-5"],
  store: [
    "M3 9h18l-2-6H5Z",
    "M5 9v12h14V9",
    "M9 21v-7h6v7",
    "M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9",
  ],
  training: ["M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"],
  club: ["M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Z", "m8 12 3 3 5-6"],
  coin: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
    "M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9",
    "M12 6v12",
  ],
  players: [
    "M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    "M3 20v-3a6 6 0 0 1 12 0v3",
    "M16 4a3 3 0 0 1 0 6",
    "M18 13a5 5 0 0 1 3 5v2",
  ],
  xp: [
    "m12 3 2.8 5.7L21 10l-4.5 4.4 1.1 6.2L12 17.7l-5.6 2.9 1.1-6.2L3 10l6.2-1.3Z",
  ],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "M12 7v5l4 2"],
  bolt: ["m14 2-10 12h7l-1 8L21 9h-8Z"],
  box: ["m3 7 9-4 9 4v10l-9 4-9-4Z", "m3 7 9 4 9-4", "M12 11v10", "m7 5 10 4"],
  history: ["M4 9a8 8 0 1 1 0 7", "M4 3v6h6", "M12 7v5l3 2"],
  trophy: [
    "M7 3h10v6a5 5 0 0 1-10 0Z",
    "M7 5H3v3a4 4 0 0 0 4 4",
    "M17 5h4v3a4 4 0 0 1-4 4",
    "M12 14v6",
    "M8 21h8",
  ],
  play: ["m8 4 12 8-12 8Z"],
};
export function GameIcon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
export function Jersey({
  number,
  away = false,
}: {
  number: number;
  away?: boolean;
}) {
  return (
    <svg className="jersey" viewBox="0 0 80 84" aria-hidden="true">
      <path
        d="m24 8-20 12 9 19 11-5v42h32V34l11 5 9-19L56 8c-6 10-26 10-32 0Z"
        fill="currentColor"
        stroke={away ? "#cad9ee" : "#d7ff82"}
        strokeWidth="1.5"
      />
      <path
        d="M30 11v64M50 11v64"
        stroke="#fff"
        strokeOpacity=".13"
        strokeWidth="9"
      />
      <path
        d="M30 10c2 11 18 11 20 0"
        fill="none"
        stroke="#07180f"
        strokeWidth="4"
      />
      <text
        x="40"
        y="53"
        fill={away ? "#111b31" : "#09140a"}
        fontSize="24"
        fontWeight="900"
        textAnchor="middle"
        fontFamily="Arial,sans-serif"
      >
        {number}
      </text>
    </svg>
  );
}
