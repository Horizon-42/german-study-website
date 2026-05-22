import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileUp,
  Globe2,
  Home,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import {
  addVocabEntries,
  addVocabEntry,
  deleteVocabEntry,
  exportStudyData,
  getStudyState,
  initializeStore,
  reviewCard,
  saveSettings,
  updateCardState,
  updateVocabEntry,
} from "../data/db";
import {
  allDwSources,
  dwSourceTopics,
  filterDwSources,
  findDwSource,
  initialDwSource,
  sourceToVocabularyDraft,
  type DWSource,
  type DWSourceKind,
} from "../dw/source-catalog";
import {
  GermanKeyboardGuideToggle,
  GermanKeyboardHelper,
} from "../german/GermanKeyboardHelper";
import {
  detectGermanKeyboardLayout,
  insertTextAtSelection,
  readGermanKeyboardHelperVisibility,
  writeGermanKeyboardHelperVisibility,
  type GermanKeyboardLayoutLabel,
} from "../german/text-entry";
import { parseVocabularyInput, serializeEntriesCsv } from "../data/importers";
import {
  buildPrompt,
  buildStats,
  buildStudyQueue,
  directionLabel,
  displayGerman,
  formatDue,
  isDue,
  topicCounts,
  type ReviewMode,
} from "../study/session-planner";
import {
  normalizeVocabularyDraft,
  validateVocabularyDraft,
} from "../vocabulary/authoring";
import type {
  CardState,
  Level,
  PartOfSpeech,
  Rating,
  Settings,
  StudyState,
  VocabDraft,
  VocabEntry,
} from "../types/vocab";

type Route = "/" | "/review" | "/articles" | "/dw" | "/words" | "/words/new" | "/import" | "/settings";

const partOfSpeechOptions: PartOfSpeech[] = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "other",
];
const levelOptions: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const ratingLabels: Record<Rating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const emptyDraft: VocabDraft = {
  german: "",
  english: "",
  partOfSpeech: "noun",
  article: undefined,
  plural: "",
  exampleGerman: "",
  exampleEnglish: "",
  level: "A1",
  topic: "",
  sourceName: "Manual",
  sourceUrl: "",
  notes: "",
};

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [state, setState] = useState<StudyState>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void initializeStore()
      .then(setState)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function refresh() {
    setState(await getStudyState());
  }

  function navigate(nextRoute: Route) {
    window.history.pushState({}, "", nextRoute);
    setRoute(nextRoute);
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !state) {
    return <ErrorScreen message={error ?? "The study data could not be loaded."} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand-lockup">
          <span className="brand-mark">DE</span>
          <div>
            <strong>German Study</strong>
            <span>A1 vocabulary trainer</span>
          </div>
        </div>
        <nav className="nav-stack">
          <NavButton active={route === "/"} icon={<Home size={18} />} label="Dashboard" onClick={() => navigate("/")} />
          <NavButton
            active={route === "/review"}
            icon={<Play size={18} />}
            label="Review"
            onClick={() => navigate("/review")}
          />
          <NavButton
            active={route === "/articles"}
            icon={<CalendarDays size={18} />}
            label="Articles"
            onClick={() => navigate("/articles")}
          />
          <NavButton
            active={route === "/words" || route === "/words/new"}
            icon={<BookOpen size={18} />}
            label="Words"
            onClick={() => navigate("/words")}
          />
          <NavButton
            active={route === "/dw"}
            icon={<Globe2 size={18} />}
            label="DW"
            onClick={() => navigate("/dw")}
          />
          <NavButton
            active={route === "/import"}
            icon={<FileUp size={18} />}
            label="Import"
            onClick={() => navigate("/import")}
          />
          <NavButton
            active={route === "/settings"}
            icon={<SettingsIcon size={18} />}
            label="Settings"
            onClick={() => navigate("/settings")}
          />
        </nav>
      </aside>

      <main className="main-content">
        {route === "/" && <Dashboard state={state} navigate={navigate} />}
        {route === "/review" && <ReviewSession mode="words" state={state} refresh={refresh} navigate={navigate} />}
        {route === "/articles" && <ReviewSession mode="articles" state={state} refresh={refresh} navigate={navigate} />}
        {route === "/dw" && <DWSourceBrowser refresh={refresh} />}
        {route === "/words" && <WordsPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/words/new" && <NewWordPage refresh={refresh} navigate={navigate} />}
        {route === "/import" && <ImportPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/settings" && <SettingsPage state={state} refresh={refresh} />}
      </main>
    </div>
  );
}

function Dashboard({ state, navigate }: { state: StudyState; navigate: (route: Route) => void }) {
  const stats = useMemo(() => buildStats(state), [state]);
  const queue = useMemo(() => buildStudyQueue(state.cards, state.settings, "words"), [state.cards, state.settings]);
  const articleQueue = useMemo(() => buildStudyQueue(state.cards, state.settings, "articles"), [state.cards, state.settings]);
  const topics = useMemo(() => topicCounts(state.entries), [state.entries]);

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Today</p>
          <h1>Words ready for recall</h1>
        </div>
        <button className="primary-action" disabled={queue.length === 0} onClick={() => navigate("/review")}>
          <Play size={18} />
          Start review
        </button>
      </header>

      <div className="metric-grid">
        <Metric label="Due cards" value={stats.dueCards} tone="ink" />
        <Metric label="Article cards" value={articleQueue.length} tone="green" />
        <Metric label="Studied today" value={stats.studiedToday} tone="blue" />
        <Metric label="Streak" value={`${stats.streak}d`} tone="amber" />
      </div>

      <div className="dashboard-layout">
        <section className="panel study-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Next session</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          {queue.length === 0 ? (
            <EmptyState title="All clear" body="Add new words or come back when more cards are due." />
          ) : (
            <div className="queue-list">
              {queue.slice(0, 8).map((card) => {
                const entry = state.entries.find((item) => item.id === card.vocabEntryId);
                return entry ? (
                  <div className="queue-row" key={card.id}>
                    <span className={`state-dot state-${card.state}`} />
                    <div>
                      <strong>{displayGerman(entry)}</strong>
                      <span>{directionLabel(card.direction)} · {entry.topic ?? "General"}</span>
                    </div>
                    <time>{formatDue(card.dueAt)}</time>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Topics</h2>
            </div>
            <button className="icon-button" aria-label="Add word" title="Add word" onClick={() => navigate("/words/new")}>
              <Plus size={18} />
            </button>
          </div>
          <div className="topic-list">
            {topics.map((topic) => (
              <div className="topic-row" key={topic.name}>
                <span>{topic.name}</span>
                <strong>{topic.count}</strong>
              </div>
            ))}
          </div>
          <button className="secondary-action wide-action article-shortcut" disabled={articleQueue.length === 0} onClick={() => navigate("/articles")}>
            <CalendarDays size={18} />
            Practice articles
          </button>
        </section>
      </div>
    </section>
  );
}

function ReviewSession({
  mode,
  state,
  refresh,
  navigate,
}: {
  mode: ReviewMode;
  state: StudyState;
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const [queueIds, setQueueIds] = useState(() => buildStudyQueue(state.cards, state.settings, mode).map((card) => card.id));
  const [revealed, setRevealed] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [sessionRatings, setSessionRatings] = useState<Rating[]>([]);
  const [startedAt, setStartedAt] = useState(Date.now());
  const currentCard = state.cards.find((card) => card.id === queueIds[0]);
  const currentEntry = currentCard ? state.entries.find((entry) => entry.id === currentCard.vocabEntryId) : undefined;
  const prompt = currentCard && currentEntry ? buildPrompt(currentCard, currentEntry) : undefined;

  async function grade(rating: Rating) {
    if (!currentCard) {
      return;
    }

    await reviewCard(currentCard.id, rating, Date.now() - startedAt);
    setSessionRatings((ratings) => [...ratings, rating]);
    setQueueIds((ids) => ids.slice(1));
    setRevealed(false);
    setTypedAnswer("");
    setStartedAt(Date.now());
    await refresh();
  }

  if (!currentCard || !currentEntry || !prompt) {
    return (
      <section className="view-grid">
        <header className="view-header">
          <div>
            <p className="eyebrow">Session complete</p>
            <h1>{sessionRatings.length} cards reviewed</h1>
          </div>
          <button className="primary-action" onClick={() => navigate("/")}>
            <CheckCircle2 size={18} />
            Done
          </button>
        </header>
        <div className="metric-grid">
          {(["again", "hard", "good", "easy"] as Rating[]).map((rating) => (
            <Metric
              key={rating}
              label={ratingLabels[rating]}
              value={sessionRatings.filter((item) => item === rating).length}
              tone={rating === "again" ? "red" : rating === "easy" ? "green" : "ink"}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="review-layout">
      <header className="view-header">
        <div>
          <p className="eyebrow">{mode === "articles" ? "Article practice" : "Review"}</p>
          <h1>{queueIds.length} cards left</h1>
        </div>
        <button className="secondary-action" onClick={() => navigate("/")}>Exit</button>
      </header>

      <article className="review-card">
        <div className="prompt-meta">
          <span>{prompt.mode}</span>
          <span>{currentEntry.level ?? "A1"} · {currentEntry.topic ?? "General"}</span>
        </div>
        <h2>{prompt.prompt}</h2>
        {prompt.context && <p className="prompt-context">{prompt.context}</p>}
        <label className="answer-field">
          <span>Your answer</span>
          <input
            value={typedAnswer}
            onChange={(event) => setTypedAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setRevealed(true);
              }
            }}
            autoFocus
          />
        </label>
        {revealed ? (
          <div className="answer-reveal">
            <span>Answer</span>
            <strong>{prompt.answer}</strong>
            {prompt.detail && <p>{prompt.detail}</p>}
          </div>
        ) : (
          <button className="primary-action wide-action" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        )}
        <div className="grade-bar" aria-label="Grade recall">
          {(["again", "hard", "good", "easy"] as Rating[]).map((rating) => (
            <button key={rating} className={`grade-button grade-${rating}`} disabled={!revealed} onClick={() => void grade(rating)}>
              {ratingLabels[rating]}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function WordsPage({
  state,
  refresh,
  navigate,
}: {
  state: StudyState;
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "all">("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState<CardState | "due" | "all">("all");
  const [editingEntry, setEditingEntry] = useState<VocabEntry>();
  const topics = Array.from(new Set(state.entries.map((entry) => entry.topic).filter(Boolean) as string[])).sort();
  const filteredEntries = state.entries.filter((entry) => {
    const cards = state.cards.filter((card) => card.vocabEntryId === entry.id);
    const matchesQuery = `${entry.german} ${entry.english} ${entry.topic ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesLevel = level === "all" || entry.level === level;
    const matchesTopic = topic === "all" || entry.topic === topic;
    const matchesStatus =
      status === "all" ||
      (status === "due" && cards.some((card) => isDue(card))) ||
      cards.some((card) => card.state === status);

    return matchesQuery && matchesLevel && matchesTopic && matchesStatus;
  });

  async function toggleSuspend(entry: VocabEntry) {
    const cards = state.cards.filter((card) => card.vocabEntryId === entry.id);
    const allSuspended = cards.every((card) => card.state === "suspended");
    await Promise.all(
      cards.map((card) => updateCardState(card.id, allSuspended ? (card.reps === 0 ? "new" : "review") : "suspended")),
    );
    await refresh();
  }

  async function removeEntry(entry: VocabEntry) {
    const confirmed = window.confirm(`Delete "${entry.german}" and its cards?`);
    if (!confirmed) {
      return;
    }

    await deleteVocabEntry(entry.id);
    await refresh();
  }

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>{state.entries.length} words</h1>
        </div>
        <button className="primary-action" onClick={() => navigate("/words/new")}>
          <Plus size={18} />
          Add word
        </button>
      </header>

      <section className="panel">
        <div className="filter-grid">
          <label className="search-box">
            <Search size={18} />
            <input placeholder="Search words" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={level} onChange={(event) => setLevel(event.target.value as Level | "all")}>
            <option value="all">All levels</option>
            {levelOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="all">All topics</option>
            {topics.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as CardState | "due" | "all")}>
            <option value="all">All cards</option>
            <option value="due">Due now</option>
            <option value="new">New</option>
            <option value="review">Review</option>
            <option value="learning">Learning</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="word-table-wrap">
          <table className="word-table">
            <thead>
              <tr>
                <th>German</th>
                <th>English</th>
                <th>Level</th>
                <th>Topic</th>
                <th>Cards</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const cards = state.cards.filter((card) => card.vocabEntryId === entry.id);
                const suspended = cards.length > 0 && cards.every((card) => card.state === "suspended");
                return (
                  <tr key={entry.id}>
                    <td>
                      <strong>{displayGerman(entry)}</strong>
                      <span>{entry.partOfSpeech ?? "word"}{entry.article ? ` · ${entry.article}` : ""}{entry.plural ? ` · ${entry.plural}` : ""}</span>
                    </td>
                    <td>{entry.english}</td>
                    <td>{entry.level ?? "A1"}</td>
                    <td>{entry.topic ?? "General"}</td>
                    <td>{cards.filter((card) => card.state !== "suspended").length}/{cards.length}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button" aria-label="Edit word" title="Edit word" onClick={() => setEditingEntry(entry)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-button" aria-label={suspended ? "Resume cards" : "Suspend cards"} title={suspended ? "Resume cards" : "Suspend cards"} onClick={() => void toggleSuspend(entry)}>
                          {suspended ? <RotateCcw size={16} /> : <Pause size={16} />}
                        </button>
                        <button className="icon-button danger" aria-label="Delete word" title="Delete word" onClick={() => void removeEntry(entry)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingEntry && (
        <section className="panel editor-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Edit</p>
              <h2>{editingEntry.german}</h2>
            </div>
            <button className="secondary-action" onClick={() => setEditingEntry(undefined)}>Close</button>
          </div>
          <WordForm
            initial={editingEntry}
            submitLabel="Save changes"
            onSubmit={async (draft) => {
              await updateVocabEntry({ ...editingEntry, ...draft });
              setEditingEntry(undefined);
              await refresh();
            }}
          />
        </section>
      )}
    </section>
  );
}

function DWSourceBrowser({ refresh }: { refresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DWSourceKind | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [selectedSource, setSelectedSource] = useState<DWSource>(() => initialDwSource());
  const [saved, setSaved] = useState("");
  const sourceTopics = useMemo(() => dwSourceTopics(), []);
  const filteredSources = filterDwSources({ query, kind, level });
  const sourceDraft = useMemo(() => sourceToVocabularyDraft(selectedSource), [selectedSource]);

  function chooseSource(source: DWSource, scrollToViewer = true) {
    setSelectedSource(source);
    setSaved("");
    if (scrollToViewer) {
      window.requestAnimationFrame(() => {
        document.getElementById("dw-viewer")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">DW workspace</p>
          <h1>Study the lesson, save the words</h1>
        </div>
        <div className="view-actions">
          <a className="secondary-action" href={selectedSource.url} target="_blank" rel="noreferrer">
            <ExternalLink size={18} />
            Original
          </a>
          <a className="primary-action" href="#dw-add-word">
            <Plus size={18} />
            Add word
          </a>
        </div>
      </header>

      <section className="panel dw-source-bar">
        <div className="selected-source-summary">
          <span className="source-kind">{selectedSource.kind}{selectedSource.level ? ` · ${selectedSource.level}` : ""}</span>
          <strong>{selectedSource.title}</strong>
          <span>{selectedSource.topic}</span>
        </div>
        <label className="source-select-field">
          <span>Current DW source</span>
          <select value={selectedSource.id} onChange={(event) => {
            const nextSource = findDwSource(event.target.value);
            if (nextSource) {
              chooseSource(nextSource, false);
            }
          }}>
            {allDwSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.level ? `${source.level} · ` : ""}{source.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel dw-viewer-panel" id="dw-viewer">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Learning page</p>
            <h2>{selectedSource.title}</h2>
          </div>
          <span className="source-selected-pill">{selectedSource.kind}{selectedSource.level ? ` · ${selectedSource.level}` : ""}</span>
        </div>
        <iframe
          key={selectedSource.id}
          className="dw-learning-frame"
          src={selectedSource.url}
          title={`DW source: ${selectedSource.title}`}
        />
      </section>

      <section className="panel editor-panel source-add-panel" id="dw-add-word">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Add word from DW</p>
            <h2>{selectedSource.title}</h2>
          </div>
          <span className="source-selected-pill">{selectedSource.kind}{selectedSource.level ? ` · ${selectedSource.level}` : ""}</span>
        </div>
        <WordForm
          key={`${selectedSource.id}-${saved}`}
          initial={sourceDraft}
          submitLabel="Add DW word"
          resetOnSubmit
          onSubmit={async (draft) => {
            await addVocabEntry(draft);
            await refresh();
            setSaved(`${draft.german} saved from ${selectedSource.title}.`);
          }}
        />
        {saved && (
          <div className="inline-success">
            <CheckCircle2 size={18} />
            {saved}
          </div>
        )}
      </section>

      <details className="panel source-library-panel">
        <summary>
          <span>
            <strong>DW source library</strong>
            <small>{filteredSources.length} matching sources</small>
          </span>
        </summary>
        <div className="source-browser-panel">
          <div className="filter-grid source-filter-grid">
            <label className="search-box">
              <Search size={18} />
              <input placeholder="Search DW titles or topics" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select value={kind} onChange={(event) => setKind(event.target.value as DWSourceKind | "all")}>
              <option value="all">All types</option>
              <option value="course">Courses</option>
              <option value="lesson">Lessons</option>
              <option value="article">Articles</option>
            </select>
            <select value={level} onChange={(event) => setLevel(event.target.value as Level | "all")}>
              <option value="all">All levels</option>
              {levelOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>

          <div className="source-topic-strip">
            {sourceTopics.map((topic) => (
              <button key={topic} className="source-chip" onClick={() => setQuery(topic)}>
                {topic}
              </button>
            ))}
          </div>

          <div className="source-grid">
            {filteredSources.map((source) => (
              <article className={`source-card ${selectedSource.id === source.id ? "selected" : ""}`} key={source.id}>
                <div>
                  <span className="source-kind">{source.kind}{source.level ? ` · ${source.level}` : ""}</span>
                  <h2>{source.title}</h2>
                  <p>{source.topic}</p>
                </div>
                <div className="source-card-actions">
                  <button className="secondary-action" onClick={() => chooseSource(source)}>
                    Study here
                  </button>
                  <a className="icon-button" href={source.url} target="_blank" rel="noreferrer" aria-label={`Open original ${source.title}`} title={`Open original ${source.title}`}>
                    <ExternalLink size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function NewWordPage({
  refresh,
  navigate,
}: {
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">New word</p>
          <h1>Add vocabulary</h1>
        </div>
      </header>
      <section className="panel editor-panel">
        <WordForm
          initial={emptyDraft}
          submitLabel="Add word"
          onSubmit={async (draft) => {
            await addVocabEntry(draft);
            await refresh();
            setSaved(true);
          }}
        />
        {saved && (
          <div className="inline-success">
            <CheckCircle2 size={18} />
            Saved. New review cards are ready.
            <button className="link-button" onClick={() => navigate("/words")}>View library</button>
          </div>
        )}
      </section>
    </section>
  );
}

function ImportPage({
  state,
  refresh,
  navigate,
}: {
  state: StudyState;
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const preview = useMemo(() => parseVocabularyInput(text, state.entries), [text, state.entries]);
  const importableRows = preview.rows.filter((row) => !row.duplicate);

  async function commitImport() {
    await addVocabEntries(importableRows.map((row) => row.draft));
    await refresh();
    setMessage(`${importableRows.length} words imported.`);
    setText("");
  }

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Import</p>
          <h1>CSV or JSON vocabulary</h1>
        </div>
        <button className="primary-action" disabled={importableRows.length === 0 || preview.errors.length > 0} onClick={() => void commitImport()}>
          <FileUp size={18} />
          Import {importableRows.length || ""}
        </button>
      </header>

      <section className="panel import-grid">
        <label className="text-area-field">
          <span>Paste data</span>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setMessage("");
            }}
            placeholder="german,english,partOfSpeech,article,level,topic&#10;Frage,question,noun,die,A1,Basics"
          />
        </label>
        <div className="import-preview">
          <h2>Preview</h2>
          {message && <p className="success-text">{message}</p>}
          {preview.errors.map((error) => (
            <p className="error-text" key={`${error.rowNumber}-${error.message}`}>
              Row {error.rowNumber}: {error.message}
            </p>
          ))}
          {preview.rows.length > 0 && (
            <div className="preview-list">
              {preview.rows.slice(0, 12).map((row) => (
                <div className={`preview-row ${row.duplicate ? "muted-row" : ""}`} key={row.rowNumber}>
                  <div>
                    <strong>{row.draft.german}</strong>
                    <span>{row.draft.english}</span>
                  </div>
                  <small>{row.duplicate ? "duplicate" : row.draft.level ?? "A1"}</small>
                </div>
              ))}
            </div>
          )}
          <button className="secondary-action" onClick={() => navigate("/settings")}>
            Export tools
          </button>
        </div>
      </section>
    </section>
  );
}

function SettingsPage({ state, refresh }: { state: StudyState; refresh: () => Promise<void> }) {
  const [settings, setSettings] = useState<Settings>(state.settings);
  const [saved, setSaved] = useState(false);

  async function persistSettings() {
    await saveSettings(settings);
    await refresh();
    setSaved(true);
  }

  async function exportJson() {
    const payload = await exportStudyData();
    downloadFile("german-study-export.json", JSON.stringify(payload, null, 2), "application/json");
  }

  function exportCsv() {
    downloadFile("german-vocabulary.csv", serializeEntriesCsv(state.entries), "text/csv");
  }

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Review controls</h1>
        </div>
      </header>

      <section className="panel settings-grid">
        <label className="range-field">
          <span>New cards per day</span>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.dailyNewLimit}
            onChange={(event) => setSettings({ ...settings, dailyNewLimit: Number(event.target.value) })}
          />
        </label>
        <label className="range-field">
          <span>Target retention</span>
          <input
            type="number"
            min={0.7}
            max={0.98}
            step={0.01}
            value={settings.targetRetention}
            onChange={(event) => setSettings({ ...settings, targetRetention: Number(event.target.value) })}
          />
        </label>
        <div className="settings-actions">
          <button className="primary-action" onClick={() => void persistSettings()}>
            <CheckCircle2 size={18} />
            Save
          </button>
          <button className="secondary-action" onClick={() => void exportJson()}>
            <Download size={18} />
            JSON
          </button>
          <button className="secondary-action" onClick={exportCsv}>
            <Download size={18} />
            CSV
          </button>
        </div>
        {saved && <p className="success-text">Settings saved.</p>}
      </section>
    </section>
  );
}

function WordForm({
  initial,
  submitLabel,
  resetOnSubmit = false,
  onSubmit,
}: {
  initial: VocabDraft | VocabEntry;
  submitLabel: string;
  resetOnSubmit?: boolean;
  onSubmit: (draft: VocabDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<VocabDraft>(() => draftFromInitial(initial));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [activeGermanField, setActiveGermanField] = useState<"german" | "exampleGerman">("german");
  const [showKeyboardHelper, setShowKeyboardHelper] = useState(readGermanKeyboardHelperVisibility);
  const [keyboardLayout, setKeyboardLayout] = useState<GermanKeyboardLayoutLabel>("Layout guide");
  const germanInputRef = useRef<HTMLInputElement>(null);
  const germanExampleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(draftFromInitial(initial));
    setFormError("");
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    void detectGermanKeyboardLayout().then((layout) => {
      if (!cancelled) {
        setKeyboardLayout(layout);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedDraft = normalizeVocabularyDraft(draft);
    const [validationError] = validateVocabularyDraft(normalizedDraft);

    if (validationError) {
      setFormError(validationError.message);
      return;
    }

    setFormError("");
    setSaving(true);
    await onSubmit(normalizedDraft);
    if (resetOnSubmit) {
      setDraft(draftFromInitial(initial));
    }
    setSaving(false);
  }

  function insertGermanCharacter(field: "german" | "exampleGerman", character: string) {
    const input = field === "german" ? germanInputRef.current : germanExampleInputRef.current;
    const currentValue = draft[field] ?? "";
    const insertion = insertTextAtSelection(currentValue, character, {
      start: input?.selectionStart,
      end: input?.selectionEnd,
    });

    setDraft({ ...draft, [field]: insertion.value });
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(insertion.cursor, insertion.cursor);
    });
  }

  function updateKeyboardHelperVisibility(visible: boolean) {
    setShowKeyboardHelper(visible);
    writeGermanKeyboardHelperVisibility(visible);
  }

  return (
    <form className="word-form" onSubmit={(event) => void submit(event)}>
      <div className="german-input-group wide-field">
        <label>
          <span>German</span>
          <input
            ref={germanInputRef}
            required
            value={draft.german}
            onChange={(event) => setDraft({ ...draft, german: event.target.value })}
            onFocus={() => setActiveGermanField("german")}
          />
        </label>
        {showKeyboardHelper && activeGermanField === "german" && (
          <GermanKeyboardHelper
            layoutLabel={keyboardLayout}
            onClose={() => updateKeyboardHelperVisibility(false)}
            onInsert={(character) => insertGermanCharacter("german", character)}
          />
        )}
        {!showKeyboardHelper && (
          <GermanKeyboardGuideToggle onClick={() => updateKeyboardHelperVisibility(true)} />
        )}
      </div>
      <label>
        <span>English</span>
        <input required value={draft.english} onChange={(event) => setDraft({ ...draft, english: event.target.value })} />
      </label>
      <label>
        <span>Part of speech</span>
        <select value={draft.partOfSpeech} onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value as PartOfSpeech })}>
          {partOfSpeechOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Article</span>
        <select required={draft.partOfSpeech === "noun"} value={draft.article ?? ""} onChange={(event) => setDraft({ ...draft, article: event.target.value ? event.target.value as VocabDraft["article"] : undefined })}>
          <option value="">None</option>
          <option value="der">der</option>
          <option value="die">die</option>
          <option value="das">das</option>
        </select>
      </label>
      <label>
        <span>Plural</span>
        <input value={draft.plural ?? ""} onChange={(event) => setDraft({ ...draft, plural: event.target.value })} />
      </label>
      <label>
        <span>Level</span>
        <select value={draft.level ?? "A1"} onChange={(event) => setDraft({ ...draft, level: event.target.value as Level })}>
          {levelOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Topic</span>
        <input value={draft.topic ?? ""} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} />
      </label>
      <label>
        <span>Source</span>
        <input value={draft.sourceName ?? ""} onChange={(event) => setDraft({ ...draft, sourceName: event.target.value })} />
      </label>
      <label className="wide-field">
        <span>Source URL</span>
        <input type="url" value={draft.sourceUrl ?? ""} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} />
      </label>
      <label className="wide-field">
        <span>German example</span>
        <input
          ref={germanExampleInputRef}
          value={draft.exampleGerman ?? ""}
          onChange={(event) => setDraft({ ...draft, exampleGerman: event.target.value })}
          onFocus={() => setActiveGermanField("exampleGerman")}
        />
      </label>
      {showKeyboardHelper && activeGermanField === "exampleGerman" && (
        <GermanKeyboardHelper
          className="wide-field"
          layoutLabel={keyboardLayout}
          onClose={() => updateKeyboardHelperVisibility(false)}
          onInsert={(character) => insertGermanCharacter("exampleGerman", character)}
        />
      )}
      <label className="wide-field">
        <span>English example</span>
        <input value={draft.exampleEnglish ?? ""} onChange={(event) => setDraft({ ...draft, exampleEnglish: event.target.value })} />
      </label>
      <label className="wide-field">
        <span>Notes</span>
        <textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </label>
      {formError && <p className="error-text wide-field">{formError}</p>}
      <button className="primary-action form-submit" disabled={saving}>
        <Plus size={18} />
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="center-screen">
      <div className="loading-mark" />
      <p>Loading German Study...</p>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="center-screen">
      <h1>Could not load the app</h1>
      <p>{message}</p>
    </main>
  );
}

function draftFromInitial(initial: VocabDraft | VocabEntry): VocabDraft {
  return {
    german: initial.german ?? "",
    english: initial.english ?? "",
    partOfSpeech: initial.partOfSpeech ?? "noun",
    article: initial.article,
    plural: initial.plural ?? "",
    exampleGerman: initial.exampleGerman ?? "",
    exampleEnglish: initial.exampleEnglish ?? "",
    level: initial.level ?? "A1",
    topic: initial.topic ?? "",
    sourceName: initial.sourceName ?? "Manual",
    sourceUrl: initial.sourceUrl ?? "",
    notes: initial.notes ?? "",
  };
}

function readRoute(): Route {
  const path = window.location.pathname;
  return ["/", "/review", "/articles", "/dw", "/words", "/words/new", "/import", "/settings"].includes(path)
    ? (path as Route)
    : "/";
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
