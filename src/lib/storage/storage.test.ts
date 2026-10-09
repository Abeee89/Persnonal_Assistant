import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFsStorage } from "./local-fs";
import { MemoryStorage } from "./memory";
import { StorageKeyError, type StorageProvider } from "./types";

const KEY = "activity/2026/10/0190abcd.jpg";
const DATA = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);

function contract(name: string, make: () => { provider: StorageProvider; cleanup: () => void }) {
  describe(`${name} adapter contract`, () => {
    let provider: StorageProvider;
    let cleanup: () => void;

    beforeEach(() => {
      ({ provider, cleanup } = make());
    });

    afterEach(() => {
      cleanup();
    });

    it("round-trips bytes and reports size", async () => {
      await provider.put(KEY, DATA);
      expect(await provider.get(KEY)).toEqual(DATA);
      expect(await provider.size(KEY)).toBe(DATA.byteLength);
      expect(await provider.exists(KEY)).toBe(true);
    });

    it("returns null for missing keys", async () => {
      expect(await provider.get("journal/2026/10/none.pdf")).toBeNull();
      expect(await provider.size("journal/2026/10/none.pdf")).toBeNull();
      expect(await provider.exists("journal/2026/10/none.pdf")).toBe(false);
    });

    it("delete is idempotent", async () => {
      await provider.put(KEY, DATA);
      await provider.delete(KEY);
      await provider.delete(KEY);
      expect(await provider.exists(KEY)).toBe(false);
    });

    it("rejects traversal and unsafe keys on every operation", async () => {
      const bad = "activity/2026/10/../../../escape.jpg";
      await expect(provider.put(bad, DATA)).rejects.toBeInstanceOf(StorageKeyError);
      await expect(provider.get(bad)).rejects.toBeInstanceOf(StorageKeyError);
      await expect(provider.delete("/etc/passwd")).rejects.toBeInstanceOf(StorageKeyError);
      await expect(provider.size("activity/2026/10/x.svg")).rejects.toBeInstanceOf(StorageKeyError);
    });
  });
}

contract("memory", () => ({ provider: new MemoryStorage(), cleanup: () => undefined }));

contract("local-fs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-store-"));
  return {
    provider: new LocalFsStorage(dir),
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
});

describe("LocalFsStorage specifics", () => {
  it("writes under the root only and leaves no temp files behind", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-store-"));
    try {
      const store = new LocalFsStorage(dir);
      await store.put(KEY, DATA);
      const onDisk = path.join(dir, KEY);
      expect(fs.existsSync(onDisk)).toBe(true);
      const leftovers = fs.readdirSync(path.dirname(onDisk)).filter((name) => name.endsWith(".tmp"));
      expect(leftovers).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
