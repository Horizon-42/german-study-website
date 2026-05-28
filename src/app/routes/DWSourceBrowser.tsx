import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  LogIn,
  PenLine,
  Plus,
  Search,
} from "lucide-react";
import { addVocabEntry, createNotebook, setFocusNotebook, updateVocabEntry } from "../../data/db";
import {
  copyworkPhraseFromRange,
  copyworkTermKey,
  tokenizeCopyworkSentence,
  type CopyworkToken,
} from "../../dw/copywork";
import {
  allDwSources,
  dwSourceTopics,
  filterDwSources,
  findDwSource,
  initialDwSource,
  sourceToNotebookDraft,
  sourceToVocabularyDraft,
  type DWSource,
  type DWSourceKind,
} from "../../dw/source-catalog";
import { dwProxyUrl } from "../../dw/proxy-url";
import {
  GermanKeyboardGuideToggle,
  GermanKeyboardHelper,
} from "../../german/GermanKeyboardHelper";
import {
  detectGermanKeyboardLayout,
  insertTextAtSelection,
  readGermanKeyboardHelperVisibility,
  writeGermanKeyboardHelperVisibility,
  type GermanKeyboardLayoutLabel,
} from "../../german/text-entry";
import type { Article, Level, PartOfSpeech, StudyState, VocabDraft, VocabEntry } from "../../types/vocab";
import { levelOptions, partOfSpeechOptions } from "../../vocabulary/schema";
import { notebookFocusName } from "../shared";
import { WordForm } from "../WordForm";

type CaptureMode = "quick" | "copywork";
type CopyworkPickMode = "word" | "phrase";
type CopyworkStage = "select" | "review";

type CopyworkReviewRow = {
  entry: VocabEntry;
  german: string;
  english: string;
  partOfSpeech: PartOfSpeech;
  article?: Article;
  plural: string;
  tokenIndexes: number[];
};

const copyworkPendingTranslation = "Pending translation";
const articles: Article[] = ["der", "die", "das"];

export function DWSourceBrowser({ state, refresh }: { state: StudyState; refresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DWSourceKind | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [selectedSource, setSelectedSource] = useState<DWSource>(() => initialDwSource());
  const [saved, setSaved] = useState("");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("quick");
  const sourceTopics = useMemo(() => dwSourceTopics(), []);
  const filteredSources = filterDwSources({ query, kind, level });
  const sourceDraft = useMemo(() => sourceToVocabularyDraft(selectedSource), [selectedSource]);
  const proxiedSourceUrl = useMemo(() => dwProxyUrl(selectedSource.url), [selectedSource.url]);
  const focusName = notebookFocusName(state);

  function chooseSource(source: DWSource, scrollToViewer = true) {
    setSelectedSource(source);
    setSaved("");
    setCaptureMode("quick");
    if (scrollToViewer) {
      window.requestAnimationFrame(() => {
        document.getElementById("dw-viewer")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function createNotebookFromSource() {
    const existing = state.notebooks.find((notebook) => notebook.name.toLowerCase() === selectedSource.title.toLowerCase());
    const notebook = existing ?? await createNotebook(sourceToNotebookDraft(selectedSource));
    await setFocusNotebook(notebook.id);
    await refresh();
    setSaved(`Notebook "${notebook.name}" selected as focus.`);
  }

  return (
    <section className="view-grid dw-workspace">
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
          <a className="secondary-action" href={proxiedSourceUrl} target="dw-proxy-frame">
            <LogIn size={18} />
            Proxy login
          </a>
          <a className="primary-action" href="#dw-add-word">
            <Plus size={18} />
            Add word
          </a>
          <button className="secondary-action" onClick={() => void createNotebookFromSource()}>
            <BookOpen size={18} />
            Make notebook
          </button>
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

      <section className="dw-study-layout" aria-label="DW study workspace">
        <section className="panel dw-viewer-panel" id="dw-viewer">
          <div className="panel-heading dw-viewer-heading">
            <div>
              <p className="eyebrow">Learning page</p>
              <h2>{selectedSource.title}</h2>
            </div>
            <span className="source-selected-pill">{selectedSource.kind}{selectedSource.level ? ` · ${selectedSource.level}` : ""}</span>
          </div>
          <iframe
            key={selectedSource.id}
            name="dw-proxy-frame"
            className="dw-learning-frame"
            src={proxiedSourceUrl}
            title={`DW source: ${selectedSource.title}`}
          />
        </section>

        <aside className="panel editor-panel source-add-panel" id="dw-add-word" aria-label="Add DW vocabulary">
          <div className="panel-heading source-add-heading">
            <div>
              <p className="eyebrow">Vocabulary capture</p>
              <h2>{captureMode === "quick" ? "Quick add word" : "Copywork"}</h2>
              <span>Saving to {focusName}</span>
            </div>
            <span className="source-selected-pill">{selectedSource.level ?? "DW"}</span>
          </div>
          <div className="capture-mode-tabs" role="tablist" aria-label="Vocabulary capture mode">
            <button
              className={`capture-mode-tab ${captureMode === "quick" ? "active" : ""}`}
              role="tab"
              aria-selected={captureMode === "quick"}
              onClick={() => {
                setCaptureMode("quick");
                setSaved("");
              }}
            >
              <Plus size={16} />
              Quick
            </button>
            <button
              className={`capture-mode-tab ${captureMode === "copywork" ? "active" : ""}`}
              role="tab"
              aria-selected={captureMode === "copywork"}
              onClick={() => {
                setCaptureMode("copywork");
                setSaved("");
              }}
            >
              <PenLine size={16} />
              Copywork
            </button>
          </div>
          {captureMode === "quick" ? (
            <WordForm
              key={`${selectedSource.id}-${saved}`}
              initial={sourceDraft}
              submitLabel="Add DW word"
              variant="capture"
              resetOnSubmit
              onSubmit={async (draft) => {
                await addVocabEntry(draft, state.settings.focusNotebookId);
                await refresh();
                setSaved(`${draft.german} saved from ${selectedSource.title}.`);
              }}
            />
          ) : (
            <CopyworkCapture
              sourceDraft={sourceDraft}
              sourceTitle={selectedSource.title}
              entries={state.entries}
              focusNotebookId={state.settings.focusNotebookId}
              refresh={refresh}
              onSaved={setSaved}
            />
          )}
          {saved && (
            <div className="inline-success">
              <CheckCircle2 size={18} />
              {saved}
            </div>
          )}
        </aside>
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

function CopyworkCapture({
  sourceDraft,
  sourceTitle,
  entries,
  focusNotebookId,
  refresh,
  onSaved,
}: {
  sourceDraft: VocabDraft;
  sourceTitle: string;
  entries: VocabEntry[];
  focusNotebookId?: string;
  refresh: () => Promise<void>;
  onSaved: (message: string) => void;
}) {
  const [sentence, setSentence] = useState("");
  const [pickMode, setPickMode] = useState<CopyworkPickMode>("word");
  const [stage, setStage] = useState<CopyworkStage>("select");
  const [phraseStart, setPhraseStart] = useState<number>();
  const [rows, setRows] = useState<CopyworkReviewRow[]>([]);
  const [savingTermKey, setSavingTermKey] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [error, setError] = useState("");
  const [showKeyboardHelper, setShowKeyboardHelper] = useState(readGermanKeyboardHelperVisibility);
  const [keyboardLayout, setKeyboardLayout] = useState<GermanKeyboardLayoutLabel>("Layout guide");
  const sentenceInputRef = useRef<HTMLTextAreaElement>(null);
  const tokens = useMemo(() => tokenizeCopyworkSentence(sentence), [sentence]);
  const rowKeys = useMemo(() => new Set(rows.map((row) => copyworkTermKey(row.german))), [rows]);

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

  function resetCopywork() {
    setSentence("");
    setPhraseStart(undefined);
    setRows([]);
    setStage("select");
    setError("");
    onSaved("");
  }

  function updateKeyboardHelperVisibility(visible: boolean) {
    setShowKeyboardHelper(visible);
    writeGermanKeyboardHelperVisibility(visible);
  }

  function insertGermanCharacter(character: string) {
    const input = sentenceInputRef.current;
    const insertion = insertTextAtSelection(sentence, character, {
      start: input?.selectionStart,
      end: input?.selectionEnd,
    });

    setSentence(insertion.value);
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(insertion.cursor, insertion.cursor);
    });
  }

  async function chooseToken(token: CopyworkToken) {
    if (pickMode === "word") {
      await createTermFromTokens([token]);
      return;
    }

    if (phraseStart === undefined) {
      setPhraseStart(token.index);
      setError("");
      return;
    }

    const phraseTokens = copyworkPhraseFromRange(tokens, phraseStart, token.index);
    setPhraseStart(undefined);
    await createTermFromTokens(phraseTokens);
  }

  async function createTermFromTokens(termTokens: CopyworkToken[]) {
    if (termTokens.length === 0) {
      return;
    }

    const german = termTokens.map((token) => token.text).join(" ");
    const key = copyworkTermKey(german);

    if (rowKeys.has(key) || savingTermKey === key) {
      return;
    }

    setError("");
    setSavingTermKey(key);
    try {
      const existing = findEntryByGerman(entries, german);
      const entry = existing
        ? await addVocabEntry(existing, focusNotebookId)
        : await addVocabEntry(copyworkDraft(sourceDraft, sourceTitle, sentence, german, termTokens.length), focusNotebookId);
      const row = reviewRowFromEntry(entry, termTokens);

      setRows((currentRows) => currentRows.some((item) => copyworkTermKey(item.german) === key)
        ? currentRows
        : [...currentRows, row]);
      setStage("select");
      await refresh();
      onSaved(`${german} saved for review.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this term.");
    } finally {
      setSavingTermKey("");
    }
  }

  function updateRow(entryId: string, patch: Partial<CopyworkReviewRow>) {
    setRows((currentRows) => currentRows.map((row) => (
      row.entry.id === entryId ? { ...row, ...patch } : row
    )));
  }

  async function saveReview() {
    const missingEnglish = rows.find((row) => row.english.trim() === "");
    const missingArticle = rows.find((row) => row.partOfSpeech === "noun" && !row.article);

    if (missingEnglish) {
      setError(`Add English for ${missingEnglish.german}.`);
      return;
    }

    if (missingArticle) {
      setError(`Choose an article for ${missingArticle.german}.`);
      return;
    }

    setError("");
    setSavingReview(true);
    try {
      const updatedRows: CopyworkReviewRow[] = [];

      for (const row of rows) {
        const updated = await updateVocabEntry({
          ...row.entry,
          english: row.english.trim(),
          partOfSpeech: row.partOfSpeech,
          article: row.partOfSpeech === "noun" ? row.article : undefined,
          plural: row.plural.trim() || undefined,
          exampleGerman: sentence.trim() || row.entry.exampleGerman,
          sourceName: row.entry.sourceName ?? sourceDraft.sourceName,
          sourceUrl: row.entry.sourceUrl ?? sourceDraft.sourceUrl,
          topic: row.entry.topic ?? sourceDraft.topic,
          level: row.entry.level ?? sourceDraft.level,
          notes: row.entry.notes ?? `DW copywork: ${sourceTitle}`,
        });
        updatedRows.push({
          ...row,
          entry: updated,
          english: visibleCopyworkEnglish(updated.english),
          partOfSpeech: updated.partOfSpeech ?? row.partOfSpeech,
          article: updated.article,
          plural: updated.plural ?? "",
        });
      }

      setRows(updatedRows);
      await refresh();
      onSaved(`${updatedRows.length} copywork terms updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update copywork terms.");
    } finally {
      setSavingReview(false);
    }
  }

  return (
    <div className="copywork-panel">
      {stage === "select" ? (
        <>
          <label className="copywork-field">
            <span>German sentence</span>
            <textarea
              ref={sentenceInputRef}
              value={sentence}
              onChange={(event) => {
                setSentence(event.target.value);
                setPhraseStart(undefined);
                setError("");
                onSaved("");
              }}
            />
          </label>
          {showKeyboardHelper ? (
            <GermanKeyboardHelper
              layoutLabel={keyboardLayout}
              onClose={() => updateKeyboardHelperVisibility(false)}
              onInsert={insertGermanCharacter}
            />
          ) : (
            <GermanKeyboardGuideToggle onClick={() => updateKeyboardHelperVisibility(true)} />
          )}

          <div className="copywork-pick-toolbar" role="group" aria-label="Copywork selection mode">
            <button
              className={`capture-mode-tab ${pickMode === "word" ? "active" : ""}`}
              onClick={() => {
                setPickMode("word");
                setPhraseStart(undefined);
              }}
            >
              <Plus size={16} />
              Word
            </button>
            <button
              className={`capture-mode-tab ${pickMode === "phrase" ? "active" : ""}`}
              onClick={() => setPickMode("phrase")}
            >
              <PenLine size={16} />
              Phrase
            </button>
          </div>

          <div className="copywork-token-grid" aria-label="Sentence tokens">
            {tokens.map((token) => {
              const isSaved = rows.some((row) => row.tokenIndexes.includes(token.index));
              const isPhraseStart = phraseStart === token.index;
              return (
                <button
                  key={token.id}
                  className={`copywork-token ${isSaved ? "saved" : ""} ${isPhraseStart ? "phrase-start" : ""}`}
                  onClick={() => void chooseToken(token)}
                  disabled={savingTermKey !== ""}
                  aria-pressed={isSaved || isPhraseStart}
                >
                  {token.text}
                </button>
              );
            })}
          </div>

          <div className="copywork-selected-list" aria-label="Saved copywork terms">
            {rows.map((row) => (
              <span className="copywork-selected-term" key={row.entry.id}>{row.german}</span>
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="copywork-actions">
            <button className="secondary-action" onClick={resetCopywork}>
              Reset
            </button>
            <button
              className="primary-action"
              onClick={() => {
                setStage("review");
                setError("");
                onSaved("");
              }}
              disabled={rows.length === 0}
            >
              <ListChecks size={18} />
              Review
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="link-button copywork-back" onClick={() => setStage("select")}>
            <ArrowLeft size={16} />
            Selection
          </button>

          <div className="copywork-review-list">
            {rows.map((row) => (
              <article className="copywork-review-row" key={row.entry.id}>
                <strong>{row.german}</strong>
                <label>
                  <span>English</span>
                  <input
                    value={row.english}
                    onChange={(event) => updateRow(row.entry.id, { english: event.target.value })}
                  />
                </label>
                <label>
                  <span>Part of speech</span>
                  <select
                    value={row.partOfSpeech}
                    onChange={(event) => updateRow(row.entry.id, {
                      partOfSpeech: event.target.value as PartOfSpeech,
                      article: event.target.value === "noun" ? row.article : undefined,
                    })}
                  >
                    {partOfSpeechOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <span>Article</span>
                  <select
                    required={row.partOfSpeech === "noun"}
                    value={row.article ?? ""}
                    onChange={(event) => updateRow(row.entry.id, {
                      article: event.target.value ? event.target.value as Article : undefined,
                    })}
                  >
                    <option value="">None</option>
                    {articles.map((article) => <option key={article} value={article}>{article}</option>)}
                  </select>
                </label>
                <label>
                  <span>Plural</span>
                  <input
                    value={row.plural}
                    onChange={(event) => updateRow(row.entry.id, { plural: event.target.value })}
                  />
                </label>
              </article>
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}

          <button className="primary-action copywork-save" onClick={() => void saveReview()} disabled={savingReview}>
            <CheckCircle2 size={18} />
            {savingReview ? "Updating..." : "Update terms"}
          </button>
        </>
      )}
    </div>
  );
}

function copyworkDraft(
  sourceDraft: VocabDraft,
  sourceTitle: string,
  sentence: string,
  german: string,
  tokenCount: number,
): VocabDraft {
  return {
    ...sourceDraft,
    german,
    english: copyworkPendingTranslation,
    partOfSpeech: tokenCount > 1 ? "phrase" : "other",
    article: undefined,
    plural: "",
    exampleGerman: sentence,
    exampleEnglish: "",
    notes: `DW copywork: ${sourceTitle}`,
  };
}

function reviewRowFromEntry(entry: VocabEntry, tokens: CopyworkToken[]): CopyworkReviewRow {
  return {
    entry,
    german: entry.german,
    english: visibleCopyworkEnglish(entry.english),
    partOfSpeech: entry.partOfSpeech ?? (tokens.length > 1 ? "phrase" : "other"),
    article: entry.article,
    plural: entry.plural ?? "",
    tokenIndexes: tokens.map((token) => token.index),
  };
}

function visibleCopyworkEnglish(english: string): string {
  return english === copyworkPendingTranslation ? "" : english;
}

function findEntryByGerman(entries: VocabEntry[], german: string): VocabEntry | undefined {
  const key = copyworkTermKey(german);
  return entries.find((entry) => copyworkTermKey(entry.german) === key);
}
