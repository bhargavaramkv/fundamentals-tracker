/**
 * Minimal promise wrapper over IndexedDB, plus an in-memory implementation with the same interface for tests and for
 * browsers where IndexedDB is unavailable (some private modes). Values are structured-cloned, so CryptoKey objects
 * (including non-extractable ones) can be stored.
 */

export interface KeyValueStore<T> {
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Every [key, value] pair. */
  entries(): Promise<[string, T][]>;
}

export class MemoryStore<T> implements KeyValueStore<T> {
  private readonly map = new Map<string, T>();
  async get(key: string) {
    return this.map.get(key);
  }
  async put(key: string, value: T) {
    this.map.set(key, value);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async entries(): Promise<[string, T][]> {
    return [...this.map.entries()];
  }
}

const dbs = new Map<string, Promise<IDBDatabase>>();

function openDb(name: string, stores: string[]): Promise<IDBDatabase> {
  const cached = dbs.get(name);
  if (cached) return cached;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    // Version 1 creates every store up front; adding a store later needs a version bump here.
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      for (const s of stores) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error(`IndexedDB ${name} is blocked by another tab`));
  });
  dbs.set(name, p);
  p.catch(() => dbs.delete(name));
  return p;
}

function request<R>(r: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IdbStore<T> implements KeyValueStore<T> {
  /** `stores` lists every store in the database `db`, so whichever store opens it first creates them all. */
  constructor(
    private readonly db: string,
    private readonly store: string,
    private readonly stores: string[],
  ) {}

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await openDb(this.db, this.stores)).transaction(this.store, mode).objectStore(this.store);
  }

  async get(key: string): Promise<T | undefined> {
    return (await request((await this.tx("readonly")).get(key))) as T | undefined;
  }

  async put(key: string, value: T): Promise<void> {
    const s = await this.tx("readwrite");
    // Resolve only once the transaction commits, so a refresh right after can't lose the write.
    const done = new Promise<void>((resolve, reject) => {
      s.transaction.oncomplete = () => resolve();
      s.transaction.onerror = () => reject(s.transaction.error);
      s.transaction.onabort = () => reject(s.transaction.error);
    });
    s.put(value, key);
    await done;
  }

  async delete(key: string): Promise<void> {
    await request((await this.tx("readwrite")).delete(key));
  }

  async entries(): Promise<[string, T][]> {
    const s = await this.tx("readonly");
    const [keys, values] = await Promise.all([request(s.getAllKeys()), request(s.getAll())]);
    return keys.map((k, i) => [String(k), values[i] as T]);
  }
}

/** True when IndexedDB can actually be opened (it exists but throws in some private modes). */
export async function idbAvailable(): Promise<boolean> {
  try {
    if (typeof indexedDB === "undefined") return false;
    await openDb("ft-probe", ["probe"]);
    return true;
  } catch {
    return false;
  }
}
