import type { Card, Notebook, NotebookEntry, ReviewLog, Settings, VocabEntry } from "../types/vocab";

export type StudyStoreValueMap = {
  entries: VocabEntry;
  cards: Card;
  reviewLogs: ReviewLog;
  notebooks: Notebook;
  notebookEntries: NotebookEntry;
  settings: Settings;
};

export type StudyStoreName = keyof StudyStoreValueMap;

export type StudyWriteGroup = {
  [Store in StudyStoreName]: {
    store: Store;
    values: StudyStoreValueMap[Store][];
  };
}[StudyStoreName];

export type StudyDeleteGroup = {
  store: StudyStoreName;
  keys: string[];
};

export type StudyStorageAdapter = {
  getAll<Store extends StudyStoreName>(storeName: Store): Promise<StudyStoreValueMap[Store][]>;
  getOne<Store extends StudyStoreName>(
    storeName: Store,
    key: string,
  ): Promise<StudyStoreValueMap[Store] | undefined>;
  writeMany(groups: StudyWriteGroup[]): Promise<void>;
  deleteMany(groups: StudyDeleteGroup[]): Promise<void>;
  /** Clears every store, then writes the given values, as one atomic operation. */
  replaceAll(groups: StudyWriteGroup[]): Promise<void>;
};

export const studyStoreNames: StudyStoreName[] = [
  "entries",
  "cards",
  "reviewLogs",
  "notebooks",
  "notebookEntries",
  "settings",
];
