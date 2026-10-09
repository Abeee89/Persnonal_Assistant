import { describe, expect, it } from "vitest";
import { buildStorageKey, isSafeStorageKey } from "./keys";
import { sanitizeOriginalName } from "./names";
import { sniffMime } from "./magic";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("sniffMime", () => {
  it("detects JPEG, PNG, WEBP and PDF from magic bytes", () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
    expect(sniffMime(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))).toBe("image/webp");
    expect(sniffMime(ascii("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("rejects text, HTML and SVG content regardless of extension", () => {
    expect(sniffMime(ascii("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffMime(ascii("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
  });

  it("rejects a RIFF container that is not WEBP (e.g. WAV)", () => {
    expect(sniffMime(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")]))).toBeNull();
  });

  it("handles truncated input without throwing", () => {
    expect(sniffMime(bytes())).toBeNull();
    expect(sniffMime(bytes(0x89, 0x50))).toBeNull();
  });
});

describe("sanitizeOriginalName", () => {
  it("keeps only the basename so traversal sequences are dropped", () => {
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalName("C:\\Users\\me\\photo.jpg")).toBe("photo.jpg");
  });

  it("removes control characters and collapses whitespace", () => {
    expect(sanitizeOriginalName("my\u0007  whiteboard\t\tnotes.png")).toBe("my whiteboard notes.png");
  });

  it("falls back to a neutral name when nothing usable remains", () => {
    expect(sanitizeOriginalName("")).toBe("file");
    expect(sanitizeOriginalName("..")).toBe("file");
    expect(sanitizeOriginalName("\u0001\u0002")).toBe("file");
  });

  it("caps the length at 150 characters", () => {
    expect(sanitizeOriginalName(`${"a".repeat(300)}.pdf`)).toHaveLength(150);
  });
});

describe("storage keys", () => {
  it("builds a date-sharded key with the sniffed extension", () => {
    expect(buildStorageKey("activity", "0190abcd-1234", "jpg", "2026-10-02")).toBe(
      "activity/2026/10/0190abcd-1234.jpg",
    );
  });

  it("accepts keys it built itself", () => {
    expect(isSafeStorageKey("journal/2026/10/0190abcd-1234.pdf")).toBe(true);
  });

  it("rejects traversal, absolute paths, unknown entity types and bad extensions", () => {
    expect(isSafeStorageKey("activity/2026/10/../../../secret.jpg")).toBe(false);
    expect(isSafeStorageKey("/etc/passwd")).toBe(false);
    expect(isSafeStorageKey("users/2026/10/x.jpg")).toBe(false);
    expect(isSafeStorageKey("activity/2026/10/x.svg")).toBe(false);
    expect(isSafeStorageKey("activity/2026/10/x.html")).toBe(false);
  });
});
