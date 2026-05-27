import { useState } from "react";
import { BookOpen, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { createNotebook, deleteNotebook, setFocusNotebook, updateNotebook } from "../../data/db";
import { notebookCounts } from "../../study/notebook-focus";
import { isDue } from "../../study/session-planner";
import type { Notebook, StudyState } from "../../types/vocab";
import { defaultNotebookId } from "../../vocabulary/notebooks";
import { FocusNotebookSelect } from "../shared";

export function NotebooksPage({ state, refresh }: { state: StudyState; refresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingNotebook, setEditingNotebook] = useState<Notebook>();
  const [message, setMessage] = useState("");
  const counts = notebookCounts(state.notebooks, state.entries, state.cards, state.notebookEntries, (card) => isDue(card));

  async function createNewNotebook() {
    const notebook = await createNotebook({ name, description });
    await setFocusNotebook(notebook.id);
    await refresh();
    setName("");
    setDescription("");
    setMessage(`Notebook "${notebook.name}" created and selected.`);
  }

  async function saveNotebook() {
    if (!editingNotebook) {
      return;
    }

    await updateNotebook(editingNotebook);
    await refresh();
    setEditingNotebook(undefined);
    setMessage("Notebook updated.");
  }

  async function removeNotebook(notebook: Notebook) {
    const confirmed = window.confirm(`Delete notebook "${notebook.name}"? Words and review history stay in your library.`);
    if (!confirmed) {
      return;
    }

    await deleteNotebook(notebook.id);
    await refresh();
    setMessage(`Notebook "${notebook.name}" deleted.`);
  }

  async function focusNotebook(notebookId?: string) {
    await setFocusNotebook(notebookId);
    await refresh();
  }

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Notebooks</p>
          <h1>Manage study focus</h1>
        </div>
        <button className="secondary-action" onClick={() => void focusNotebook(undefined)}>
          <BookOpen size={18} />
          Study all
        </button>
      </header>

      <section className="panel settings-grid">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Travel A1" />
        </label>
        <label>
          <span>Description</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Words for one learning focus" />
        </label>
        <div className="settings-actions">
          <button className="primary-action" disabled={!name.trim()} onClick={() => void createNewNotebook()}>
            <Plus size={18} />
            Create notebook
          </button>
        </div>
        {message && <p className="success-text">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Library</p>
            <h2>{state.notebooks.length} notebooks</h2>
          </div>
          <FocusNotebookSelect state={state} refresh={refresh} />
        </div>
        <div className="source-grid">
          {counts.map(({ notebook, entryCount, cardCount, dueCardCount }) => (
            <article className={`source-card ${state.settings.focusNotebookId === notebook.id ? "selected" : ""}`} key={notebook.id}>
              <div>
                <span className="source-kind">{dueCardCount} due · {cardCount} cards</span>
                <h2>{notebook.name}</h2>
                <p>{notebook.description ?? `${entryCount} words`}</p>
              </div>
              <div className="source-card-actions">
                <button className="secondary-action" onClick={() => void focusNotebook(notebook.id)}>
                  Focus
                </button>
                <button className="icon-button" aria-label={`Edit ${notebook.name}`} title={`Edit ${notebook.name}`} onClick={() => setEditingNotebook(notebook)}>
                  <Pencil size={16} />
                </button>
                <button className="icon-button danger" disabled={notebook.id === defaultNotebookId} aria-label={`Delete ${notebook.name}`} title={`Delete ${notebook.name}`} onClick={() => void removeNotebook(notebook)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {editingNotebook && (
        <section className="panel editor-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Edit notebook</p>
              <h2>{editingNotebook.name}</h2>
            </div>
            <button className="secondary-action" onClick={() => setEditingNotebook(undefined)}>Close</button>
          </div>
          <div className="settings-grid">
            <label>
              <span>Name</span>
              <input value={editingNotebook.name} onChange={(event) => setEditingNotebook({ ...editingNotebook, name: event.target.value })} />
            </label>
            <label>
              <span>Description</span>
              <input value={editingNotebook.description ?? ""} onChange={(event) => setEditingNotebook({ ...editingNotebook, description: event.target.value })} />
            </label>
            <button className="primary-action" onClick={() => void saveNotebook()}>
              <CheckCircle2 size={18} />
              Save notebook
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
