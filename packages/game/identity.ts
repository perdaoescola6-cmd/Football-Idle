import type { Athlete } from "../contracts/index.js";
import { randomStream } from "./random.js";
import { birthOvr, npcPrice } from "../contracts/roster.js";
const first = [
  "Lucas",
  "Rafael",
  "Caio",
  "Bruno",
  "Pedro",
  "Davi",
  "Enzo",
  "Gabriel",
  "Mateus",
  "André",
  "Thiago",
  "Diego",
  "Miguel",
  "Arthur",
  "João",
  "Vitor",
  "Samuel",
  "Felipe",
  "Bento",
  "Danilo",
];
const last = [
  "Silva",
  "Costa",
  "Almeida",
  "Nunes",
  "Rocha",
  "Barbosa",
  "Lima",
  "Moraes",
  "Santos",
  "Ferreira",
  "Azevedo",
  "Ribeiro",
  "Tavares",
  "Vieira",
  "Duarte",
  "Castro",
  "Machado",
  "Pires",
  "Mendes",
  "Oliveira",
];
export function identify(a: Athlete, ordinal = 0): Athlete {
  const rand = randomStream(a.id, "identity-v1");
  const name = `${first[rand(first.length)]} ${last[rand(last.length)]}`;
  if (/^(Atleta |Rival )/.test(a.displayName)) a.displayName = name;
  a.position ??= (["GOL", "ZAG", "ZAG", "MEI", "ATA"] as const)[ordinal % 5];
  a.number ??= a.position === "GOL" ? 1 : 2 + rand(98);
  a.portrait ??= rand(10000);
  a.tradeEligible ??= randomStream(a.id, "market-eligibility")(100) === 0;
  a.birthOvr ??= birthOvr(a);
  a.npcValue ??= npcPrice(a);
  a.storage ??= "COLLECTION";
  a.protected ??= a.rarity === "P5";
  return a;
}
