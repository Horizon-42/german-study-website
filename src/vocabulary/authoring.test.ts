import { describe, expect, it } from "vitest";
import {
  materializeVocabularyEntry,
  normalizeVocabularyDraft,
  reviseVocabularyEntry,
  validateVocabularyDraft,
  vocabularyIdentity,
} from "./authoring";
import type { VocabEntry } from "../types/vocab";

const now = new Date("2026-05-22T08:00:00.000Z");

describe("vocabulary authoring", () => {
  it("normalizes whitespace, level, and noun articles from learner input", () => {
    const draft = normalizeVocabularyDraft({
      german: "  das   Haus  ",
      english: "  house  ",
      partOfSpeech: "noun",
      level: "a1",
      topic: "  Home   basics ",
    });

    expect(draft).toMatchObject({
      german: "Haus",
      english: "house",
      partOfSpeech: "noun",
      article: "das",
      level: "A1",
      topic: "Home basics",
    });
  });

  it("validates required fields and noun articles through one interface", () => {
    expect(validateVocabularyDraft(normalizeVocabularyDraft({ german: "", english: "" }))).toEqual([
      { field: "german", message: "`german` and `english` are required." },
    ]);
    expect(validateVocabularyDraft(normalizeVocabularyDraft({
      german: "Wasser",
      english: "water",
      partOfSpeech: "noun",
    }))).toEqual([
      { field: "article", message: "Nouns must include `article` as der, die, or das." },
    ]);
  });

  it("materializes a valid entry with attribution defaults and timestamps", () => {
    const entry = materializeVocabularyEntry(
      {
        german: " gehen ",
        english: " to go ",
        partOfSpeech: "verb",
        sourceName: "",
      },
      now,
      () => "entry-1",
    );

    expect(entry).toMatchObject({
      id: "entry-1",
      german: "gehen",
      english: "to go",
      partOfSpeech: "verb",
      sourceName: "Manual seed",
      createdAt: "2026-05-22T08:00:00.000Z",
      updatedAt: "2026-05-22T08:00:00.000Z",
    });
  });

  it("revises an entry without changing its identity fields", () => {
    const existing: VocabEntry = {
      id: "entry-1",
      german: "das Haus",
      english: " house ",
      partOfSpeech: "noun",
      createdAt: "2026-05-21T08:00:00.000Z",
      updatedAt: "2026-05-21T08:00:00.000Z",
    };

    expect(reviseVocabularyEntry(existing, now)).toMatchObject({
      id: "entry-1",
      german: "Haus",
      english: "house",
      article: "das",
      createdAt: "2026-05-21T08:00:00.000Z",
      updatedAt: "2026-05-22T08:00:00.000Z",
    });
  });

  it("clears optional fields and stale articles when revising entries", () => {
    const existing: VocabEntry = {
      id: "entry-1",
      german: "Haus",
      english: "house",
      partOfSpeech: "verb",
      article: "das",
      plural: "",
      exampleGerman: "",
      exampleEnglish: "A house.",
      sourceUrl: "",
      notes: "",
      createdAt: "2026-05-21T08:00:00.000Z",
      updatedAt: "2026-05-21T08:00:00.000Z",
    };

    const revised = reviseVocabularyEntry(existing, now);

    expect(revised).toMatchObject({
      id: "entry-1",
      german: "Haus",
      english: "house",
      partOfSpeech: "verb",
      sourceName: "Manual seed",
      createdAt: "2026-05-21T08:00:00.000Z",
      updatedAt: "2026-05-22T08:00:00.000Z",
    });
    expect(revised).not.toHaveProperty("article");
    expect(revised).not.toHaveProperty("plural");
    expect(revised).not.toHaveProperty("exampleGerman");
    expect(revised).not.toHaveProperty("sourceUrl");
    expect(revised).not.toHaveProperty("notes");
  });

  it("uses the shared duplicate identity for case and whitespace differences", () => {
    expect(vocabularyIdentity({ german: " Haus ", english: "House" })).toBe(
      vocabularyIdentity({ german: "haus", english: " house " }),
    );
  });
});
