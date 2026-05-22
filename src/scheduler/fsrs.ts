import type { Card, Rating, Settings } from "../types/vocab";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DECAY = -0.5;
const FACTOR = 19 / 81;

export const defaultSchedulerSettings: Settings = {
  id: "settings",
  dailyNewLimit: 10,
  targetRetention: 0.9,
};

export function createNewCard(
  vocabEntryId: string,
  direction: Card["direction"],
  now = new Date(),
  options: Pick<Card, "articleCase"> = {},
): Card {
  return {
    id: cryptoId(),
    vocabEntryId,
    direction,
    ...options,
    state: "new",
    dueAt: now.toISOString(),
    stability: 0.4,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
  };
}

export function rescheduleCard(
  card: Card,
  rating: Rating,
  settings: Pick<Settings, "targetRetention"> = defaultSchedulerSettings,
  now = new Date(),
): Card {
  const elapsedDays = daysBetween(card.lastReviewedAt ?? card.dueAt, now);
  const retrievability = getRetrievability(elapsedDays, card.stability);
  const isNew = card.state === "new" && card.reps === 0;
  const base = {
    ...card,
    reps: card.reps + 1,
    elapsedDays,
    lastReviewedAt: now.toISOString(),
  };

  if (isNew) {
    return scheduleNewCard(base, rating, now);
  }

  if (rating === "again") {
    return {
      ...base,
      state: "relearning",
      stability: round2(Math.max(0.2, card.stability * 0.35)),
      difficulty: clamp(round2(card.difficulty + 1.1), 1, 10),
      scheduledDays: 0,
      dueAt: new Date(now.getTime() + 5 * MINUTE_MS).toISOString(),
      lapses: card.lapses + 1,
    };
  }

  const nextDifficulty = nextDifficultyValue(card.difficulty, rating);
  const nextStability = nextStabilityValue(
    card.stability,
    nextDifficulty,
    retrievability,
    rating,
  );
  const scheduledDays = intervalFromStability(nextStability, settings.targetRetention);

  return {
    ...base,
    state: "review",
    stability: nextStability,
    difficulty: nextDifficulty,
    scheduledDays,
    dueAt: new Date(now.getTime() + scheduledDays * DAY_MS).toISOString(),
  };
}

export function getRetrievability(elapsedDays: number, stability: number): number {
  if (elapsedDays <= 0) {
    return 1;
  }

  return Math.pow(1 + FACTOR * (elapsedDays / Math.max(stability, 0.1)), DECAY);
}

export function intervalFromStability(stability: number, targetRetention: number): number {
  const retention = clamp(targetRetention, 0.7, 0.98);
  const multiplier = Math.log(retention) / Math.log(0.9);
  return Math.max(1, Math.round(stability * multiplier));
}

function scheduleNewCard(card: Card, rating: Rating, now: Date): Card {
  if (rating === "again") {
    return {
      ...card,
      state: "learning",
      stability: 0.25,
      difficulty: 6.6,
      scheduledDays: 0,
      dueAt: new Date(now.getTime() + 5 * MINUTE_MS).toISOString(),
      lapses: card.lapses + 1,
    };
  }

  if (rating === "hard") {
    return {
      ...card,
      state: "learning",
      stability: 0.35,
      difficulty: 6,
      scheduledDays: 0,
      dueAt: new Date(now.getTime() + 10 * MINUTE_MS).toISOString(),
    };
  }

  if (rating === "easy") {
    return {
      ...card,
      state: "review",
      stability: 3,
      difficulty: 4.2,
      scheduledDays: 3,
      dueAt: new Date(now.getTime() + 3 * DAY_MS).toISOString(),
    };
  }

  return {
    ...card,
    state: "review",
    stability: 1,
    difficulty: 5,
    scheduledDays: 1,
    dueAt: new Date(now.getTime() + DAY_MS).toISOString(),
  };
}

function nextDifficultyValue(currentDifficulty: number, rating: Rating): number {
  const deltaByRating: Record<Rating, number> = {
    again: 1.1,
    hard: 0.45,
    good: -0.15,
    easy: -0.55,
  };

  return clamp(round2(currentDifficulty + deltaByRating[rating]), 1, 10);
}

function nextStabilityValue(
  currentStability: number,
  difficulty: number,
  retrievability: number,
  rating: Exclude<Rating, "again">,
): number {
  const ratingBonus = {
    hard: 0.55,
    good: 1,
    easy: 1.8,
  }[rating];
  const difficultyFactor = Math.max(0.25, (11 - difficulty) / 10);
  const forgettingFactor = Math.max(0.1, 1.15 - retrievability);
  const growth = 1 + ratingBonus * difficultyFactor * forgettingFactor;

  return round2(Math.max(currentStability + 0.25, currentStability * growth));
}

function daysBetween(fromIso: string, to: Date): number {
  return Math.max(0, (to.getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function cryptoId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
