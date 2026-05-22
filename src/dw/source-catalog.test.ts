import { describe, expect, it } from "vitest";
import {
  dwSourceTopics,
  filterDwSources,
  findDwSource,
  initialDwSource,
  sourceToVocabularyDraft,
} from "./source-catalog";
import type { DWSource } from "./source-catalog";

const sources: DWSource[] = [
  {
    id: "course-a1",
    title: "Nicos Weg",
    url: "https://learngerman.dw.com/en/nicos-weg/c-36519789",
    kind: "course",
    level: "A1",
    topic: "Course",
  },
  {
    id: "lesson-food",
    title: "Eine Pizza, bitte",
    url: "https://learngerman.dw.com/en/eine-pizza-bitte/l-37279261",
    kind: "lesson",
    level: "A1",
    topic: "Food",
  },
  {
    id: "article-guide",
    title: "Learn German free online",
    url: "https://learngerman.dw.com/en/learn-german-free-online/a-62657339",
    kind: "article",
    topic: "Guide",
  },
];

describe("DW source catalog", () => {
  it("finds the initial and selected DW sources", () => {
    expect(initialDwSource(sources)).toBe(sources[0]);
    expect(findDwSource("lesson-food", sources)).toBe(sources[1]);
    expect(findDwSource("missing", sources)).toBeUndefined();
  });

  it("filters sources by query, kind, and level", () => {
    expect(filterDwSources({ query: " pizza " }, sources).map((source) => source.id)).toEqual(["lesson-food"]);
    expect(filterDwSources({ query: "guide" }, sources).map((source) => source.id)).toEqual(["article-guide"]);
    expect(filterDwSources({ kind: "course" }, sources).map((source) => source.id)).toEqual(["course-a1"]);
    expect(filterDwSources({ level: "A1", kind: "lesson" }, sources).map((source) => source.id)).toEqual(["lesson-food"]);
  });

  it("returns sorted unique source topics", () => {
    expect(dwSourceTopics([...sources, { ...sources[1], id: "lesson-food-2" }])).toEqual([
      "Course",
      "Food",
      "Guide",
    ]);
  });

  it("creates an attribution-ready vocabulary draft", () => {
    expect(sourceToVocabularyDraft(sources[1])).toMatchObject({
      german: "",
      english: "",
      partOfSpeech: "noun",
      level: "A1",
      topic: "Food",
      sourceName: "DW Learn German",
      sourceUrl: "https://learngerman.dw.com/en/eine-pizza-bitte/l-37279261",
      notes: "DW source: Eine Pizza, bitte",
    });
  });

  it("defaults source drafts without a level to A1", () => {
    expect(sourceToVocabularyDraft(sources[2]).level).toBe("A1");
  });

  it("fails loudly when the catalog is empty", () => {
    expect(() => initialDwSource([])).toThrow("DW source catalog is empty.");
  });
});
