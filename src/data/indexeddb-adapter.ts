import type {
  StudyDeleteGroup,
  StudyStorageAdapter,
  StudyStoreName,
  StudyStoreValueMap,
  StudyWriteGroup,
} from "../study/storage-adapter";

const DB_NAME = "german-study-mvp";
const DB_VERSION = 2;

export function createIndexedDbStudyStorageAdapter(): StudyStorageAdapter {
  let dbPromise: Promise<IDBDatabase> | undefined;

  async function openDb(): Promise<IDBDatabase> {
    dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("entries")) {
          const store = db.createObjectStore("entries", { keyPath: "id" });
          store.createIndex("level", "level", { unique: false });
          store.createIndex("topic", "topic", { unique: false });
          store.createIndex("sourceName", "sourceName", { unique: false });
        }

        if (!db.objectStoreNames.contains("cards")) {
          const store = db.createObjectStore("cards", { keyPath: "id" });
          store.createIndex("vocabEntryId", "vocabEntryId", { unique: false });
          store.createIndex("dueAt", "dueAt", { unique: false });
          store.createIndex("state", "state", { unique: false });
        }

        if (!db.objectStoreNames.contains("reviewLogs")) {
          const store = db.createObjectStore("reviewLogs", { keyPath: "id" });
          store.createIndex("cardId", "cardId", { unique: false });
          store.createIndex("reviewedAt", "reviewedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("notebooks")) {
          const store = db.createObjectStore("notebooks", { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
        }

        if (!db.objectStoreNames.contains("notebookEntries")) {
          const store = db.createObjectStore("notebookEntries", { keyPath: "id" });
          store.createIndex("notebookId", "notebookId", { unique: false });
          store.createIndex("vocabEntryId", "vocabEntryId", { unique: false });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function getAll<Store extends StudyStoreName>(storeName: Store): Promise<StudyStoreValueMap[Store][]> {
    const db = await openDb();
    const tx = db.transaction(storeName, "readonly");
    const result = await requestToPromise<StudyStoreValueMap[Store][]>(
      tx.objectStore(storeName).getAll(),
    );
    await txDone(tx);
    return result;
  }

  async function getOne<Store extends StudyStoreName>(
    storeName: Store,
    key: string,
  ): Promise<StudyStoreValueMap[Store] | undefined> {
    const db = await openDb();
    const tx = db.transaction(storeName, "readonly");
    const result = await requestToPromise<StudyStoreValueMap[Store] | undefined>(
      tx.objectStore(storeName).get(key),
    );
    await txDone(tx);
    return result;
  }

  async function writeMany(groups: StudyWriteGroup[]): Promise<void> {
    if (groups.length === 0) {
      return;
    }

    const db = await openDb();
    const tx = db.transaction(uniqueStoreNames(groups), "readwrite");

    groups.forEach((group) => {
      const store = tx.objectStore(group.store);
      group.values.forEach((value) => store.put(value));
    });

    await txDone(tx);
  }

  async function deleteMany(groups: StudyDeleteGroup[]): Promise<void> {
    const activeGroups = groups.filter((group) => group.keys.length > 0);
    if (activeGroups.length === 0) {
      return;
    }

    const db = await openDb();
    const tx = db.transaction(uniqueStoreNames(activeGroups), "readwrite");

    activeGroups.forEach((group) => {
      const store = tx.objectStore(group.store);
      group.keys.forEach((key) => store.delete(key));
    });

    await txDone(tx);
  }

  return {
    getAll,
    getOne,
    writeMany,
    deleteMany,
  };
}

function uniqueStoreNames(groups: Array<{ store: StudyStoreName }>): StudyStoreName[] {
  return [...new Set(groups.map((group) => group.store))];
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
