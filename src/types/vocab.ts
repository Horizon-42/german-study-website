export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "phrase"
  | "other";

export type Article = "der" | "die" | "das";
export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ArticleCase = "nominative" | "accusative" | "dative" | "genitive";
export type CardDirection = "de_to_en" | "article" | "article_case" | "example_cloze";
export type CardState = "new" | "learning" | "review" | "relearning" | "suspended";
export type Rating = "again" | "hard" | "good" | "easy";

export type Notebook = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sourceName?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotebookDraft = Omit<Notebook, "id" | "createdAt" | "updatedAt">;

export type NotebookEntry = {
  id: string;
  notebookId: string;
  vocabEntryId: string;
  addedAt: string;
};

export type VocabEntry = {
  id: string;
  german: string;
  english: string;
  partOfSpeech?: PartOfSpeech;
  article?: Article;
  plural?: string;
  exampleGerman?: string;
  exampleEnglish?: string;
  level?: Level;
  topic?: string;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type VocabDraft = Omit<VocabEntry, "id" | "createdAt" | "updatedAt">;

export type Card = {
  id: string;
  vocabEntryId: string;
  direction: CardDirection;
  articleCase?: ArticleCase;
  state: CardState;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewedAt?: string;
};

export type ReviewLog = {
  id: string;
  cardId: string;
  reviewedAt: string;
  rating: Rating;
  previousDueAt: string;
  nextDueAt: string;
  responseMs?: number;
};

export type Settings = {
  id: "settings";
  dailyNewLimit: number;
  targetRetention: number;
  focusNotebookId?: string;
};

export type StudyState = {
  entries: VocabEntry[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  notebooks: Notebook[];
  notebookEntries: NotebookEntry[];
  settings: Settings;
};

export type ExportPayload = StudyState & {
  exportedAt: string;
  schemaVersion: 2;
};
