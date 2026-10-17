import type {
  CardEdition,
  PlayerProfile,
  PlayerRole,
  Position,
} from "../contracts/brasfoot.js";
import { rarities } from "../contracts/brasfoot.js";
import {
  attributeNames,
  ovr,
  playerIdentity,
} from "../contracts/card-model.js";
import { catalog } from "./card-catalog.js";
import roster from "./data/fifa-2022.json" with { type: "json" };
import manifest from "./data/fifa-2022-manifest.json" with { type: "json" };
import supplements from "./data/brazil-profile-supplements.json" with { type: "json" };

const broadPosition: Record<PlayerRole, Position> = {
  GOL: "GOL",
  LAT: "DEF",
  ZAG: "DEF",
  VOL: "MEI",
  MEI: "MEI",
  PON: "ATA",
  ATA: "ATA",
};
const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const validDate = (date: string | null | undefined): date is string => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};
const https = (url: string | undefined) => {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};

/** Structural/provenance checks against the committed snapshot; no network or save mutations. */
export function auditCatalog(cards: readonly CardEdition[] = catalog) {
  const errors: { editionId: string; code: string; detail: string }[] = [];
  const issue = (editionId: string, code: string, detail: string) =>
    errors.push({ editionId, code, detail });
  const editions = new Set<string>(),
    identities = new Map<string, CardEdition[]>(),
    biographies = new Map<string, string>();
  const sourceById = new Map(roster.map((r) => [r.id, r]));
  const additional: Record<string, Partial<PlayerProfile>> = supplements;
  const missingHeight: string[] = [],
    missingFoot: string[] = [];
  const byRarity: Record<string, number> = {},
    byReferenceYear: Record<string, number> = {};
  if (manifest.records !== roster.length || sourceById.size !== roster.length)
    issue(
      "catalog",
      "source-manifest",
      "Source record count or IDs disagree with the manifest.",
    );
  for (const id of Object.keys(additional))
    if (!cards.some((c) => c.id === id))
      issue(id, "orphan-supplement", "Supplement has no catalog edition.");
  for (const c of cards) {
    if (!c.id.trim() || editions.has(c.id))
      issue(c.id, "edition-id", "Edition ID is empty or duplicated.");
    editions.add(c.id);
    const identity = playerIdentity(c);
    if (!identity.trim())
      issue(c.id, "identity-id", "Player identity is empty.");
    identities.set(identity, [...(identities.get(identity) ?? []), c]);
    byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1;
    if (!rarities.includes(c.rarity)) issue(c.id, "rarity", "Unknown rarity.");
    if (!c.player.trim() || !c.edition.trim() || !https(c.source))
      issue(
        c.id,
        "edition-provenance",
        "Name, edition label or HTTPS source is missing/invalid.",
      );
    if (
      !Number.isInteger(c.rating) ||
      c.rating < 1 ||
      c.rating > 99 ||
      !Number.isInteger(c.potential) ||
      c.potential! < c.rating ||
      c.potential! > 99
    )
      issue(
        c.id,
        "rating",
        "Rating/potential must be bounded integers and potential cannot be below rating.",
      );
    if (
      !c.role ||
      broadPosition[c.role] !== c.position ||
      (c.secondaryRoles ?? []).some((r) => broadPosition[r] !== c.position)
    )
      issue(c.id, "role", "Game roles must agree with the broad position.");
    const attrs = c.attributes;
    if (
      !attrs ||
      Object.keys(attributeNames).some((key) => {
        const n = attrs[key as keyof typeof attrs];
        return !Number.isInteger(n) || n < 1 || n > 99;
      })
    )
      issue(
        c.id,
        "attributes",
        "Every game attribute must be an integer between 1 and 99.",
      );
    else if (
      c.role &&
      c.role in broadPosition &&
      ovr(attrs, c.role) !== c.rating
    )
      issue(
        c.id,
        "ovr",
        "Weighted role attributes do not reproduce the card rating.",
      );
    const p = c.profile;
    if (!p) {
      issue(c.id, "profile", "Profile is missing.");
      continue;
    }
    byReferenceYear[p.referenceYear] =
      (byReferenceYear[p.referenceYear] ?? 0) + 1;
    if (
      !p.fullName?.trim() ||
      !p.country.trim() ||
      !/^[A-Z]{3}$/.test(p.countryCode) ||
      !p.club?.trim() ||
      /[\u0000-\u001f\ufffd]/.test(`${p.fullName}${p.club}`)
    )
      issue(
        c.id,
        "biography",
        "Required biography fields are empty or contain extraction artifacts.",
      );
    if (
      !Number.isInteger(p.referenceYear) ||
      p.referenceYear < 1900 ||
      !validDate(p.birthDate) ||
      (p.birthDate &&
        (p.referenceYear - Number(p.birthDate.slice(0, 4)) < 14 ||
          p.referenceYear - Number(p.birthDate.slice(0, 4)) > 60))
    )
      issue(
        c.id,
        "birth-date",
        "Birth date must be real and age plausible in the profile reference year.",
      );
    if (
      !https(p.source ?? c.source) ||
      p.sources?.some((url) => !https(url)) ||
      (p.verifiedAt !== undefined && !validDate(p.verifiedAt))
    )
      issue(
        c.id,
        "profile-provenance",
        "Profile sources or consultation date are invalid.",
      );
    if (p.heightCm === null) missingHeight.push(c.id);
    else if (
      !Number.isInteger(p.heightCm) ||
      p.heightCm < 140 ||
      p.heightCm > 220
    )
      issue(
        c.id,
        "height",
        "Height is outside the reviewed plausibility range.",
      );
    if (p.preferredFoot === null) missingFoot.push(c.id);
    else if (!["Direito", "Esquerdo", "Ambos"].includes(p.preferredFoot))
      issue(
        c.id,
        "preferred-foot",
        "Preferred foot must be documented or null.",
      );
    if (
      !["GOL", "DEF", "MEI", "ATA"].includes(p.factualPosition) ||
      !p.roleNote.trim()
    )
      issue(
        c.id,
        "factual-position",
        "Source position and game-role explanation are required.",
      );
    const key = `${normalizeName(p.fullName ?? "")}|${p.birthDate}`;
    const otherIdentity = biographies.get(key);
    if (otherIdentity && otherIdentity !== identity)
      issue(
        c.id,
        "split-identity",
        `Same full name/date of birth uses another identity: ${otherIdentity}. Review before merging identities.`,
      );
    biographies.set(key, identity);
    const sourceRow = sourceById.get(identity);
    if (sourceRow) {
      const expected: Partial<PlayerProfile> = {
        fullName: sourceRow.fullName,
        birthDate: sourceRow.birthDate,
        country: sourceRow.country,
        countryCode: sourceRow.countryCode,
        club: sourceRow.club,
        heightCm: sourceRow.heightCm,
        factualPosition: sourceRow.position,
        referenceYear: manifest.referenceYear,
        source: sourceRow.source,
        sourcePage: sourceRow.sourcePage,
        ...additional[c.id],
      };
      for (const [field, value] of Object.entries(expected))
        if (
          JSON.stringify(p[field as keyof PlayerProfile]) !==
          JSON.stringify(value)
        )
          issue(
            c.id,
            "source-drift",
            `Profile field ${field} differs from its recorded source/supplement.`,
          );
      if (
        sourceRow.source !== manifest.source ||
        sourceRow.referenceYear !== manifest.referenceYear ||
        !Number.isInteger(p.sourcePage) ||
        p.sourcePage! < 1 ||
        p.sourcePage! > 32
      )
        issue(
          c.id,
          "source-reference",
          "FIFA URL, year or page disagrees with the manifest.",
        );
    } else if (!additional[c.id])
      issue(
        c.id,
        "unmapped-source",
        "Identity is absent from both the FIFA snapshot and profile supplements.",
      );
    else
      for (const [field, value] of Object.entries(additional[c.id]))
        if (
          JSON.stringify(p[field as keyof PlayerProfile]) !==
          JSON.stringify(value)
        )
          issue(
            c.id,
            "source-drift",
            `Profile field ${field} differs from its recorded supplement.`,
          );
  }
  for (const [id, group] of identities) {
    const first = group[0].profile;
    if (
      group.some(
        (c) =>
          c.profile?.birthDate !== first?.birthDate ||
          normalizeName(c.profile?.fullName ?? "") !==
            normalizeName(first?.fullName ?? "") ||
          c.profile?.countryCode !== first?.countryCode,
      )
    )
      issue(
        id,
        "identity-conflict",
        "Editions sharing an identity disagree on full name, date of birth or sporting country.",
      );
  }
  if (identities.size < 600)
    issue(
      "catalog",
      "minimum-identities",
      "At least 600 distinct identities are required.",
    );
  for (const rarity of rarities)
    if (!(byRarity[rarity] > 0))
      issue("catalog", "empty-rarity", `Empty rarity pool: ${rarity}.`);
  for (const row of roster)
    if (!editions.has(row.id))
      issue(
        row.id,
        "missing-source-edition",
        "Recorded FIFA edition is missing from the catalog.",
      );
  return {
    schemaVersion: 1,
    counts: {
      editions: cards.length,
      identities: identities.size,
      sourceRecords: roster.length,
      sourceCountries: new Set(roster.map((r) => r.countryCode)).size,
      byRarity,
      byReferenceYear,
    },
    source: {
      ...manifest,
      verification:
        "Committed source snapshot and supplements; not a live factual recertification.",
    },
    sharedIdentities: [...identities]
      .filter(([, group]) => group.length > 1)
      .map(([playerId, group]) => ({
        playerId,
        editions: group.map((c) => c.id),
      })),
    exceptions: {
      missingHeight,
      unknownPreferredFoot: {
        count: missingFoot.length,
        policy: "Remain null; never infer undocumented feet or height.",
      },
    },
    errors,
  };
}
