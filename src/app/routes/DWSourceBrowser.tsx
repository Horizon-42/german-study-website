import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ExternalLink, Plus, Search } from "lucide-react";
import { addVocabEntry, createNotebook, setFocusNotebook } from "../../data/db";
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
import type { Level, StudyState } from "../../types/vocab";
import { levelOptions } from "../../vocabulary/schema";
import { notebookFocusName } from "../shared";
import { WordForm } from "../WordForm";

export function DWSourceBrowser({ state, refresh }: { state: StudyState; refresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DWSourceKind | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [selectedSource, setSelectedSource] = useState<DWSource>(() => initialDwSource());
  const [saved, setSaved] = useState("");
  const sourceTopics = useMemo(() => dwSourceTopics(), []);
  const filteredSources = filterDwSources({ query, kind, level });
  const sourceDraft = useMemo(() => sourceToVocabularyDraft(selectedSource), [selectedSource]);
  const focusName = notebookFocusName(state);

  function chooseSource(source: DWSource, scrollToViewer = true) {
    setSelectedSource(source);
    setSaved("");
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
            <span>Saving to {focusName}</span>
          </div>
          <span className="source-selected-pill">{selectedSource.kind}{selectedSource.level ? ` · ${selectedSource.level}` : ""}</span>
        </div>
        <WordForm
          key={`${selectedSource.id}-${saved}`}
          initial={sourceDraft}
          submitLabel="Add DW word"
          resetOnSubmit
          onSubmit={async (draft) => {
            await addVocabEntry(draft, state.settings.focusNotebookId);
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
