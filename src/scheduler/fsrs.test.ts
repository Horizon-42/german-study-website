import { describe, expect, it } from "vitest";
import { createNewCard, getRetrievability, rescheduleCard } from "./fsrs";

describe("FSRS-style scheduler", () => {
  const now = new Date("2026-05-22T08:00:00.000Z");

  it("schedules a new good card for tomorrow", () => {
    const card = createNewCard("entry-1", "de_to_en", now);
    const next = rescheduleCard(card, "good", { targetRetention: 0.9 }, now);

    expect(next.state).toBe("review");
    expect(next.scheduledDays).toBe(1);
    expect(new Date(next.dueAt).getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
  });

  it("keeps forgotten cards close and records a lapse", () => {
    const card = createNewCard("entry-1", "de_to_en", now);
    const next = rescheduleCard(card, "again", { targetRetention: 0.9 }, now);

    expect(next.state).toBe("learning");
    expect(next.lapses).toBe(1);
    expect(new Date(next.dueAt).getTime()).toBeGreaterThan(now.getTime());
    expect(new Date(next.dueAt).getTime()).toBeLessThan(now.getTime() + 10 * 60 * 1000);
  });

  it("increases interval for an easy review", () => {
    const card = {
      ...createNewCard("entry-1", "de_to_en", now),
      state: "review" as const,
      reps: 3,
      stability: 4,
      difficulty: 4,
      scheduledDays: 4,
      dueAt: "2026-05-22T08:00:00.000Z",
      lastReviewedAt: "2026-05-18T08:00:00.000Z",
    };
    const next = rescheduleCard(card, "easy", { targetRetention: 0.9 }, now);

    expect(next.scheduledDays).toBeGreaterThan(card.scheduledDays);
    expect(next.stability).toBeGreaterThan(card.stability);
    expect(new Date(next.dueAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns full retrievability when no time elapsed", () => {
    expect(getRetrievability(0, 1)).toBe(1);
  });
});
