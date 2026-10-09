export const SNIFF_TYPES = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "application/pdf": { ext: "pdf", kind: "pdf" },
} as const;

export type SniffedMime = keyof typeof SNIFF_TYPES;
export type AttachmentExt = (typeof SNIFF_TYPES)[SniffedMime]["ext"];

function matchesAt(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

/** Detects the real type from magic bytes. Client-declared MIME is never trusted. */
export function sniffMime(bytes: Uint8Array): SniffedMime | null {
  if (matchesAt(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (matchesAt(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (matchesAt(bytes, ascii("RIFF")) && matchesAt(bytes, ascii("WEBP"), 8)) {
    return "image/webp";
  }
  if (matchesAt(bytes, ascii("%PDF-"))) {
    return "application/pdf";
  }
  return null;
}
