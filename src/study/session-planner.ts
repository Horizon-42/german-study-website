import type {
  Card,
  CardDirection,
  ReviewLog,
  Settings,
  StudyState,
  VocabEntry,
} from "../types/vocab";
import {
  buildPracticePrompt,
  directionsForReviewMode,
  displayGerman,
  practiceDirectionLabel,
  type ReviewMode,
  type StudyPrompt,
} from "./practice-policy";
import { filterCardsForNotebook, filterEntriesForNotebook } from "./notebook-focus";

export type { ReviewMode, StudyPrompt };

export type StudyStats = {
  dueCards: number;
  newCardsDue: number;
  studiedToday: number;
  streak: number;
};

export type TopicCount = {
  name: string;
  count: number;
};

export type StudyQueueOptions = {
  now?: Date;
  notebookId?: string;
  notebookEntries?: StudyState["notebookEntries"];
};

export function buildStudyQueue(
  cards: Card[],
  settings: Settings,
  mode: ReviewMode,
  options: StudyQueueOptions = {},
): Card[] {
  const now = options.now ?? new Date();
  const focusedCards = filterCardsForNotebook(cards, options.notebookEntries ?? [], options.notebookId);
  const due = focusedCards.filter((card) => {
    const inMode = directionsForReviewMode(mode).includes(card.direction);
    return inMode && card.state !== "suspended" && isDue(card, now);
  });
  const review = due
    .filter((card) => card.state !== "new")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const fresh = due
    .filter((card) => card.state === "new")
    .slice(0, settings.dailyNewLimit);

  return [...review, ...fresh];
}

export function buildStats(state: StudyState, now = new Date()): StudyStats {
  const focusedCards = filterCardsForNotebook(state.cards, state.notebookEntries, state.settings.focusNotebookId);
  const focusedCardIds = new Set(focusedCards.map((card) => card.id));
  const focusedLogs = state.reviewLogs.filter((log) => focusedCardIds.has(log.cardId));
  const queue = buildStudyQueue(state.cards, state.settings, "words", {
    now,
    notebookId: state.settings.focusNotebookId,
    notebookEntries: state.notebookEntries,
  });
  const todayKey = dateKey(now);
  const studiedToday = focusedLogs.filter((log) => dateKey(new Date(log.reviewedAt)) === todayKey).length;

  return {
    dueCards: queue.length,
    newCardsDue: queue.filter((card) => card.state === "new").length,
    studiedToday,
    streak: studyStreak(focusedLogs, now),
  };
}

export function buildPrompt(card: Card, entry: VocabEntry): StudyPrompt {
  return buildPracticePrompt(card, entry);
}

export function topicCounts(entries: VocabEntry[]): TopicCount[] {
  const focusedEntries = entries;
  const counts = new Map<string, number>();
  focusedEntries.forEach((entry) => counts.set(entry.topic ?? "General", (counts.get(entry.topic ?? "General") ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function isDue(card: Card, now = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}

export function formatDue(iso: string, now = new Date()): string {
  const due = new Date(iso);
  if (due.getTime() <= now.getTime()) {
    return "now";
  }

  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function directionLabel(direction: CardDirection): string {
  return practiceDirectionLabel(direction);
}

export function focusedTopicCounts(state: StudyState): TopicCount[] {
  return topicCounts(filterEntriesForNotebook(
    state.entries,
    state.notebookEntries,
    state.settings.focusNotebookId,
  ));
}

function studyStreak(logs: ReviewLog[], now: Date): number {
  const days = new Set(logs.map((log) => dateKey(new Date(log.reviewedAt))));
  let streak = 0;
  const cursor = new Date(now);

  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export { displayGerman };
