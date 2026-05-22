import type { Card, ReviewLog, Settings, VocabEntry } from "../types/vocab";

export type StudyStoreValueMap = {
  entries: VocabEntry;
  cards: Card;
  reviewLogs: ReviewLog;
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
};
