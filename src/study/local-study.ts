import { cardsForEntry } from "../data/cards";
import { seedVocabulary as defaultSeedVocabulary } from "../data/seed-vocab";
import { defaultSchedulerSettings, rescheduleCard } from "../scheduler/fsrs";
import type {
  Card,
  ExportPayload,
  Rating,
  ReviewLog,
  Settings,
  StudyState,
  VocabDraft,
  VocabEntry,
} from "../types/vocab";
import {
  materializeVocabularyEntry,
  reviseVocabularyEntry,
  vocabularyIdentity,
} from "../vocabulary/authoring";
import type { StudyStorageAdapter } from "./storage-adapter";

export type LocalStudyCommands = ReturnType<typeof createLocalStudyCommands>;

export type LocalStudyCommandOptions = {
  now?: () => Date;
  createId?: () => string;
  seedVocabulary?: VocabDraft[];
};

export function createLocalStudyCommands(
  storage: StudyStorageAdapter,
  options: LocalStudyCommandOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreateId;
  const seedVocabulary = options.seedVocabulary ?? defaultSeedVocabulary;

  async function initializeStore(): Promise<StudyState> {
    await ensureSettings();
    const entries = await storage.getAll("entries");

    if (entries.length === 0) {
      const currentTime = now();
      const seededEntries = seedVocabulary.map((draft) => materializeVocabularyEntry(draft, currentTime, createId));
      const seededCards = seededEntries.flatMap((entry) => cardsForEntry(entry, currentTime));
      await storage.writeMany([
        { store: "entries", values: seededEntries },
        { store: "cards", values: seededCards },
      ]);
    } else {
      await removeDuplicateEntries(entries);
    }

    return getStudyState();
  }

  async function getStudyState(): Promise<StudyState> {
    const [entries, cards, reviewLogs, settings] = await Promise.all([
      storage.getAll("entries"),
      storage.getAll("cards"),
      storage.getAll("reviewLogs"),
      getSettings(),
    ]);

    return {
      entries: entries.sort((a, b) => a.german.localeCompare(b.german, "de")),
      cards,
      reviewLogs,
      settings,
    };
  }

  async function addVocabEntry(draft: VocabDraft): Promise<VocabEntry> {
    const currentTime = now();
    const entry = materializeVocabularyEntry(draft, currentTime, createId);
    const cards = cardsForEntry(entry, currentTime);
    await storage.writeMany([
      { store: "entries", values: [entry] },
      { store: "cards", values: cards },
    ]);
    return entry;
  }

  async function addVocabEntries(drafts: VocabDraft[]): Promise<VocabEntry[]> {
    const currentTime = now();
    const entries = drafts.map((draft) => materializeVocabularyEntry(draft, currentTime, createId));
    const cards = entries.flatMap((entry) => cardsForEntry(entry, currentTime));
    await storage.writeMany([
      { store: "entries", values: entries },
      { store: "cards", values: cards },
    ]);
    return entries;
  }

  async function updateVocabEntry(entry: VocabEntry): Promise<VocabEntry> {
    const currentTime = now();
    const updated = reviseVocabularyEntry(entry, currentTime);
    const { createdCards, deletedCardIds } = await cardChangesForUpdatedEntry(updated, currentTime);
    const reviewLogs = deletedCardIds.size > 0 ? await storage.getAll("reviewLogs") : [];

    await storage.writeMany([
      { store: "entries", values: [updated] },
      { store: "cards", values: createdCards },
    ]);
    await storage.deleteMany([
      { store: "cards", keys: [...deletedCardIds] },
      {
        store: "reviewLogs",
        keys: reviewLogs.filter((log) => deletedCardIds.has(log.cardId)).map((log) => log.id),
      },
    ]);
    return updated;
  }

  async function deleteVocabEntry(entryId: string): Promise<void> {
    const cards = await storage.getAll("cards");
    const cardIds = new Set(cards.filter((card) => card.vocabEntryId === entryId).map((card) => card.id));
    const logs = await storage.getAll("reviewLogs");
    await storage.deleteMany([
      { store: "entries", keys: [entryId] },
      { store: "cards", keys: [...cardIds] },
      {
        store: "reviewLogs",
        keys: logs.filter((log) => cardIds.has(log.cardId)).map((log) => log.id),
      },
    ]);
  }

  async function updateCardState(cardId: string, state: Card["state"]): Promise<void> {
    const card = await storage.getOne("cards", cardId);
    if (!card) {
      return;
    }

    await storage.writeMany([{ store: "cards", values: [{ ...card, state }] }]);
  }

  async function reviewCard(cardId: string, rating: Rating, responseMs?: number): Promise<Card> {
    const card = await storage.getOne("cards", cardId);
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

    await storage.writeMany([
      { store: "cards", values: [next] },
      { store: "reviewLogs", values: [log] },
    ]);
    return next;
  }

  async function saveSettings(settings: Settings): Promise<void> {
    await storage.writeMany([{ store: "settings", values: [settings] }]);
  }

  async function exportStudyData(): Promise<ExportPayload> {
    const state = await getStudyState();
    return {
      ...state,
      exportedAt: now().toISOString(),
      schemaVersion: 1,
    };
  }

  async function removeDuplicateEntries(entries: VocabEntry[]): Promise<void> {
    const seen = new Set<string>();
    const duplicates = [...entries]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .filter((entry) => {
        const key = vocabularyIdentity(entry);
        if (seen.has(key)) {
          return true;
        }
        seen.add(key);
        return false;
      });

    for (const duplicate of duplicates) {
      await deleteVocabEntry(duplicate.id);
    }
  }

  async function ensureSettings(): Promise<void> {
    const existing = await storage.getOne("settings", "settings");

    if (!existing) {
      await storage.writeMany([{ store: "settings", values: [defaultSchedulerSettings] }]);
    }
  }

  async function getSettings(): Promise<Settings> {
    const settings = await storage.getOne("settings", "settings");
    return settings ?? defaultSchedulerSettings;
  }

  async function cardChangesForUpdatedEntry(entry: VocabEntry, currentTime: Date): Promise<{
    createdCards: Card[];
    deletedCardIds: Set<string>;
  }> {
    const existingCards = (await storage.getAll("cards"))
      .filter((card) => card.vocabEntryId === entry.id);
    const existingByKey = new Map(existingCards.map((card) => [cardIdentity(card), card]));
    const desiredCards = cardsForEntry(entry, currentTime);
    const desiredKeys = new Set(desiredCards.map(cardIdentity));

    return {
      createdCards: desiredCards.filter((card) => !existingByKey.has(cardIdentity(card))),
      deletedCardIds: new Set(
        existingCards
          .filter((card) => !desiredKeys.has(cardIdentity(card)))
          .map((card) => card.id),
      ),
    };
  }

  return {
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
  };
}

function cardIdentity(card: Pick<Card, "direction" | "articleCase">): string {
  return `${card.direction}:${card.articleCase ?? ""}`;
}

function defaultCreateId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
