/**
 * Port for binary storage (SDD §08 §3). Keys are server-generated relative
 * paths. Implementations must never accept keys that escape their root.
 */
export interface StorageProvider {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  size(key: string): Promise<number | null>;
}

export class StorageKeyError extends Error {
  constructor(key: string) {
    super(`Rejected storage key: ${key}`);
    this.name = "StorageKeyError";
  }
}
