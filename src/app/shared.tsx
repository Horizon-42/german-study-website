import type { ReactNode } from "react";
import { setFocusNotebook } from "../data/db";
import type { StudyState } from "../types/vocab";
import { allNotebooksFocusId } from "../vocabulary/notebooks";

export function NavButton({
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

export function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function FocusNotebookSelect({ state, refresh }: { state: StudyState; refresh: () => Promise<void> }) {
  const value = state.settings.focusNotebookId ?? allNotebooksFocusId;

  return (
    <label className="compact-select">
      <span>Focus</span>
      <select
        value={value}
        onChange={async (event) => {
          await setFocusNotebook(event.target.value === allNotebooksFocusId ? undefined : event.target.value);
          await refresh();
        }}
      >
        <option value={allNotebooksFocusId}>All notebooks</option>
        {state.notebooks.map((notebook) => (
          <option key={notebook.id} value={notebook.id}>{notebook.name}</option>
        ))}
      </select>
    </label>
  );
}

export function notebookFocusName(state: StudyState): string {
  if (!state.settings.focusNotebookId) {
    return "All notebooks";
  }

  return state.notebooks.find((notebook) => notebook.id === state.settings.focusNotebookId)?.name ?? "Selected notebook";
}

export function notebookNamesForEntry(state: StudyState, entryId: string): string[] {
  const notebookById = new Map(state.notebooks.map((notebook) => [notebook.id, notebook.name]));
  return state.notebookEntries
    .filter((link) => link.vocabEntryId === entryId)
    .map((link) => notebookById.get(link.notebookId))
    .filter(Boolean) as string[];
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <main className="center-screen">
      <div className="loading-mark" />
      <p>Loading German Study...</p>
    </main>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="center-screen">
      <h1>Could not load the app</h1>
      <p>{message}</p>
    </main>
  );
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
