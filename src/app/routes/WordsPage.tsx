import { useState } from "react";
import { Pause, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { deleteVocabEntry, updateCardState, updateVocabEntry } from "../../data/db";
import { filterEntriesForNotebook } from "../../study/notebook-focus";
import { displayGerman, isDue } from "../../study/session-planner";
import type { CardState, Level, StudyState, VocabEntry } from "../../types/vocab";
import { allNotebooksFocusId } from "../../vocabulary/notebooks";
import { levelOptions } from "../../vocabulary/schema";
import type { Route } from "../route-types";
import { notebookNamesForEntry } from "../shared";
import { WordForm } from "../WordForm";

export function WordsPage({
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
  const [notebookFilter, setNotebookFilter] = useState(state.settings.focusNotebookId ?? allNotebooksFocusId);
  const [status, setStatus] = useState<CardState | "due" | "all">("all");
  const [editingEntry, setEditingEntry] = useState<VocabEntry>();
  const notebookId = notebookFilter === allNotebooksFocusId ? undefined : notebookFilter;
  const visibleEntries = filterEntriesForNotebook(state.entries, state.notebookEntries, notebookId);
  const topics = Array.from(new Set(visibleEntries.map((entry) => entry.topic).filter(Boolean) as string[])).sort();
  const filteredEntries = visibleEntries.filter((entry) => {
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
          <select value={notebookFilter} onChange={(event) => setNotebookFilter(event.target.value)}>
            <option value={allNotebooksFocusId}>All notebooks</option>
            {state.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
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
                <th>Notebook</th>
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
                    <td>{notebookNamesForEntry(state, entry.id).join(", ") || "Unassigned"}</td>
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
