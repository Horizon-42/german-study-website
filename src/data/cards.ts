import { createNewCard } from "../scheduler/fsrs";
import type { Card, VocabEntry } from "../types/vocab";

export function cardsForEntry(entry: VocabEntry, now = new Date()): Card[] {
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
