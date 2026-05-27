import { useMemo, useState } from "react";
import { FileUp } from "lucide-react";
import { createNotebook, importVocabEntries } from "../../data/db";
import { parseVocabularyInput } from "../../data/importers";
import type { StudyState } from "../../types/vocab";
import type { Route } from "../route-types";

export function ImportPage({
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
  const [targetNotebookId, setTargetNotebookId] = useState(state.settings.focusNotebookId ?? state.notebooks[0]?.id ?? "");
  const [newNotebookName, setNewNotebookName] = useState("");
  const preview = useMemo(() => parseVocabularyInput(text, state.entries), [text, state.entries]);
  const importableRows = preview.rows;

  async function commitImport() {
    const targetNotebook = newNotebookName.trim()
      ? await createNotebook({ name: newNotebookName.trim(), description: "Imported notebook." })
      : undefined;
    const result = await importVocabEntries(
      importableRows.map((row) => ({ draft: row.draft, notebookName: row.notebookName })),
      targetNotebook?.id ?? targetNotebookId,
    );
    await refresh();
    setMessage(`${result.createdEntries} words created, ${result.linkedEntries} existing words linked, ${result.createdNotebooks + (targetNotebook ? 1 : 0)} notebooks created.`);
    setText("");
    setNewNotebookName("");
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
            placeholder="notebook,german,english,partOfSpeech,article,level,topic&#10;Travel,Frage,question,noun,die,A1,Basics"
          />
        </label>
        <div className="import-preview">
          <h2>Preview</h2>
          <label>
            <span>Fallback notebook</span>
            <select value={targetNotebookId} onChange={(event) => setTargetNotebookId(event.target.value)}>
              {state.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
            </select>
          </label>
          <label>
            <span>Create notebook for rows without notebook column</span>
            <input value={newNotebookName} onChange={(event) => setNewNotebookName(event.target.value)} placeholder="Optional notebook name" />
          </label>
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
                    <span>{row.draft.english}{row.notebookName ? ` · ${row.notebookName}` : ""}</span>
                  </div>
                  <small>{row.duplicate ? "link existing" : row.draft.level ?? "A1"}</small>
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
