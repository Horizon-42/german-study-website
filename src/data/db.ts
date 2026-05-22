import { createLocalStudyCommands } from "../study/local-study";
import { createIndexedDbStudyStorageAdapter } from "./indexeddb-adapter";

const localStudy = createLocalStudyCommands(createIndexedDbStudyStorageAdapter());

export const {
  initializeStore,
  getStudyState,
  addVocabEntry,
  addVocabEntries,
  updateVocabEntry,
  deleteVocabEntry,
  updateCardState,
  reviewCard,
  saveSettings,
  exportStudyData,
} = localStudy;
