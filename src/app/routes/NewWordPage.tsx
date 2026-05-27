import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { addVocabEntry } from "../../data/db";
import type { StudyState } from "../../types/vocab";
import { emptyVocabularyDraft } from "../../vocabulary/schema";
import type { Route } from "../route-types";
import { WordForm } from "../WordForm";

export function NewWordPage({
  state,
  refresh,
  navigate,
}: {
  state: StudyState;
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [targetNotebookId, setTargetNotebookId] = useState(state.settings.focusNotebookId ?? state.notebooks[0]?.id ?? "");

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">New word</p>
          <h1>Add vocabulary</h1>
        </div>
      </header>
      <section className="panel editor-panel">
        <label className="wide-field">
          <span>Notebook</span>
          <select value={targetNotebookId} onChange={(event) => setTargetNotebookId(event.target.value)}>
            {state.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
          </select>
        </label>
        <WordForm
          initial={emptyVocabularyDraft}
          submitLabel="Add word"
          onSubmit={async (draft) => {
            await addVocabEntry(draft, targetNotebookId);
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
