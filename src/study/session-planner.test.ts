import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  buildStats,
  buildStudyQueue,
  displayGerman,
  isDue,
} from "./session-planner";
import type { Card, ReviewLog, Settings, StudyState, VocabEntry } from "../types/vocab";

const now = new Date("2026-05-22T08:00:00.000Z");
const settings: Settings = {
  id: "settings",
  dailyNewLimit: 2,
  targetRetention: 0.9,
};

describe("study session planner", () => {
  it("keeps non-German-to-English practice out of the word review queue", () => {
    const queue = buildStudyQueue(
      [
        card({ id: "word", direction: "de_to_en", state: "review", dueAt: "2026-05-22T07:00:00.000Z" }),
        card({ id: "cloze", direction: "example_cloze", state: "review", dueAt: "2026-05-22T07:30:00.000Z" }),
        card({ id: "article", direction: "article", state: "review", dueAt: "2026-05-22T06:00:00.000Z" }),
        card({ id: "case", direction: "article_case", state: "review", dueAt: "2026-05-22T06:30:00.000Z" }),
      ],
      settings,
      "words",
      { now },
    );

    expect(queue.map((item) => item.id)).toEqual(["word"]);
  });

  it("builds an article queue from article cards only", () => {
    const queue = buildStudyQueue(
      [
        card({ id: "word", direction: "de_to_en", state: "review", dueAt: "2026-05-22T07:00:00.000Z" }),
        card({ id: "article", direction: "article", state: "review", dueAt: "2026-05-22T06:00:00.000Z" }),
        card({ id: "case", direction: "article_case", state: "new", dueAt: "2026-05-22T06:30:00.000Z" }),
      ],
      settings,
      "articles",
      { now },
    );

    expect(queue.map((item) => item.id)).toEqual(["article", "case"]);
  });

  it("orders review cards by due time before capped new cards", () => {
    const queue = buildStudyQueue(
      [
        card({ id: "new-1", direction: "de_to_en", state: "new", dueAt: "2026-05-22T07:00:00.000Z" }),
        card({ id: "new-2", direction: "de_to_en", state: "new", dueAt: "2026-05-22T07:00:00.000Z" }),
        card({ id: "new-3", direction: "de_to_en", state: "new", dueAt: "2026-05-22T07:00:00.000Z" }),
        card({ id: "late-review", direction: "de_to_en", state: "review", dueAt: "2026-05-22T07:30:00.000Z" }),
        card({ id: "early-review", direction: "de_to_en", state: "learning", dueAt: "2026-05-22T06:30:00.000Z" }),
      ],
      settings,
      "words",
      { now },
    );

    expect(queue.map((item) => item.id)).toEqual(["early-review", "late-review", "new-1", "new-2"]);
  });

  it("builds German-to-English and article-case prompts", () => {
    const entry = vocabEntry({
      german: "Haus",
      english: "house",
      partOfSpeech: "noun",
      article: "das",
      exampleGerman: "Das Haus ist groß.",
      exampleEnglish: "The house is big.",
    });

    expect(buildPrompt(card({ direction: "de_to_en" }), entry)).toMatchObject({
      mode: "German -> English",
      prompt: "das Haus",
      answer: "house",
      detail: "Das Haus ist groß.",
    });
    expect(buildPrompt(card({ direction: "article_case", articleCase: "dative" }), entry)).toMatchObject({
      mode: "Article case",
      prompt: "Dative definite article for Haus",
      answer: "dem",
      detail: "Forms: das / das / dem / des",
    });
  });

  it("calculates dashboard stats from an explicit clock", () => {
    const reviewLogs: ReviewLog[] = [
      reviewLog({ cardId: "word", reviewedAt: "2026-05-22T07:00:00.000Z" }),
      reviewLog({ cardId: "word", reviewedAt: "2026-05-21T10:00:00.000Z" }),
      reviewLog({ cardId: "word", reviewedAt: "2026-05-20T10:00:00.000Z" }),
    ];
    const state: StudyState = {
      entries: [],
      cards: [
        card({ id: "word", direction: "de_to_en", state: "review", dueAt: "2026-05-22T07:00:00.000Z" }),
        card({ id: "article", direction: "article", state: "review", dueAt: "2026-05-22T07:00:00.000Z" }),
      ],
      reviewLogs,
      notebooks: [],
      notebookEntries: [],
      settings,
    };

    expect(buildStats(state, now)).toEqual({
      dueCards: 1,
      newCardsDue: 0,
      studiedToday: 1,
      streak: 3,
    });
  });

  it("calculates dashboard stats inside the selected notebook focus", () => {
    const state: StudyState = {
      entries: [],
      cards: [
        card({ id: "travel-card", vocabEntryId: "travel-entry", direction: "de_to_en" }),
        card({ id: "home-card", vocabEntryId: "home-entry", direction: "de_to_en" }),
      ],
      reviewLogs: [
        reviewLog({ id: "travel-log", cardId: "travel-card", reviewedAt: "2026-05-22T07:00:00.000Z" }),
        reviewLog({ id: "home-log", cardId: "home-card", reviewedAt: "2026-05-22T07:30:00.000Z" }),
      ],
      notebooks: [],
      notebookEntries: [
        {
          id: "travel::travel-entry",
          notebookId: "travel",
          vocabEntryId: "travel-entry",
          addedAt: "2026-05-22T07:00:00.000Z",
        },
      ],
      settings: { ...settings, focusNotebookId: "travel" },
    };

    expect(buildStats(state, now)).toMatchObject({
      dueCards: 1,
      studiedToday: 1,
      streak: 1,
    });
  });

  it("checks due status against an explicit clock", () => {
    expect(isDue(card({ dueAt: "2026-05-22T07:59:59.000Z" }), now)).toBe(true);
    expect(isDue(card({ dueAt: "2026-05-22T08:00:01.000Z" }), now)).toBe(false);
  });

  it("displays noun articles once", () => {
    expect(displayGerman(vocabEntry({ german: "Haus", partOfSpeech: "noun", article: "das" }))).toBe("das Haus");
    expect(displayGerman(vocabEntry({ german: "das Haus", partOfSpeech: "noun", article: "das" }))).toBe("das Haus");
  });

  it("focuses queues to the selected notebook", () => {
    const queue = buildStudyQueue(
      [
        card({ id: "travel-card", vocabEntryId: "travel-entry" }),
        card({ id: "home-card", vocabEntryId: "home-entry" }),
      ],
      settings,
      "words",
      {
        now,
        notebookId: "travel",
        notebookEntries: [
          {
            id: "travel::travel-entry",
            notebookId: "travel",
            vocabEntryId: "travel-entry",
            addedAt: "2026-05-22T07:00:00.000Z",
          },
        ],
      },
    );

    expect(queue.map((item) => item.id)).toEqual(["travel-card"]);
  });
});

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "card",
    vocabEntryId: "entry",
    direction: "de_to_en",
    state: "review",
    dueAt: "2026-05-22T07:00:00.000Z",
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 1,
    lapses: 0,
    ...overrides,
  };
}

function vocabEntry(overrides: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: "entry",
    german: "Haus",
    english: "house",
    createdAt: "2026-05-22T07:00:00.000Z",
    updatedAt: "2026-05-22T07:00:00.000Z",
    ...overrides,
  };
}

function reviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: "log",
    cardId: "card",
    reviewedAt: "2026-05-22T07:00:00.000Z",
    rating: "good",
    previousDueAt: "2026-05-22T07:00:00.000Z",
    nextDueAt: "2026-05-23T07:00:00.000Z",
    ...overrides,
  };
}
