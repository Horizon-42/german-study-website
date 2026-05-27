import type { Notebook, NotebookDraft, NotebookEntry } from "../types/vocab";

export const defaultNotebookId = "notebook-default";
export const allNotebooksFocusId = "all";

export function defaultNotebook(now: Date): Notebook {
  const timestamp = now.toISOString();
  return {
    id: defaultNotebookId,
    name: "Core Vocabulary",
    description: "Default notebook for seeded and uncategorized words.",
    color: "#2563eb",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeNotebookDraft(values: Partial<NotebookDraft>): NotebookDraft {
  return {
    name: clean(values.name),
    description: clean(values.description),
    color: clean(values.color),
    sourceName: clean(values.sourceName),
    sourceUrl: clean(values.sourceUrl),
  };
}

export function normalizeNotebookName(name: unknown): string {
  return clean(name);
}

export function materializeNotebook(
  draft: NotebookDraft,
  now: Date,
  createId: () => string,
): Notebook {
  const normalized = normalizeNotebookDraft(draft);

  if (!normalized.name) {
    throw new Error("Notebook name is required.");
  }

  const timestamp = now.toISOString();
  return {
    id: createId(),
    name: normalized.name,
    description: normalized.description,
    color: normalized.color,
    sourceName: normalized.sourceName,
    sourceUrl: normalized.sourceUrl,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function reviseNotebook(notebook: Notebook, now: Date): Notebook {
  const normalized = normalizeNotebookDraft(notebook);

  if (!normalized.name) {
    throw new Error("Notebook name is required.");
  }

  const revised: Notebook = {
    ...notebook,
    ...normalized,
    updatedAt: now.toISOString(),
  };

  clearMissingOptionalFields(revised, normalized);
  return revised;
}

export function notebookEntryId(notebookId: string, vocabEntryId: string): string {
  return `${notebookId}::${vocabEntryId}`;
}

export function createNotebookEntry(
  notebookId: string,
  vocabEntryId: string,
  now: Date,
): NotebookEntry {
  return {
    id: notebookEntryId(notebookId, vocabEntryId),
    notebookId,
    vocabEntryId,
    addedAt: now.toISOString(),
  };
}

export function notebookNameIdentity(name: string): string {
  return clean(name).toLowerCase();
}

function clearMissingOptionalFields(notebook: Notebook, normalized: NotebookDraft): void {
  const optionalFields: Array<keyof NotebookDraft> = [
    "description",
    "color",
    "sourceName",
    "sourceUrl",
  ];

  optionalFields.forEach((field) => {
    if (normalized[field] === "") {
      delete notebook[field];
    }
  });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
