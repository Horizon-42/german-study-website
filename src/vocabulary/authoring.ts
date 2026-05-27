import type { Article, Level, PartOfSpeech, VocabDraft, VocabEntry } from "../types/vocab";
import { levelOptions, partOfSpeechOptions } from "./schema";

export type VocabularyInput = Record<string, unknown>;

export type VocabularyValidationError = {
  field: "german" | "english" | "article";
  message: string;
};

const articleOptions: Article[] = ["der", "die", "das"];

export function normalizeVocabularyDraft(values: VocabularyInput): VocabDraft {
  const rawGerman = clean(values.german);
  const articleFromColumn = oneOf<Article>(clean(values.article), articleOptions);
  const leadingArticle = rawGerman.match(/^(der|die|das)\s+(.+)$/i);
  const inferredArticle = leadingArticle?.[1].toLowerCase() as Article | undefined;
  const partOfSpeech = oneOf<PartOfSpeech>(clean(values.partOfSpeech), partOfSpeechOptions)
    ?? (articleFromColumn ?? inferredArticle ? "noun" : undefined);
  const german = partOfSpeech === "noun" && leadingArticle ? leadingArticle[2].trim() : rawGerman;
  const draft = {
    german,
    english: clean(values.english),
    partOfSpeech,
    article: partOfSpeech === "noun" ? articleFromColumn ?? inferredArticle : undefined,
    plural: clean(values.plural),
    exampleGerman: clean(values.exampleGerman),
    exampleEnglish: clean(values.exampleEnglish),
    level: oneOf<Level>(clean(values.level).toUpperCase(), levelOptions),
    topic: clean(values.topic),
    sourceName: clean(values.sourceName),
    sourceUrl: clean(values.sourceUrl),
    notes: clean(values.notes),
  };

  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== "" && value !== undefined),
  ) as VocabDraft;
}

export function validateVocabularyDraft(draft: VocabDraft): VocabularyValidationError[] {
  const errors: VocabularyValidationError[] = [];

  if (!draft.german) {
    errors.push({ field: "german", message: "`german` and `english` are required." });
  }

  if (!draft.english) {
    errors.push({ field: "english", message: "`german` and `english` are required." });
  }

  if (draft.partOfSpeech === "noun" && !draft.article) {
    errors.push({ field: "article", message: "Nouns must include `article` as der, die, or das." });
  }

  return dedupeValidationErrors(errors);
}

export function materializeVocabularyEntry(
  draft: VocabDraft,
  now: Date,
  createId: () => string = defaultCreateId,
): VocabEntry {
  const normalized = normalizeVocabularyDraft(draft);
  const [error] = validateVocabularyDraft(normalized);

  if (error) {
    throw new Error(error.message);
  }

  const timestamp = now.toISOString();
  return {
    id: createId(),
    german: normalized.german,
    english: normalized.english,
    partOfSpeech: normalized.partOfSpeech,
    article: normalized.article,
    plural: normalized.plural,
    exampleGerman: normalized.exampleGerman,
    exampleEnglish: normalized.exampleEnglish,
    level: normalized.level,
    topic: normalized.topic,
    sourceName: normalized.sourceName ?? "Manual seed",
    sourceUrl: normalized.sourceUrl,
    notes: normalized.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function reviseVocabularyEntry(entry: VocabEntry, now: Date): VocabEntry {
  const normalized = normalizeVocabularyDraft(entry);
  const [error] = validateVocabularyDraft(normalized);

  if (error) {
    throw new Error(error.message);
  }

  const revised: VocabEntry = {
    ...entry,
    ...normalized,
    sourceName: normalized.sourceName ?? "Manual seed",
    updatedAt: now.toISOString(),
  };

  clearMissingOptionalFields(revised, normalized);
  return revised;
}

export function vocabularyIdentity(entry: Pick<VocabDraft | VocabEntry, "german" | "english">): string {
  return `${clean(entry.german).toLowerCase()}::${clean(entry.english).toLowerCase()}`;
}

function dedupeValidationErrors(errors: VocabularyValidationError[]): VocabularyValidationError[] {
  const seenMessages = new Set<string>();
  return errors.filter((error) => {
    if (seenMessages.has(error.message)) {
      return false;
    }
    seenMessages.add(error.message);
    return true;
  });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function clearMissingOptionalFields(entry: VocabEntry, normalized: VocabDraft): void {
  const optionalFields: Array<keyof VocabDraft> = [
    "partOfSpeech",
    "article",
    "plural",
    "exampleGerman",
    "exampleEnglish",
    "level",
    "topic",
    "sourceUrl",
    "notes",
  ];

  optionalFields.forEach((field) => {
    if (normalized[field] === undefined) {
      delete entry[field];
    }
  });
}

function defaultCreateId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
