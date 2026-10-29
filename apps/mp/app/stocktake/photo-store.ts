"use client";

// The API never stores the shelf photo, so this browser keeps a copy per session (run or scan id).
// Best-effort: private windows and blocked storage just mean a reopened session shows crops instead.

export type StoredPhoto = { blob: Blob; width: number; height: number };

const DB = "tally-stocktake";
const STORE = "photos";
const KEEP = 30;
const memory = new Map<string, StoredPhoto>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(key: string, photo: StoredPhoto): Promise<void> {
  memory.set(key, photo);
  try {
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await done(store.put({ ...photo, savedAt: Date.now() }, key));
    // Keep the newest few; photos are 1–2 MB each.
    const keys = (await done(store.getAllKeys())) as string[];
    if (keys.length > KEEP) {
      const rows = (await done(store.getAll())) as { savedAt: number }[];
      const oldest = keys.map((k, i) => [k, rows[i]!.savedAt] as const).sort((a, b) => a[1] - b[1]);
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE);
      await Promise.all(oldest.slice(0, keys.length - KEEP).map(([k]) => done(tx.delete(k))));
    }
    db.close();
  } catch {
    // Memory still has it for this tab.
  }
}

export async function loadPhoto(key: string): Promise<StoredPhoto | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const db = await open();
    const row = (await done(db.transaction(STORE, "readonly").objectStore(STORE).get(key))) as StoredPhoto | undefined;
    db.close();
    return row?.blob ? { blob: row.blob, width: row.width, height: row.height } : null;
  } catch {
    return null;
  }
}

export const runKey = (runId: string) => `run:${runId}`;
export const scanKey = (scanId: string) => `scan:${scanId}`;
