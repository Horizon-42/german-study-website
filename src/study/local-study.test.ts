import { describe, expect, it } from "vitest";
import { createInMemoryStudyStorageAdapter } from "./in-memory-storage-adapter";
import { createLocalStudyCommands } from "./local-study";
import type { Card, ReviewLog, VocabDraft, VocabEntry } from "../types/vocab";

const now = new Date("2026-05-22T08:00:00.000Z");

describe("local study commands", () => {
  it("initializes settings and seeds entries through a storage adapter", async () => {
    const commands = createCommands({
      seedVocabulary: [
        {
          german: "das Haus",
          english: "house",
          partOfSpeech: "noun",
          level: "A1",
        },
      ],
    });

    const state = await commands.initializeStore();

    expect(state.settings).toMatchObject({ id: "settings", dailyNewLimit: 10 });
    expect(state.entries).toMatchObject([
      {
        german: "Haus",
        english: "house",
        article: "das",
      },
    ]);
    expect(state.cards.map((card) => card.direction).sort()).toEqual([
      "article",
      "article_case",
      "article_case",
      "article_case",
      "article_case",
      "de_to_en",
    ]);
  });

  it("adds vocabulary entries with generated cards", async () => {
    const commands = createCommands();
    const entry = await commands.addVocabEntry({
      german: "gehen",
      english: "to go",
      partOfSpeech: "verb",
    });
    const state = await commands.getStudyState();

    expect(entry).toMatchObject({ german: "gehen", english: "to go" });
    expect(state.entries).toHaveLength(1);
    expect(state.cards).toMatchObject([{ vocabEntryId: entry.id, direction: "de_to_en" }]);
  });

  it("reviews a card and writes the review log through the adapter", async () => {
    const commands = createCommands({
      initial: {
        cards: [card({ id: "card-1", vocabEntryId: "entry-1", dueAt: "2026-05-21T08:00:00.000Z" })],
      },
    });

    const next = await commands.reviewCard("card-1", "good", 1200);
    const state = await commands.getStudyState();

    expect(next).toMatchObject({ id: "card-1", reps: 2, state: "review" });
    expect(state.reviewLogs).toMatchObject([
      {
        cardId: "card-1",
        rating: "good",
        previousDueAt: "2026-05-21T08:00:00.000Z",
        responseMs: 1200,
      },
    ]);
  });

  it("deletes an entry with its cards and review logs", async () => {
    const commands = createCommands({
      initial: {
        entries: [entry({ id: "entry-1" })],
        cards: [
          card({ id: "card-1", vocabEntryId: "entry-1" }),
          card({ id: "card-2", vocabEntryId: "entry-other" }),
        ],
        reviewLogs: [
          reviewLog({ id: "log-1", cardId: "card-1" }),
          reviewLog({ id: "log-2", cardId: "card-2" }),
        ],
      },
    });

    await commands.deleteVocabEntry("entry-1");
    const state = await commands.getStudyState();

    expect(state.entries).toEqual([]);
    expect(state.cards.map((item) => item.id)).toEqual(["card-2"]);
    expect(state.reviewLogs.map((item) => item.id)).toEqual(["log-2"]);
  });

  it("removes obsolete article cards when an entry is revised away from noun practice", async () => {
    const nounEntry = entry({
      id: "entry-1",
      partOfSpeech: "noun",
      article: "das",
      plural: "Häuser",
    });
    const commands = createCommands({
      initial: {
        entries: [nounEntry],
        cards: [
          card({ id: "word-card", vocabEntryId: "entry-1", direction: "de_to_en" }),
          card({ id: "article-card", vocabEntryId: "entry-1", direction: "article" }),
          card({
            id: "dative-card",
            vocabEntryId: "entry-1",
            direction: "article_case",
            articleCase: "dative",
          }),
        ],
        reviewLogs: [
          reviewLog({ id: "word-log", cardId: "word-card" }),
          reviewLog({ id: "article-log", cardId: "article-card" }),
        ],
      },
    });

    const updated = await commands.updateVocabEntry({
      ...nounEntry,
      partOfSpeech: "verb",
      article: undefined,
      plural: "",
    });
    const state = await commands.getStudyState();

    expect(updated).not.toHaveProperty("article");
    expect(updated).not.toHaveProperty("plural");
    expect(state.cards.map((item) => item.id)).toEqual(["word-card"]);
    expect(state.reviewLogs.map((item) => item.id)).toEqual(["word-log"]);
  });

  it("adds article practice cards when an entry is revised into a noun", async () => {
    const verbEntry = entry({
      id: "entry-1",
      partOfSpeech: "verb",
      german: "Wasser",
      english: "water",
    });
    const commands = createCommands({
      initial: {
        entries: [verbEntry],
        cards: [card({ id: "word-card", vocabEntryId: "entry-1", direction: "de_to_en" })],
      },
    });

    await commands.updateVocabEntry({
      ...verbEntry,
      partOfSpeech: "noun",
      article: "das",
    });
    const state = await commands.getStudyState();

    expect(state.cards.map((item) => item.direction).sort()).toEqual([
      "article",
      "article_case",
      "article_case",
      "article_case",
      "article_case",
      "de_to_en",
    ]);
    expect(state.cards.find((item) => item.id === "word-card")).toMatchObject({
      direction: "de_to_en",
      reps: 1,
    });
  });

  it("removes duplicate entries during initialization", async () => {
    const commands = createCommands({
      initial: {
        entries: [
          entry({ id: "first", german: "Haus", english: "house", createdAt: "2026-05-20T08:00:00.000Z" }),
          entry({ id: "duplicate", german: " haus ", english: "House", createdAt: "2026-05-21T08:00:00.000Z" }),
        ],
        cards: [
          card({ id: "keep-card", vocabEntryId: "first" }),
          card({ id: "delete-card", vocabEntryId: "duplicate" }),
        ],
        reviewLogs: [
          reviewLog({ id: "keep-log", cardId: "keep-card" }),
          reviewLog({ id: "delete-log", cardId: "delete-card" }),
        ],
      },
    });

    const state = await commands.initializeStore();

    expect(state.entries.map((item) => item.id)).toEqual(["first"]);
    expect(state.cards.map((item) => item.id)).toEqual(["keep-card"]);
    expect(state.reviewLogs.map((item) => item.id)).toEqual(["keep-log"]);
  });
});

function createCommands({
  initial = {},
  seedVocabulary = [],
}: {
  initial?: Parameters<typeof createInMemoryStudyStorageAdapter>[0];
  seedVocabulary?: VocabDraft[];
} = {}) {
  let nextId = 0;
  return createLocalStudyCommands(createInMemoryStudyStorageAdapter(initial), {
    now: () => now,
    createId: () => `id-${nextId += 1}`,
    seedVocabulary,
  });
}

function entry(overrides: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: "entry",
    german: "Haus",
    english: "house",
    createdAt: "2026-05-20T08:00:00.000Z",
    updatedAt: "2026-05-20T08:00:00.000Z",
    ...overrides,
  };
}

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "card",
    vocabEntryId: "entry",
    direction: "de_to_en",
    state: "review",
    dueAt: "2026-05-22T08:00:00.000Z",
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 1,
    lapses: 0,
    ...overrides,
  };
}

function reviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: "log",
    cardId: "card",
    reviewedAt: "2026-05-22T08:00:00.000Z",
    rating: "good",
    previousDueAt: "2026-05-22T08:00:00.000Z",
    nextDueAt: "2026-05-23T08:00:00.000Z",
    ...overrides,
  };
}
