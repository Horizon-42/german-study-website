import type { Card, Notebook, NotebookEntry, ReviewLog, Settings, VocabEntry } from "../types/vocab";
import type {
  StudyDeleteGroup,
  StudyStorageAdapter,
  StudyStoreName,
  StudyStoreValueMap,
  StudyWriteGroup,
} from "./storage-adapter";

export type InMemoryStudyData = {
  entries?: VocabEntry[];
  cards?: Card[];
  reviewLogs?: ReviewLog[];
  notebooks?: Notebook[];
  notebookEntries?: NotebookEntry[];
  settings?: Settings[];
};

type StoreMaps = {
  [Store in StudyStoreName]: Map<string, StudyStoreValueMap[Store]>;
};

export function createInMemoryStudyStorageAdapter(initial: InMemoryStudyData = {}): StudyStorageAdapter {
  const stores: StoreMaps = {
    entries: toMap(initial.entries ?? []),
    cards: toMap(initial.cards ?? []),
    reviewLogs: toMap(initial.reviewLogs ?? []),
    notebooks: toMap(initial.notebooks ?? []),
    notebookEntries: toMap(initial.notebookEntries ?? []),
    settings: toMap(initial.settings ?? []),
  };

  async function getAll<Store extends StudyStoreName>(storeName: Store): Promise<StudyStoreValueMap[Store][]> {
    return Array.from(stores[storeName].values()).map(cloneValue);
  }

  async function getOne<Store extends StudyStoreName>(
    storeName: Store,
    key: string,
  ): Promise<StudyStoreValueMap[Store] | undefined> {
    const value = stores[storeName].get(key);
    return value ? cloneValue(value) : undefined;
  }

  async function writeMany(groups: StudyWriteGroup[]): Promise<void> {
    groups.forEach((group) => {
      const store = stores[group.store] as Map<string, { id: string }>;
      group.values.forEach((value) => store.set(value.id, cloneValue(value)));
    });
  }

  async function deleteMany(groups: StudyDeleteGroup[]): Promise<void> {
    groups.forEach((group) => {
      const store = stores[group.store];
      group.keys.forEach((key) => store.delete(key));
    });
  }

  return {
    getAll,
    getOne,
    writeMany,
    deleteMany,
  };
}

function toMap<T extends { id: string }>(values: T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, cloneValue(value)]));
}

function cloneValue<T>(value: T): T {
  return { ...(value as object) } as T;
}
