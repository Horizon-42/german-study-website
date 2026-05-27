import { createNewCard } from "../scheduler/fsrs";
import type { Card, CardDirection, VocabEntry } from "../types/vocab";

export type ReviewMode = "words" | "articles";

export type StudyPrompt = {
  mode: string;
  prompt: string;
  answer: string;
  context?: string;
  detail?: string;
};

const directionsByMode: Record<ReviewMode, CardDirection[]> = {
  words: ["de_to_en"],
  articles: ["article", "article_case"],
};

export function directionsForReviewMode(mode: ReviewMode): CardDirection[] {
  return directionsByMode[mode];
}

export function createPracticeCardsForEntry(entry: VocabEntry, now = new Date()): Card[] {
  const cards = [createNewCard(entry.id, "de_to_en", now)];

  if (entry.partOfSpeech === "noun" && entry.article) {
    cards.push(createNewCard(entry.id, "article", now));
    cards.push(createNewCard(entry.id, "article_case", now, { articleCase: "nominative" }));
    cards.push(createNewCard(entry.id, "article_case", now, { articleCase: "accusative" }));
    cards.push(createNewCard(entry.id, "article_case", now, { articleCase: "dative" }));
    cards.push(createNewCard(entry.id, "article_case", now, { articleCase: "genitive" }));
  }

  if (entry.exampleGerman && entry.exampleGerman.includes(entry.german)) {
    cards.push(createNewCard(entry.id, "example_cloze", now));
  }

  return cards;
}

export function buildPracticePrompt(card: Card, entry: VocabEntry): StudyPrompt {
  const prompts: Record<CardDirection, StudyPrompt> = {
    de_to_en: {
      mode: "German -> English",
      prompt: displayGerman(entry),
      answer: entry.english,
      detail: entry.exampleGerman,
    },
    article: {
      mode: "Article",
      prompt: entry.german,
      answer: entry.article ?? "",
      context: "der, die, or das",
      detail: entry.plural ? `Plural: ${entry.plural}` : undefined,
    },
    article_case: {
      mode: "Article case",
      prompt: `${caseLabel(card.articleCase)} definite article for ${entry.german}`,
      answer: articleForm(entry.article, card.articleCase),
      context: "nominative, accusative, dative, genitive",
      detail: articleDetail(entry.article),
    },
    example_cloze: {
      mode: "Cloze",
      prompt: entry.exampleGerman?.replace(entry.german, "_____") ?? entry.german,
      answer: displayGerman(entry),
      context: entry.exampleEnglish,
    },
  };

  return prompts[card.direction];
}

export function practiceCardIdentity(card: Pick<Card, "direction" | "articleCase">): string {
  return `${card.direction}:${card.articleCase ?? ""}`;
}

export function practiceDirectionLabel(direction: CardDirection): string {
  return {
    de_to_en: "DE -> EN",
    article: "Article",
    article_case: "Case article",
    example_cloze: "Cloze",
  }[direction];
}

export function displayGerman(entry: VocabEntry): string {
  if (entry.partOfSpeech === "noun" && entry.article && !/^(der|die|das)\s+/i.test(entry.german)) {
    return `${entry.article} ${entry.german}`;
  }

  return entry.german;
}

function caseLabel(articleCase: Card["articleCase"]): string {
  return {
    nominative: "Nominative",
    accusative: "Accusative",
    dative: "Dative",
    genitive: "Genitive",
  }[articleCase ?? "nominative"];
}

function articleForm(article: VocabEntry["article"], articleCase: Card["articleCase"]): string {
  if (!article) {
    return "";
  }

  const forms = {
    der: { nominative: "der", accusative: "den", dative: "dem", genitive: "des" },
    die: { nominative: "die", accusative: "die", dative: "der", genitive: "der" },
    das: { nominative: "das", accusative: "das", dative: "dem", genitive: "des" },
  } as const;

  return forms[article][articleCase ?? "nominative"];
}

function articleDetail(article: VocabEntry["article"]): string | undefined {
  if (!article) {
    return undefined;
  }

  return `Forms: ${articleForm(article, "nominative")} / ${articleForm(article, "accusative")} / ${articleForm(article, "dative")} / ${articleForm(article, "genitive")}`;
}
