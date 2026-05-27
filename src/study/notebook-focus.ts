import type { Card, Notebook, NotebookEntry, VocabEntry } from "../types/vocab";

export type NotebookCount = {
  notebook: Notebook;
  entryCount: number;
  cardCount: number;
  dueCardCount: number;
};

export function filterCardsForNotebook(
  cards: Card[],
  notebookEntries: NotebookEntry[],
  notebookId?: string,
): Card[] {
  if (!notebookId) {
    return cards;
  }

  const entryIds = entryIdsForNotebook(notebookEntries, notebookId);
  return cards.filter((card) => entryIds.has(card.vocabEntryId));
}

export function filterEntriesForNotebook(
  entries: VocabEntry[],
  notebookEntries: NotebookEntry[],
  notebookId?: string,
): VocabEntry[] {
  if (!notebookId) {
    return entries;
  }

  const entryIds = entryIdsForNotebook(notebookEntries, notebookId);
  return entries.filter((entry) => entryIds.has(entry.id));
}

export function notebookCounts(
  notebooks: Notebook[],
  entries: VocabEntry[],
  cards: Card[],
  notebookEntries: NotebookEntry[],
  isDue: (card: Card) => boolean,
): NotebookCount[] {
  const validEntryIds = new Set(entries.map((entry) => entry.id));

  return notebooks
    .map((notebook) => {
      const entryIds = entryIdsForNotebook(notebookEntries, notebook.id);
      const filteredCards = cards.filter((card) => entryIds.has(card.vocabEntryId));

      return {
        notebook,
        entryCount: [...entryIds].filter((entryId) => validEntryIds.has(entryId)).length,
        cardCount: filteredCards.length,
        dueCardCount: filteredCards.filter(isDue).length,
      };
    })
    .sort((a, b) => a.notebook.name.localeCompare(b.notebook.name));
}

function entryIdsForNotebook(notebookEntries: NotebookEntry[], notebookId: string): Set<string> {
  return new Set(
    notebookEntries
      .filter((link) => link.notebookId === notebookId)
      .map((link) => link.vocabEntryId),
  );
}
