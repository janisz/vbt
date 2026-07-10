import type { Session, WorkoutSet } from "../types.js";

const DB_NAME = "vbt";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export function resetDB(): void {
  db = null;
}

export async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("sessions")) {
        database.createObjectStore("sessions", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("sets")) {
        const store = database.createObjectStore("sets", { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: Session): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSessions(): Promise<Session[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sessions", "readonly");
    const request = tx.objectStore("sessions").getAll();
    request.onsuccess = () => {
      const sessions = request.result as Session[];
      sessions.sort((a, b) => b.date - a.date);
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSet(set: WorkoutSet): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sets", "readwrite");
    tx.objectStore("sets").put(set);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSetsForSession(
  sessionId: string,
): Promise<WorkoutSet[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("sets", "readonly");
    const index = tx.objectStore("sets").index("sessionId");
    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve(request.result as WorkoutSet[]);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = await openDB();
  const sets = await getSetsForSession(sessionId);

  return new Promise((resolve, reject) => {
    const tx = database.transaction(["sessions", "sets"], "readwrite");
    tx.objectStore("sessions").delete(sessionId);
    const setStore = tx.objectStore("sets");
    for (const set of sets) {
      setStore.delete(set.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
