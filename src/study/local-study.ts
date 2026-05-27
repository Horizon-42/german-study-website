import { seedVocabulary as defaultSeedVocabulary } from "../data/seed-vocab";
import { defaultSchedulerSettings, rescheduleCard } from "../scheduler/fsrs";
import type {
  Card,
  ExportPayload,
  Notebook,
  NotebookDraft,
  NotebookEntry,
  Rating,
  ReviewLog,
  Settings,
  StudyState,
  VocabDraft,
  VocabEntry,
} from "../types/vocab";
import {
  materializeVocabularyEntry,
  normalizeVocabularyDraft,
  reviseVocabularyEntry,
  vocabularyIdentity,
} from "../vocabulary/authoring";
import {
  createNotebookEntry,
  defaultNotebook,
  defaultNotebookId,
  materializeNotebook,
  notebookEntryId,
  notebookNameIdentity,
  reviseNotebook,
} from "../vocabulary/notebooks";
import {
  createPracticeCardsForEntry,
  practiceCardIdentity,
} from "./practice-policy";
import type { StudyPersistence } from "./study-persistence";

export type LocalStudyCommands = ReturnType<typeof createLocalStudyCommands>;

export type ImportVocabularyRow = {
  draft: VocabDraft;
  notebookName?: string;
};

export type ImportVocabularyResult = {
  createdEntries: number;
  linkedEntries: number;
  createdNotebooks: number;
};

export type LocalStudyCommandOptions = {
  now?: () => Date;
  createId?: () => string;
  seedVocabulary?: VocabDraft[];
};

export function createLocalStudyCommands(
  persistence: StudyPersistence,
  options: LocalStudyCommandOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreateId;
  const seedVocabulary = options.seedVocabulary ?? defaultSeedVocabulary;

  async function initializeStore(): Promise<StudyState> {
    await ensureSettings();
    const currentTime = now();
    const notebook = await ensureDefaultNotebook(currentTime);
    const entries = await persistence.getEntries();

    if (entries.length === 0) {
      const seededEntries = seedVocabulary.map((draft) => materializeVocabularyEntry(draft, currentTime, createId));
      const seededCards = seededEntries.flatMap((entry) => createPracticeCardsForEntry(entry, currentTime));
      const notebookEntries = seededEntries.map((entry) => createNotebookEntry(notebook.id, entry.id, currentTime));
      await persistence.writeEntriesAndCards(seededEntries, seededCards);
      await persistence.writeNotebookEntries(notebookEntries);
    } else {
      await removeDuplicateEntries(entries);
      await ensureNotebookMemberships(await persistence.getEntries(), notebook.id, currentTime);
    }

    return getStudyState();
  }

  async function getStudyState(): Promise<StudyState> {
    return persistence.getSnapshot();
  }

  async function addVocabEntry(draft: VocabDraft, notebookId?: string): Promise<VocabEntry> {
    const currentTime = now();
    const targetNotebookId = await resolveTargetNotebookId(notebookId);
    const normalizedDraft = normalizeVocabularyDraft(draft);
    const existing = (await persistence.getEntries()).find((entry) => vocabularyIdentity(entry) === vocabularyIdentity(normalizedDraft));

    if (existing) {
      await addEntryToNotebook(existing.id, targetNotebookId);
      return existing;
    }

    const entry = materializeVocabularyEntry(normalizedDraft, currentTime, createId);
    const cards = createPracticeCardsForEntry(entry, currentTime);
    await persistence.writeEntriesAndCards([entry], cards);
    await persistence.writeNotebookEntries([createNotebookEntry(targetNotebookId, entry.id, currentTime)]);
    return entry;
  }

  async function addVocabEntries(drafts: VocabDraft[], notebookId?: string): Promise<VocabEntry[]> {
    const currentTime = now();
    const targetNotebookId = await resolveTargetNotebookId(notebookId);
    const existingByIdentity = new Map((await persistence.getEntries()).map((entry) => [vocabularyIdentity(entry), entry]));
    const existingLinks = new Set((await persistence.getNotebookEntries()).map((link) => link.id));
    const entries: VocabEntry[] = [];
    const createdEntries: VocabEntry[] = [];
    const cards: Card[] = [];
    const notebookEntries: NotebookEntry[] = [];

    for (const draft of drafts) {
      const normalizedDraft = normalizeVocabularyDraft(draft);
      const key = vocabularyIdentity(normalizedDraft);
      let entry = existingByIdentity.get(key);

      if (!entry) {
        entry = materializeVocabularyEntry(normalizedDraft, currentTime, createId);
        existingByIdentity.set(key, entry);
        createdEntries.push(entry);
        cards.push(...createPracticeCardsForEntry(entry, currentTime));
      }

      const link = createNotebookEntry(targetNotebookId, entry.id, currentTime);
      if (!existingLinks.has(link.id)) {
        notebookEntries.push(link);
        existingLinks.add(link.id);
      }
      entries.push(entry);
    }

    await persistence.writeEntriesAndCards(createdEntries, cards);
    await persistence.writeNotebookEntries(notebookEntries);
    return entries;
  }

  async function importVocabEntries(
    rows: ImportVocabularyRow[],
    fallbackNotebookId?: string,
  ): Promise<ImportVocabularyResult> {
    const currentTime = now();
    const targetNotebookId = await resolveTargetNotebookId(fallbackNotebookId);
    const existingEntries = await persistence.getEntries();
    const existingByIdentity = new Map(existingEntries.map((entry) => [vocabularyIdentity(entry), entry]));
    const notebooks = await persistence.getNotebooks();
    const notebookByName = new Map(notebooks.map((notebook) => [notebookNameIdentity(notebook.name), notebook]));
    const existingLinks = new Set((await persistence.getNotebookEntries()).map((link) => link.id));
    const createdEntries: VocabEntry[] = [];
    const createdCards: Card[] = [];
    const createdNotebooks: Notebook[] = [];
    const notebookEntries: NotebookEntry[] = [];
    let linkedEntries = 0;

    for (const row of rows) {
      const notebook = row.notebookName
        ? notebookByName.get(notebookNameIdentity(row.notebookName)) ?? createImportedNotebook(row.notebookName, currentTime)
        : undefined;
      const notebookId = notebook?.id ?? targetNotebookId;

      if (notebook && !notebookByName.has(notebookNameIdentity(notebook.name))) {
        notebookByName.set(notebookNameIdentity(notebook.name), notebook);
        createdNotebooks.push(notebook);
      }

      const key = vocabularyIdentity(row.draft);
      let entry = existingByIdentity.get(key);

      if (!entry) {
        entry = materializeVocabularyEntry(row.draft, currentTime, createId);
        existingByIdentity.set(key, entry);
        createdEntries.push(entry);
        createdCards.push(...createPracticeCardsForEntry(entry, currentTime));
      } else {
        linkedEntries += 1;
      }

      const link = createNotebookEntry(notebookId, entry.id, currentTime);
      if (!existingLinks.has(link.id)) {
        notebookEntries.push(link);
        existingLinks.add(link.id);
      }
    }

    await persistence.writeNotebooks(createdNotebooks);
    await persistence.writeEntriesAndCards(createdEntries, createdCards);
    await persistence.writeNotebookEntries(notebookEntries);

    return {
      createdEntries: createdEntries.length,
      linkedEntries,
      createdNotebooks: createdNotebooks.length,
    };
  }

  async function updateVocabEntry(entry: VocabEntry): Promise<VocabEntry> {
    const currentTime = now();
    const updated = reviseVocabularyEntry(entry, currentTime);
    const { createdCards, deletedCardIds } = await cardChangesForUpdatedEntry(updated, currentTime);
    await persistence.writeEntry(updated);
    await persistence.writeCards(createdCards);
    await persistence.deleteCardsCascade(deletedCardIds);
    return updated;
  }

  async function deleteVocabEntry(entryId: string): Promise<void> {
    await persistence.deleteEntryCascade(entryId);
  }

  async function updateCardState(cardId: string, state: Card["state"]): Promise<void> {
    const card = (await persistence.getSnapshot()).cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    await persistence.writeCards([{ ...card, state }]);
  }

  async function reviewCard(cardId: string, rating: Rating, responseMs?: number): Promise<Card> {
    const card = (await persistence.getSnapshot()).cards.find((item) => item.id === cardId);
    if (!card) {
      throw new Error(`Card ${cardId} was not found.`);
    }

    const settings = await getSettings();
    const currentTime = now();
    const next = rescheduleCard(card, rating, settings, currentTime);
    const log: ReviewLog = {
      id: createId(),
      cardId,
      reviewedAt: currentTime.toISOString(),
      rating,
      previousDueAt: card.dueAt,
      nextDueAt: next.dueAt,
      responseMs,
    };

    await persistence.recordReview(next, log);
    return next;
  }

  async function saveSettings(settings: Settings): Promise<void> {
    await persistence.saveSettings(settings);
  }

  async function createNotebook(draft: NotebookDraft): Promise<Notebook> {
    const currentTime = now();
    const existing = await persistence.getNotebooks();
    const notebook = materializeNotebook(draft, currentTime, createId);

    if (existing.some((item) => notebookNameIdentity(item.name) === notebookNameIdentity(notebook.name))) {
      throw new Error(`Notebook "${notebook.name}" already exists.`);
    }

    await persistence.writeNotebooks([notebook]);
    return notebook;
  }

  async function updateNotebook(notebook: Notebook): Promise<Notebook> {
    const updated = reviseNotebook(notebook, now());
    const notebooks = await persistence.getNotebooks();

    if (notebooks.some((item) => item.id !== updated.id && notebookNameIdentity(item.name) === notebookNameIdentity(updated.name))) {
      throw new Error(`Notebook "${updated.name}" already exists.`);
    }

    await persistence.writeNotebooks([updated]);
    return updated;
  }

  async function deleteNotebook(notebookId: string): Promise<void> {
    if (notebookId === defaultNotebookId) {
      throw new Error("The default notebook cannot be deleted.");
    }

    await persistence.deleteNotebookCascade(notebookId);
    const settings = await getSettings();
    if (settings.focusNotebookId === notebookId) {
      await saveSettings({ ...settings, focusNotebookId: undefined });
    }
  }

  async function setFocusNotebook(notebookId?: string): Promise<void> {
    if (notebookId) {
      const notebooks = await persistence.getNotebooks();
      if (!notebooks.some((notebook) => notebook.id === notebookId)) {
        throw new Error(`Notebook ${notebookId} was not found.`);
      }
    }

    await saveSettings({ ...await getSettings(), focusNotebookId: notebookId });
  }

  async function addEntryToNotebook(entryId: string, notebookId: string): Promise<void> {
    const currentTime = now();
    const link = createNotebookEntry(notebookId, entryId, currentTime);
    if (await persistence.getNotebookEntry(link.id)) {
      return;
    }

    await persistence.writeNotebookEntries([link]);
  }

  async function exportStudyData(): Promise<ExportPayload> {
    const state = await getStudyState();
    return {
      ...state,
      exportedAt: now().toISOString(),
      schemaVersion: 2,
    };
  }

  async function removeDuplicateEntries(entries: VocabEntry[]): Promise<void> {
    const seen = new Map<string, VocabEntry>();
    const notebookEntries = await persistence.getNotebookEntries();
    const duplicates = [...entries]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .filter((entry) => {
        const key = vocabularyIdentity(entry);
        if (seen.has(key)) {
          return true;
        }
        seen.set(key, entry);
        return false;
      });

    for (const duplicate of duplicates) {
      const keep = seen.get(vocabularyIdentity(duplicate));
      if (keep) {
        const transferredLinks = notebookEntries
          .filter((link) => link.vocabEntryId === duplicate.id)
          .map((link) => createNotebookEntry(link.notebookId, keep.id, now()));
        await persistence.writeNotebookEntries(transferredLinks);
      }
      await persistence.deleteEntryCascade(duplicate.id);
    }
  }

  async function ensureSettings(): Promise<void> {
    const existing = await persistence.getSettings();

    if (!existing) {
      await persistence.saveSettings(defaultSchedulerSettings);
    }
  }

  async function getSettings(): Promise<Settings> {
    return persistence.getSettings();
  }

  async function cardChangesForUpdatedEntry(entry: VocabEntry, currentTime: Date): Promise<{
    createdCards: Card[];
    deletedCardIds: Set<string>;
  }> {
    const existingCards = await persistence.getCardsForEntry(entry.id);
    const existingByKey = new Map(existingCards.map((card) => [practiceCardIdentity(card), card]));
    const desiredCards = createPracticeCardsForEntry(entry, currentTime);
    const desiredKeys = new Set(desiredCards.map(practiceCardIdentity));

    return {
      createdCards: desiredCards.filter((card) => !existingByKey.has(practiceCardIdentity(card))),
      deletedCardIds: new Set(
        existingCards
          .filter((card) => !desiredKeys.has(practiceCardIdentity(card)))
          .map((card) => card.id),
      ),
    };
  }

  async function ensureDefaultNotebook(currentTime: Date): Promise<Notebook> {
    const notebooks = await persistence.getNotebooks();
    const existing = notebooks.find((notebook) => notebook.id === defaultNotebookId);

    if (existing) {
      return existing;
    }

    const notebook = defaultNotebook(currentTime);
    await persistence.writeNotebooks([notebook]);
    return notebook;
  }

  async function ensureNotebookMemberships(
    entries: VocabEntry[],
    notebookId: string,
    currentTime: Date,
  ): Promise<void> {
    const existingLinks = await persistence.getNotebookEntries();
    const entriesWithLinks = new Set(existingLinks.map((link) => link.vocabEntryId));
    const missingLinks = entries
      .filter((entry) => !entriesWithLinks.has(entry.id))
      .map((entry) => createNotebookEntry(notebookId, entry.id, currentTime));

    await persistence.writeNotebookEntries(missingLinks);
  }

  async function resolveTargetNotebookId(notebookId?: string): Promise<string> {
    const notebooks = await persistence.getNotebooks();
    const settings = await getSettings();
    const targetId = notebookId ?? settings.focusNotebookId ?? defaultNotebookId;
    const targetNotebook = notebooks.find((notebook) => notebook.id === targetId)
      ?? notebooks.find((notebook) => notebook.id === defaultNotebookId);

    if (targetNotebook) {
      return targetNotebook.id;
    }

    return (await ensureDefaultNotebook(now())).id;
  }

  function createImportedNotebook(name: string, currentTime: Date): Notebook {
    return materializeNotebook(
      {
        name,
        description: "Imported notebook.",
        sourceName: "Import",
      },
      currentTime,
      createId,
    );
  }

  return {
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
  };
}

function defaultCreateId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
