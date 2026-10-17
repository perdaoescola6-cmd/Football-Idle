import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  packs,
  rarities,
  slotOdds,
  phenomenonChance,
  validatePackDefinition,
} from "../packages/contracts/brasfoot.js";
import { createClub } from "../packages/game/engine.js";
import {
  football,
  initializeFootball,
  openPack,
  packRarity,
} from "../packages/game/brasfoot.js";
import { catalog } from "../packages/game/card-catalog.js";

function club() {
  const s = createClub(randomUUID(), "Pack safety", "pack-safety", 1000);
  initializeFootball(s, 1000);
  football(s);
  return s;
}

test("pack roll and displayed odds reject fractional/out-of-range slots and malformed definitions", () => {
  for (const slot of [-1, 0.5, 5, NaN, Infinity]) {
    assert.throws(() => packRarity(packs[0], slot, 0), RangeError);
    assert.throws(() => slotOdds(packs[0], slot), RangeError);
  }
  for (const roll of [-1, 0.5, 10000, NaN, Infinity])
    assert.throws(() => packRarity(packs[0], 0, roll), RangeError);
  const malformed = [
    { price: -1 },
    { price: 0 },
    { price: 1.5 },
    { price: Number.MAX_SAFE_INTEGER + 1 },
    { weights: [7000, 2300, 600, 90, 9] },
    { weights: [10000] },
    { weights: [10001, -1, 0, 0, 0] },
    { weights: [9999.5, 0.5, 0, 0, 0] },
    { floors: [0, 0] },
    { floors: Array(5) },
    { floors: [0, 0, 0, 0, 5] },
    { floors: [0, 0, 0, 0, 0.5] },
  ];
  for (const change of malformed) {
    const pack = { ...packs[0], ...change };
    assert.throws(() => validatePackDefinition(pack), RangeError);
    assert.throws(() => packRarity(pack, 0, 0), RangeError);
    assert.throws(() => slotOdds(pack, 0), RangeError);
    assert.throws(() => phenomenonChance(pack), RangeError);
  }
});

test("published effective odds account for a guaranteed top-rarity slot", () => {
  const pack = { ...packs[0], floors: [4, 0, 0, 0, 0] };
  assert.equal(phenomenonChance(pack), 1);
  for (let slot = 0; slot < 5; slot++) {
    const outcomes = rarities.map(() => 0);
    for (let roll = 0; roll < 10000; roll++)
      outcomes[rarities.indexOf(packRarity(pack, slot, roll))]++;
    assert.deepEqual(outcomes, slotOdds(pack, slot));
    assert.equal(
      outcomes.reduce((a, b) => a + b, 0),
      10000,
    );
  }
});

test("insufficient funds leave wallet, ledger, cards and receipts unchanged", () => {
  const s = club(),
    before = structuredClone(s);
  assert.throws(() => openPack(s, "superstars", 1000), /insuficientes/);
  assert.deepEqual(s, before);
});

test("a missing pool on the second slot cannot debit Coins or deliver the first card, including welcome packs", () => {
  const originalCards = [...catalog],
    originalPack = structuredClone(packs[0]);
  try {
    catalog.splice(
      0,
      catalog.length,
      ...catalog.filter((c) => c.rarity !== "Fenômeno"),
    );
    packs[0].weights = [10000, 0, 0, 0, 0];
    packs[0].floors = [0, 4, 0, 0, 0];
    for (const welcome of [false, true]) {
      const s = club(),
        before = structuredClone(s);
      assert.throws(
        () => openPack(s, "basic", 1000, welcome),
        /catálogo incompleto/,
      );
      assert.deepEqual(s, before);
    }
  } finally {
    catalog.splice(0, catalog.length, ...originalCards);
    Object.assign(packs[0], originalPack);
  }
});

test("repeated editions inside one pack retain organizer duplicate-to-depot semantics", () => {
  const originalCards = [...catalog],
    originalPack = structuredClone(packs[0]);
  try {
    const card = catalog.find((c) => c.rarity === "Bronze")!;
    catalog.splice(0, catalog.length, card);
    packs[0].weights = [10000, 0, 0, 0, 0];
    packs[0].floors = [0, 0, 0, 0, 0];
    const s = club(),
      f = football(s);
    f.cards = [];
    f.organizer = { enabled: true, duplicateToDepot: true, lockAt: 3 };
    const result = openPack(s, "basic", 1000);
    assert.deepEqual(
      result.cards.map((c) => c.storage),
      ["COLLECTION", "DEPOT", "DEPOT", "DEPOT", "DEPOT"],
    );
    assert.equal(result.receipt.cardIds.length, 5);
    assert.equal(new Set(result.receipt.cardIds).size, 5);
    assert.equal(s.runtime.balance, "5000");
  } finally {
    catalog.splice(0, catalog.length, ...originalCards);
    Object.assign(packs[0], originalPack);
  }
});
