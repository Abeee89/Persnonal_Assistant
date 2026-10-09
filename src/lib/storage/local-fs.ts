import fs from "node:fs/promises";
import path from "node:path";
import { isSafeStorageKey } from "@/lib/files/keys";
import { StorageKeyError, type StorageProvider } from "./types";

/**
 * Filesystem adapter rooted at `root`. Every key is validated against the
 * safe key pattern and then re-checked against the resolved root to block
 * traversal even if the pattern were ever loosened (SDD §09 §4).
 */
export class LocalFsStorage implements StorageProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolveKey(key: string): string {
    if (!isSafeStorageKey(key)) {
      throw new StorageKeyError(key);
    }
    const full = path.resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new StorageKeyError(key);
    }
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${String(process.pid)}.tmp`;
    await fs.writeFile(tmp, data, { flag: "wx" });
    await fs.rename(tmp, target);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const target = this.resolveKey(key);
    try {
      return new Uint8Array(await fs.readFile(target));
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.size(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await fs.unlink(target);
    } catch (error: unknown) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }

  async size(key: string): Promise<number | null> {
    const target = this.resolveKey(key);
    try {
      return (await fs.stat(target)).size;
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
