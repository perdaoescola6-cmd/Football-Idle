export const packFocuses = ["GENERAL", "GOL", "DEF", "MEI", "ATA"] as const;
export type PackFocus = (typeof packFocuses)[number];
export const packFocusNames: Record<PackFocus, string> = {
  GENERAL: "Todos os setores",
  GOL: "Goleiros",
  DEF: "Defensores",
  MEI: "Meio-campistas",
  ATA: "Atacantes",
};
export const FOCUS_PACK_VERSION = "packs-focus-v1";
