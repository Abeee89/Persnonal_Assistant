import { isSafeStorageKey } from "@/lib/files/keys";
import { StorageKeyError, type StorageProvider } from "./types";

/** In-memory adapter for tests. Enforces the same key rules as the filesystem adapter. */
export class MemoryStorage implements StorageProvider {
  private readonly files = new Map<string, Uint8Array>();

  private check(key: string): void {
    if (!isSafeStorageKey(key)) {
      throw new StorageKeyError(key);
    }
  }

  put(key: string, data: Uint8Array): Promise<void> {
    return Promise.resolve().then(() => {
      this.check(key);
      this.files.set(key, new Uint8Array(data));
    });
  }

  get(key: string): Promise<Uint8Array | null> {
    return Promise.resolve().then(() => {
      this.check(key);
      const value = this.files.get(key);
      return value ? new Uint8Array(value) : null;
    });
  }

  exists(key: string): Promise<boolean> {
    return Promise.resolve().then(() => {
      this.check(key);
      return this.files.has(key);
    });
  }

  delete(key: string): Promise<void> {
    return Promise.resolve().then(() => {
      this.check(key);
      this.files.delete(key);
    });
  }

  size(key: string): Promise<number | null> {
    return Promise.resolve().then(() => {
      this.check(key);
      return this.files.get(key)?.byteLength ?? null;
    });
  }
}
