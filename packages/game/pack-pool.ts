import type { CardEdition, CardRarity } from "../contracts/brasfoot.js";
import type { PackFocus } from "../contracts/pack-focus.js";
/** Keep rarity rolls intact. If a sector has no edition of that rarity, disclose the general-pool fallback. */
export function focusedPool(
  catalog: CardEdition[],
  rarity: CardRarity,
  focus: PackFocus,
) {
  const general = catalog.filter((c) => c.rarity === rarity);
  const focused =
    focus === "GENERAL" ? general : general.filter((c) => c.position === focus);
  return {
    cards: focused.length ? focused : general,
    fallback: focus !== "GENERAL" && !focused.length,
  };
}
