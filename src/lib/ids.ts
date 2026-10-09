import { randomBytes } from "node:crypto";

/**
 * RFC 9562 UUIDv7: 48-bit unix millisecond timestamp, then random bits.
 * Time-ordered so that primary-key inserts stay index-local (SDD §06 §2).
 */
export function uuidv7(now: number = Date.now()): string {
  if (!Number.isInteger(now) || now < 0 || now > 0xffffffffffff) {
    throw new RangeError("uuidv7 timestamp out of range");
  }
  const bytes = randomBytes(16);
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] ?? 0) & 0x0f | 0x70;
  bytes[8] = (bytes[8] ?? 0) & 0x3f | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function requestId(): string {
  return randomBytes(8).toString("hex");
}
