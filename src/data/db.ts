import { createLocalStudyCommands } from "../study/local-study";
import { createStudyPersistence } from "../study/study-persistence";
import { createIndexedDbStudyStorageAdapter } from "./indexeddb-adapter";

const localStudy = createLocalStudyCommands(
  createStudyPersistence(createIndexedDbStudyStorageAdapter()),
);

export const {
  initializeStore,
  getStudyState,
  addVocabEntry,
  addVocabEntries,
  importVocabEntries,
  updateVocabEntry,
  deleteVocabEntry,
  updateCardState,
  reviewCard,
  saveSettings,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  setFocusNotebook,
  addEntryToNotebook,
  exportStudyData,
  restoreStudyData,
} = localStudy;
