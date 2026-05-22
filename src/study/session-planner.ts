import type {
  Card,
  CardDirection,
  ReviewLog,
  Settings,
  StudyState,
  VocabEntry,
} from "../types/vocab";

export type ReviewMode = "words" | "articles";

export type StudyPrompt = {
  mode: string;
  prompt: string;
  answer: string;
  context?: string;
  detail?: string;
};

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

const directionsByMode: Record<ReviewMode, CardDirection[]> = {
  words: ["de_to_en"],
  articles: ["article", "article_case"],
};

export function buildStudyQueue(
  cards: Card[],
  settings: Settings,
  mode: ReviewMode,
  now = new Date(),
): Card[] {
  const due = cards.filter((card) => {
    const inMode = directionsByMode[mode].includes(card.direction);
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
  const queue = buildStudyQueue(state.cards, state.settings, "words", now);
  const todayKey = dateKey(now);
  const studiedToday = state.reviewLogs.filter((log) => dateKey(new Date(log.reviewedAt)) === todayKey).length;

  return {
    dueCards: queue.length,
    newCardsDue: queue.filter((card) => card.state === "new").length,
    studiedToday,
    streak: studyStreak(state.reviewLogs, now),
  };
}

export function buildPrompt(card: Card, entry: VocabEntry): StudyPrompt {
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

export function topicCounts(entries: VocabEntry[]): TopicCount[] {
  const counts = new Map<string, number>();
  entries.forEach((entry) => counts.set(entry.topic ?? "General", (counts.get(entry.topic ?? "General") ?? 0) + 1));
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

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
