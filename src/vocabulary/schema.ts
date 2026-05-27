import type { Level, PartOfSpeech, VocabDraft, VocabEntry } from "../types/vocab";

export const partOfSpeechOptions: PartOfSpeech[] = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "other",
];

export const levelOptions: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const vocabularyCsvHeaders = [
  "notebook",
  "german",
  "english",
  "partOfSpeech",
  "article",
  "plural",
  "exampleGerman",
  "exampleEnglish",
  "level",
  "topic",
  "sourceName",
  "sourceUrl",
  "notes",
] as const;

export type VocabularyCsvHeader = (typeof vocabularyCsvHeaders)[number];

export const emptyVocabularyDraft: VocabDraft = {
  german: "",
  english: "",
  partOfSpeech: "noun",
  article: undefined,
  plural: "",
  exampleGerman: "",
  exampleEnglish: "",
  level: "A1",
  topic: "",
  sourceName: "Manual",
  sourceUrl: "",
  notes: "",
};

export function draftFromVocabulary(initial: VocabDraft | VocabEntry): VocabDraft {
  return {
    german: initial.german ?? "",
    english: initial.english ?? "",
    partOfSpeech: initial.partOfSpeech ?? "noun",
    article: initial.article,
    plural: initial.plural ?? "",
    exampleGerman: initial.exampleGerman ?? "",
    exampleEnglish: initial.exampleEnglish ?? "",
    level: initial.level ?? "A1",
    topic: initial.topic ?? "",
    sourceName: initial.sourceName ?? "Manual",
    sourceUrl: initial.sourceUrl ?? "",
    notes: initial.notes ?? "",
  };
}
