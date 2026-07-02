/**
 * Offline write queue (D12): captures that fail on the network are stored in
 * IndexedDB and replayed on reconnect. Replay is safe because the server
 * upserts (sessions by client UUIDv7, check-ins by subject+date — ADR-011).
 *
 * The store is behind an interface so replay logic (sync.ts) is testable
 * without IndexedDB (jsdom has none).
 */

export type CaptureKind = 'checkin' | 'session';

export type QueuedCapture = {
  /** uuidv7 — lexicographic order == capture order (FIFO replay). */
  id: string;
  kind: CaptureKind;
  /** The exact payload the server action was called with; revalidated server-side (R5). */
  payload: unknown;
  queuedAt: string;
};

export type QueueStore = {
  add(item: QueuedCapture): Promise<void>;
  all(): Promise<QueuedCapture[]>;
  remove(id: string): Promise<void>;
};

const DB_NAME = 'athleteos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'capture-queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

/** Browser-only (client components); server code must never import this. */
export function idbQueueStore(): QueueStore {
  return {
    async add(item) {
      await withStore('readwrite', (store) => store.put(item));
    },
    all: () => withStore('readonly', (store) => store.getAll() as IDBRequest<QueuedCapture[]>),
    async remove(id) {
      await withStore('readwrite', (store) => store.delete(id));
    },
  };
}
