import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../packages/game/card-catalog.js";
import { auditCatalog } from "../packages/game/catalog-audit.js";

test("catalog audit accepts historical snapshots and shared identities without inventing missing facts", () => {
  const before = JSON.stringify(catalog),
    report = auditCatalog();
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.identities, 844);
  assert.equal(report.sharedIdentities.length, 10);
  assert.deepEqual(report.exceptions.missingHeight, [
    "BR24-001",
    "BR24-008",
    "BR24-012",
    "BR24-013",
  ]);
  assert.equal(report.exceptions.unknownPreferredFoot.count, 851);
  assert.equal(JSON.stringify(catalog), before);
});

test("catalog audit catches duplicate editions, split identities and conflicting shared biographies", () => {
  const duplicate = structuredClone(catalog);
  duplicate.push(structuredClone(duplicate[0]));
  assert.ok(
    auditCatalog(duplicate).errors.some((e) => e.code === "edition-id"),
  );
  const split = structuredClone(catalog),
    danilo = split.find((c) => c.id === "BR24-002")!;
  danilo.playerId = danilo.id;
  assert.ok(
    auditCatalog(split).errors.some((e) => e.code === "split-identity"),
  );
  const conflict = structuredClone(catalog);
  conflict.find((c) => c.id === "BR24-002")!.profile!.birthDate = "1991-07-16";
  assert.ok(
    auditCatalog(conflict).errors.some((e) => e.code === "identity-conflict"),
  );
});

test("catalog audit rejects rollover dates, source drift, bad roles and invalid attributes", () => {
  const cards = structuredClone(catalog),
    card = cards.find((c) => c.id === "WC22-ARG-01")!;
  card.profile!.birthDate = "1986-02-30";
  card.profile!.club = "Unverified current club";
  card.role = "ATA";
  card.attributes!.diving = Number.NaN;
  const codes = new Set(
    auditCatalog(cards)
      .errors.filter((e) => e.editionId === card.id)
      .map((e) => e.code),
  );
  for (const code of ["birth-date", "source-drift", "role", "attributes"])
    assert.ok(codes.has(code), code);
});

test("catalog audit detects absent source editions and invalid source URLs", () => {
  const cards = structuredClone(catalog).filter((c) => c.id !== "WC22-WAL-26");
  cards[0].profile!.source = "javascript:alert(1)";
  const errors = auditCatalog(cards).errors;
  assert.ok(
    errors.some(
      (e) =>
        e.code === "missing-source-edition" && e.editionId === "WC22-WAL-26",
    ),
  );
  assert.ok(errors.some((e) => e.code === "profile-provenance"));
});

test("catalog audit blocks OVR drift and the removal of supplemented historical editions", () => {
  const cards = structuredClone(catalog).filter((c) => c.id !== "BR24-001");
  const goalie = cards.find((c) => c.id === "WC22-ARG-01")!;
  goalie.rating += 1;
  const errors = auditCatalog(cards).errors;
  assert.ok(errors.some((e) => e.code === "ovr" && e.editionId === goalie.id));
  assert.ok(
    errors.some(
      (e) => e.code === "orphan-supplement" && e.editionId === "BR24-001",
    ),
  );
});
