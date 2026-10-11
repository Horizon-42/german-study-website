import type {
  Card,
  Notebook,
  NotebookEntry,
  ReviewLog,
  Settings,
  StudyState,
  VocabEntry,
} from "../types/vocab";
import type { StudyStorageAdapter } from "./storage-adapter";

export type StudyPersistence = ReturnType<typeof createStudyPersistence>;

export function createStudyPersistence(storage: StudyStorageAdapter) {
  async function getSnapshot(): Promise<StudyState> {
    const [entries, cards, reviewLogs, notebooks, notebookEntries, settings] = await Promise.all([
      storage.getAll("entries"),
      storage.getAll("cards"),
      storage.getAll("reviewLogs"),
      storage.getAll("notebooks"),
      storage.getAll("notebookEntries"),
      getSettings(),
    ]);

    return {
      entries: entries.sort((a, b) => a.german.localeCompare(b.german, "de")),
      cards,
      reviewLogs,
      notebooks: notebooks.sort((a, b) => a.name.localeCompare(b.name)),
      notebookEntries,
      settings,
    };
  }

  async function getEntries(): Promise<VocabEntry[]> {
    return storage.getAll("entries");
  }

  async function getCardsForEntry(entryId: string): Promise<Card[]> {
    const cards = await storage.getAll("cards");
    return cards.filter((card) => card.vocabEntryId === entryId);
  }

  async function getReviewLogsForCards(cardIds: Set<string>): Promise<ReviewLog[]> {
    if (cardIds.size === 0) {
      return [];
    }

    const logs = await storage.getAll("reviewLogs");
    return logs.filter((log) => cardIds.has(log.cardId));
  }

  async function getSettings(): Promise<Settings> {
    const settings = await storage.getOne("settings", "settings");
    return settings ?? { id: "settings", dailyNewLimit: 10, targetRetention: 0.9 };
  }

  async function getNotebooks(): Promise<Notebook[]> {
    return storage.getAll("notebooks");
  }

  async function getNotebookEntries(): Promise<NotebookEntry[]> {
    return storage.getAll("notebookEntries");
  }

  async function getNotebookEntry(id: string): Promise<NotebookEntry | undefined> {
    return storage.getOne("notebookEntries", id);
  }

  async function writeEntriesAndCards(entries: VocabEntry[], cards: Card[]): Promise<void> {
    await storage.writeMany([
      { store: "entries", values: entries },
      { store: "cards", values: cards },
    ]);
  }

  async function writeEntry(entry: VocabEntry): Promise<void> {
    await storage.writeMany([{ store: "entries", values: [entry] }]);
  }

  async function writeCards(cards: Card[]): Promise<void> {
    await storage.writeMany([{ store: "cards", values: cards }]);
  }

  async function writeNotebooks(notebooks: Notebook[]): Promise<void> {
    await storage.writeMany([{ store: "notebooks", values: notebooks }]);
  }

  async function writeNotebookEntries(notebookEntries: NotebookEntry[]): Promise<void> {
    await storage.writeMany([{ store: "notebookEntries", values: notebookEntries }]);
  }

  async function saveSettings(settings: Settings): Promise<void> {
    await storage.writeMany([{ store: "settings", values: [settings] }]);
  }

  async function deleteEntryCascade(entryId: string): Promise<void> {
    const cards = await getCardsForEntry(entryId);
    const cardIds = new Set(cards.map((card) => card.id));
    const logs = await getReviewLogsForCards(cardIds);
    const notebookEntries = (await getNotebookEntries()).filter((link) => link.vocabEntryId === entryId);

    await storage.deleteMany([
      { store: "entries", keys: [entryId] },
      { store: "cards", keys: [...cardIds] },
      { store: "reviewLogs", keys: logs.map((log) => log.id) },
      { store: "notebookEntries", keys: notebookEntries.map((link) => link.id) },
    ]);
  }

  async function deleteCardsCascade(cardIds: Set<string>): Promise<void> {
    const logs = await getReviewLogsForCards(cardIds);
    await storage.deleteMany([
      { store: "cards", keys: [...cardIds] },
      { store: "reviewLogs", keys: logs.map((log) => log.id) },
    ]);
  }

  async function deleteNotebookCascade(notebookId: string): Promise<void> {
    const notebookEntries = (await getNotebookEntries()).filter((link) => link.notebookId === notebookId);
    await storage.deleteMany([
      { store: "notebooks", keys: [notebookId] },
      { store: "notebookEntries", keys: notebookEntries.map((link) => link.id) },
    ]);
  }

  async function recordReview(card: Card, log: ReviewLog): Promise<void> {
    await storage.writeMany([
      { store: "cards", values: [card] },
      { store: "reviewLogs", values: [log] },
    ]);
  }

  async function replaceSnapshot(state: StudyState): Promise<void> {
    await storage.replaceAll([
      { store: "entries", values: state.entries },
      { store: "cards", values: state.cards },
      { store: "reviewLogs", values: state.reviewLogs },
      { store: "notebooks", values: state.notebooks },
      { store: "notebookEntries", values: state.notebookEntries },
      { store: "settings", values: [state.settings] },
    ]);
  }

  return {
    getSnapshot,
    getEntries,
    getCardsForEntry,
    getReviewLogsForCards,
    getSettings,
    getNotebooks,
    getNotebookEntries,
    getNotebookEntry,
    writeEntriesAndCards,
    writeEntry,
    writeCards,
    writeNotebooks,
    writeNotebookEntries,
    saveSettings,
    deleteEntryCascade,
    deleteCardsCascade,
    deleteNotebookCascade,
    recordReview,
    replaceSnapshot,
  };
}
