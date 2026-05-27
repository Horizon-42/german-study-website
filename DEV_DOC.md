# German Study Website Dev Doc

## 1. Purpose

Build a study website for learning German. The first function is word learning: a vocabulary trainer that helps the learner acquire and retain German words through active recall, spaced repetition, and lightweight daily practice.

The site should start small, work locally, and make it easy to add more German-learning modules later, such as phrases, listening, grammar, writing, and DW lesson companion exercises.

## 2. Source Material

Primary inspiration and content source path:

- DW Learn German: https://learngerman.dw.com/en/learn-german/s-9528

Research note:

- The exact DW page above could not be fetched through the browsing tool because it is blocked by `robots.txt`.
- Official DW app/store metadata confirms that DW Learn German includes placement support, CEFR-level courses, interactive exercises, vocabulary training, word explanations, grammar, and regional studies.
- Official DW course material describes German learning across CEFR levels A1-C2 and highlights vocabulary-building resources such as DW Audiotrainer.

Implementation constraint:

- Do not bulk-copy DW lesson text, videos, audio, or full vocab lists unless the content license and access method explicitly allow it.
- Store source attribution for imported words.
- Prefer one of these safe ingestion paths:
  - User-provided CSV/JSON exports.
  - Manually curated seed vocabulary inspired by DW lesson topics.
  - Links back to DW pages for lesson context.
  - A future importer only if permitted by DW terms and technical access rules.

Sources checked:

- https://play.google.com/store/apps/details?hl=en_GB&id=com.dw.learngerman
- https://www.dw.com/downloads/27605321/german-to-go-webversion.pdf

## 3. Product Scope

### MVP

The MVP is a browser-based vocabulary trainer with:

- A word library grouped by CEFR level, topic, lesson/source, and status.
- Multiple notebooks for organizing vocabulary by course, source, or personal study goal.
- A persistent study focus that limits review and article practice to a selected notebook.
- Flashcard review for German to English only in the MVP.
- Mandatory article practice for nouns.
- Active recall grading after each answer.
- Spaced repetition scheduling.
- Daily review queue.
- New-word introduction queue.
- Progress dashboard.
- Local persistence.
- Import/export of vocabulary as JSON or CSV.
- Import/export of notebook membership so a learner can move multiple notebooks between browsers.

### Out Of Scope For MVP

- User accounts.
- Server-side sync.
- Scraping DW content automatically.
- Audio recording and speech scoring.
- Full grammar lessons.
- AI-generated tutoring.
- Native mobile app.

## 4. Learner Experience

The first screen should be the study app itself, not a marketing page.

Primary workflow:

1. Open the app.
2. See today's review count, new-word allowance, and current streak.
3. Start a review session.
4. See a German prompt, type or reveal the English answer, then grade recall.
5. Finish with a summary and next due time.

Secondary workflow:

1. Browse words by level or topic.
2. Add or import words.
3. Edit meanings, example sentences, articles, plurals, and tags.
4. Reset or suspend difficult cards.

The app should feel focused and study-oriented: dense enough for repeated daily use, but calm and readable.

## 5. Vocabulary Model

Each vocabulary entry represents one lexical item. A single entry can produce multiple study cards.

```ts
type VocabEntry = {
  id: string;
  german: string;
  english: string;
  partOfSpeech?: "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other";
  article?: "der" | "die" | "das"; // required when partOfSpeech is noun
  plural?: string;
  exampleGerman?: string;
  exampleEnglish?: string;
  level?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  topic?: string;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

Study cards are generated from vocabulary entries.

```ts
type Card = {
  id: string;
  vocabEntryId: string;
  direction: "de_to_en" | "article" | "article_case" | "example_cloze";
  articleCase?: "nominative" | "accusative" | "dative" | "genitive";
  state: "new" | "learning" | "review" | "relearning" | "suspended";
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewedAt?: string;
};
```

Review events are stored separately for analytics and debugging.

Notebook membership is stored separately from vocabulary entries so the same word can appear in multiple notebooks without duplicating its cards or review history.

```ts
type Notebook = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sourceName?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type NotebookEntry = {
  id: string;
  notebookId: string;
  vocabEntryId: string;
  addedAt: string;
};
```

```ts
type ReviewLog = {
  id: string;
  cardId: string;
  reviewedAt: string;
  rating: "again" | "hard" | "good" | "easy";
  previousDueAt: string;
  nextDueAt: string;
  responseMs?: number;
};
```

## 6. Memorization Algorithm

Use an FSRS-style spaced repetition scheduler for review cards.

Why FSRS-style:

- It models memory with difficulty and stability instead of using only fixed intervals.
- It adapts review timing based on each card's recall history.
- It handles easy words and hard words differently.
- It is more suitable than a simple Leitner box once the word library grows.

Initial implementation:

- Start each new card with default difficulty and stability.
- Let the learner grade recall as `again`, `hard`, `good`, or `easy`.
- Calculate retrievability from elapsed time and stability.
- Update difficulty and stability after each review.
- Schedule the next review interval from the target retention.

Default target retention:

- `0.9` for early MVP.

Learning steps:

- New card failed with `again`: repeat in the same session or after 5 minutes.
- New card passed with `good`: schedule for 1 day.
- New card passed with `easy`: schedule for 3 days.

Review grading:

- `again`: forgot or could not recognize the word.
- `hard`: remembered with major effort or after a hint.
- `good`: remembered correctly.
- `easy`: immediate confident recall.

The scheduler should be isolated in a pure module with tests so it can be replaced or tuned without changing the UI.

## 7. UI Structure

Recommended routes:

- `/` - study dashboard.
- `/review` - active review session.
- `/articles` - article practice session.
- `/dw` - DW source browser and source-prefilled word add panel.
- `/words` - vocabulary library.
- `/words/new` - add word form.
- `/notebooks` - create, edit, delete, and select vocabulary notebooks.
- `/import` - CSV/JSON import.
- `/settings` - review settings and data export.

Key components:

- `DailyQueueSummary`
- `ReviewCard`
- `RecallGradeBar`
- `ArticlePractice`
- `DWSourceBrowser`
- `SessionSummary`
- `WordTable`
- `WordEditor`
- `ImportPreview`
- `ProgressStats`

Design direction:

- Quiet study dashboard.
- Clear typographic hierarchy.
- German words visually prominent.
- Compact tables for word management.
- Icon buttons for edit, suspend, delete, import, export, and settings.
- No decorative landing-page hero.

## 8. Persistence

MVP persistence should be local-first.

Recommended storage:

- IndexedDB for structured data.
- A small wrapper such as Dexie if using a frontend stack that supports it cleanly.

Data should survive reloads and offline use. Export/import is required so the learner can back up progress.

MVP decision:

- Remain fully local for now.
- Do not add accounts or cloud sync.

## 9. Import Format

CSV columns:

```csv
notebook,german,english,partOfSpeech,article,plural,exampleGerman,exampleEnglish,level,topic,sourceName,sourceUrl,notes
```

Example:

```csv
Home,Haus,house,noun,das,Häuser,Das Haus ist groß.,The house is big.,A1,Home,Manual seed,,Common beginner noun
```

Import behavior:

- Validate required fields: `german`, `english`.
- Require `article` for rows where `partOfSpeech` is `noun`.
- Normalize whitespace.
- Detect duplicates by lowercase German plus English pair.
- Link duplicate rows into the target notebook instead of creating duplicate vocabulary entries.
- Use the `notebook` column to create/import multiple notebooks in one file.
- Show a preview before committing.
- Preserve `sourceUrl` for attribution.

## 10. Suggested Tech Stack

Because the repo is empty, use a simple modern frontend stack:

- Vite.
- React.
- TypeScript.
- Dexie for IndexedDB.
- Vitest for scheduler and import tests.
- Playwright for core browser flow later.
- CSS modules or plain CSS variables for styling.

This keeps the MVP easy to run, test, and extend without introducing a backend too early.

## 11. Project Layout

```txt
/
  DEV_DOC.md
  CONTEXT.md
  package.json
  index.html
  src/
    app/
      App.tsx
      WordForm.tsx
      route-types.ts
      shared.tsx
      workspaces.ts
      routes/
        Dashboard.tsx
        ReviewSession.tsx
        WordsPage.tsx
        NewWordPage.tsx
        NotebooksPage.tsx
        DWSourceBrowser.tsx
        ImportPage.tsx
        SettingsPage.tsx
    data/
      db.ts
      indexeddb-adapter.ts
      seed-vocab.ts
      importers.ts
    dw/
      source-acquisition.ts
      source-catalog.ts
    scheduler/
      fsrs.ts
      fsrs.test.ts
    study/
      local-study.ts
      notebook-focus.ts
      practice-policy.ts
      session-planner.ts
      study-persistence.ts
    styles/
      global.css
    types/
      vocab.ts
    vocabulary/
      authoring.ts
      notebooks.ts
      schema.ts
```

Architecture notes:

- `Practice policy` owns card generation and prompt rendering for word recall and article practice.
- `Vocabulary authoring schema` owns draft defaults, shared option lists, import headers, and validation rules.
- `Study persistence` is the seam between local study commands and concrete storage adapters.
- `DW source acquisition` owns curated DW source metadata, search/filtering, and source-to-draft mapping.
- Route workspaces are split by learner workflow so dashboard, review, words, notebooks, DW, import, and settings can evolve without one large UI module.

## 12. Seed Vocabulary Plan

Start with a tiny curated seed set of 30-50 A1 words so the app works immediately.

Seed data should:

- Be manually curated.
- Use common beginner topics: greetings, home, food, people, numbers, time, travel.
- Include article and plural for nouns when known.
- Include source attribution as `Manual seed`.
- Avoid representing copied DW lesson content unless permission is confirmed.

Later, add a DW companion import:

- `sourceName`: `DW Learn German`.
- `sourceUrl`: the relevant DW lesson or course page.
- `level`: CEFR level when available.
- `topic`: lesson topic.

## 13. Testing Plan

Unit tests:

- Scheduler updates due dates correctly for each recall rating.
- Scheduler never schedules review dates in the past.
- Import parser validates required columns.
- Import parser detects duplicates.
- Card generation creates expected card directions.

Browser tests:

- App loads with seeded words.
- A review session can be completed.
- A newly reviewed card leaves the due queue.
- Imported words appear in the word library.
- Export includes vocab, cards, and review logs.

Manual visual checks:

- Desktop width around 1440px.
- Tablet width around 768px.
- Mobile width around 390px.
- Long German compound words do not break layout.
- Buttons and controls remain legible.

## 14. Success Criteria

The first implementation is successful when:

- The app opens locally.
- A learner can study seeded words.
- Recall ratings update the next due date.
- Progress persists after reload.
- Words can be added manually.
- Nouns cannot be added or imported without `der`, `die`, or `das`.
- Article practice drills base articles plus nominative, accusative, dative, and genitive definite article forms.
- Vocabulary can be imported and exported.
- Scheduler and import logic have automated tests.

## 15. Build Phases

### Phase 1: Vocabulary MVP

- Scaffold Vite React TypeScript app.
- Add local database.
- Add seed words.
- Implement scheduler.
- Implement dashboard, review session, and word list.
- Add import/export.
- Add tests.

### Phase 2: DW Companion Layer

- Add source-aware lesson/topic grouping.
- Add links back to DW lesson pages.
- Add manual add workflow for DW-derived vocabulary.
- Add source filter and source progress.

### Phase 3: Rich Study Modes

- Cloze sentences.
- Typing mode.
- Listening mode when audio assets are legally available.
- Mistake-focused mini sessions.

### Phase 4: Personalization

- Adjustable daily new-word limit.
- Adjustable target retention.
- Difficult-word review deck.
- Study streaks and weekly retention charts.

## 16. Product Decisions

- Interface language is English.
- The MVP studies German-to-English only.
- Nouns always require article recall.
- Article practice includes article case forms.
- The site remains fully local for now.
- DW imports should accept standard CSV or JSON; no special DW source format is required yet.

## 17. Cloudflare Pages Deployment

The app is a static Vite site. Local deployment uses Cloudflare Pages Direct Upload through Wrangler.

Deploy command:

```bash
npm run deploy:cloudflare
```

Override project and branch:

```bash
npm run deploy:cloudflare -- german-study-website main
```

Configuration options:

- `CLOUDFLARE_PROJECT_NAME`: Cloudflare Pages project name. Defaults to `package.json` name.
- `CLOUDFLARE_BRANCH`: deployment branch. Defaults to the current git branch, then `main`.
- `CLOUDFLARE_OUTPUT_DIR`: build output directory. Defaults to `dist`.
- `CLOUDFLARE_API_TOKEN`: optional token for non-interactive deploys.

First-time setup:

```bash
npx wrangler login
```

The deploy script runs `npm run build` first, verifies Cloudflare authentication, then deploys `dist` to the selected Pages project.
