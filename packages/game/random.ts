import { createHmac, createHash } from "node:crypto";
// Version: hmac-sha256-counter-v1. Each label is an independent deterministic stream.
export function randomStream(seed: string, label: string) {
  let counter = 0;
  return (bound: number): number => {
    if (!Number.isSafeInteger(bound) || bound <= 0 || bound > 0x100000000)
      throw new RangeError("Invalid bound");
    const ceiling = Math.floor(0x100000000 / bound) * bound;
    for (;;) {
      const value = createHmac("sha256", seed)
        .update(`${label}:${counter++}`)
        .digest()
        .readUInt32BE(0);
      if (value < ceiling) return value % bound;
    }
  };
}
export function derivedId(seed: string, label: string): string {
  const hex = createHash("sha256").update(`${seed}:${label}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function deriveSeed(seed: string, label: string): string {
  return createHmac("sha256", seed).update(label).digest("hex");
}
