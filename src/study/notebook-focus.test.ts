import { describe, expect, it } from "vitest";
import { filterCardsForNotebook, filterEntriesForNotebook, notebookCounts } from "./notebook-focus";
import type { Card, Notebook, NotebookEntry, VocabEntry } from "../types/vocab";

describe("notebook focus", () => {
  it("filters entries and cards to one notebook", () => {
    const links: NotebookEntry[] = [link("travel", "entry-1")];

    expect(filterEntriesForNotebook([entry("entry-1"), entry("entry-2")], links, "travel").map((item) => item.id)).toEqual(["entry-1"]);
    expect(filterCardsForNotebook([card("card-1", "entry-1"), card("card-2", "entry-2")], links, "travel").map((item) => item.id)).toEqual(["card-1"]);
  });

  it("returns all entries and cards when focus is all notebooks", () => {
    expect(filterEntriesForNotebook([entry("entry-1")], [], undefined)).toHaveLength(1);
    expect(filterCardsForNotebook([card("card-1", "entry-1")], [], undefined)).toHaveLength(1);
  });

  it("counts notebook entries, cards, and due cards", () => {
    const notebooks: Notebook[] = [
      notebook("travel", "Travel"),
      notebook("home", "Home"),
    ];
    const counts = notebookCounts(
      notebooks,
      [entry("entry-1"), entry("entry-2")],
      [card("card-1", "entry-1"), card("card-2", "entry-2", "suspended")],
      [link("travel", "entry-1"), link("home", "entry-2")],
      (item) => item.state !== "suspended",
    );

    expect(counts).toMatchObject([
      { notebook: { name: "Home" }, entryCount: 1, cardCount: 1, dueCardCount: 0 },
      { notebook: { name: "Travel" }, entryCount: 1, cardCount: 1, dueCardCount: 1 },
    ]);
  });
});

function notebook(id: string, name: string): Notebook {
  return {
    id,
    name,
    createdAt: "2026-05-22T08:00:00.000Z",
    updatedAt: "2026-05-22T08:00:00.000Z",
  };
}

function entry(id: string): VocabEntry {
  return {
    id,
    german: id,
    english: id,
    createdAt: "2026-05-22T08:00:00.000Z",
    updatedAt: "2026-05-22T08:00:00.000Z",
  };
}

function card(id: string, vocabEntryId: string, state: Card["state"] = "review"): Card {
  return {
    id,
    vocabEntryId,
    direction: "de_to_en",
    state,
    dueAt: "2026-05-22T08:00:00.000Z",
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 1,
    lapses: 0,
  };
}

function link(notebookId: string, vocabEntryId: string): NotebookEntry {
  return {
    id: `${notebookId}::${vocabEntryId}`,
    notebookId,
    vocabEntryId,
    addedAt: "2026-05-22T08:00:00.000Z",
  };
}
