import { describe, expect, it } from "vitest";
import { parseVocabularyInput, serializeEntriesCsv } from "./importers";
import type { VocabEntry } from "../types/vocab";

const existing: VocabEntry[] = [
  {
    id: "1",
    german: "Haus",
    english: "house",
    article: "das",
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
  },
];

describe("vocabulary importers", () => {
  it("parses valid CSV rows", () => {
    const preview = parseVocabularyInput(
      "notebook,german,english,article,level\nFamily,Mutter,mother,die,A1\nVerbs,gehen,to go,,A1",
      existing,
    );

    expect(preview.errors).toEqual([]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0].draft.article).toBe("die");
    expect(preview.rows[0].draft.level).toBe("A1");
    expect(preview.rows[0].notebookName).toBe("Family");
  });

  it("marks duplicates from existing entries", () => {
    const preview = parseVocabularyInput("german,english\nHaus,house", existing);

    expect(preview.rows[0].duplicate).toBe(true);
  });

  it("uses normalized duplicate identity", () => {
    const preview = parseVocabularyInput("german,english\n haus , House ", existing);

    expect(preview.rows[0].duplicate).toBe(true);
  });

  it("validates required fields", () => {
    const preview = parseVocabularyInput("german,english\nWasser,", existing);

    expect(preview.errors[0].message).toContain("required");
  });

  it("requires articles for imported nouns", () => {
    const preview = parseVocabularyInput("german,english,partOfSpeech\nWasser,water,noun", []);

    expect(preview.errors[0].message).toContain("Nouns");
  });

  it("can infer noun articles from the German column", () => {
    const preview = parseVocabularyInput("german,english,partOfSpeech\ndas Wasser,water,noun", []);

    expect(preview.errors).toEqual([]);
    expect(preview.rows[0].draft.german).toBe("Wasser");
    expect(preview.rows[0].draft.article).toBe("das");
  });

  it("parses exported JSON payloads", () => {
    const preview = parseVocabularyInput(JSON.stringify({ entries: existing }), []);

    expect(preview.rows[0].draft.german).toBe("Haus");
  });

  it("preserves notebook membership when parsing exported JSON payloads", () => {
    const preview = parseVocabularyInput(JSON.stringify({
      entries: existing,
      notebooks: [
        {
          id: "notebook-home",
          name: "Home",
          createdAt: "2026-05-22T00:00:00.000Z",
          updatedAt: "2026-05-22T00:00:00.000Z",
        },
      ],
      notebookEntries: [
        {
          id: "notebook-home::1",
          notebookId: "notebook-home",
          vocabEntryId: "1",
          addedAt: "2026-05-22T00:00:00.000Z",
        },
      ],
    }), []);

    expect(preview.rows[0]).toMatchObject({
      notebookName: "Home",
      draft: { german: "Haus" },
    });
  });

  it("serializes CSV with escaping", () => {
    const csv = serializeEntriesCsv([
      {
        ...existing[0],
        notes: "common, useful",
      },
    ]);

    expect(csv).toContain("notebook,german,english");
    expect(csv).toContain("\"common, useful\"");
  });
});
