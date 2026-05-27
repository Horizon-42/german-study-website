import {
  normalizeVocabularyDraft,
  validateVocabularyDraft,
  vocabularyIdentity,
} from "../vocabulary/authoring";
import { normalizeNotebookName } from "../vocabulary/notebooks";
import { vocabularyCsvHeaders } from "../vocabulary/schema";
import type { Notebook, NotebookEntry, VocabDraft, VocabEntry } from "../types/vocab";

export type ImportRow = {
  rowNumber: number;
  draft: VocabDraft;
  notebookName?: string;
  existingEntryId?: string;
  duplicate: boolean;
};

export type ImportError = {
  rowNumber: number;
  message: string;
};

export type ImportPreview = {
  rows: ImportRow[];
  errors: ImportError[];
};

export function parseVocabularyInput(text: string, existingEntries: VocabEntry[] = []): ImportPreview {
  const trimmed = text.trim();
  if (!trimmed) {
    return { rows: [], errors: [{ rowNumber: 1, message: "Import text is empty." }] };
  }

  const rawRows = trimmed.startsWith("[") || trimmed.startsWith("{")
    ? parseJsonRows(trimmed)
    : parseCsvRows(trimmed);

  if ("errors" in rawRows) {
    return { rows: [], errors: rawRows.errors };
  }

  const existingByIdentity = new Map(existingEntries.map((entry) => [vocabularyIdentity(entry), entry]));
  const seen = new Set(existingByIdentity.keys());
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];

  rawRows.rows.forEach(({ rowNumber, values }) => {
    const draft = normalizeVocabularyDraft(values);
    const [validationError] = validateVocabularyDraft(draft);

    if (validationError) {
      errors.push({ rowNumber, message: validationError.message });
      return;
    }

    const key = vocabularyIdentity(draft);
    const existingEntry = existingByIdentity.get(key);
    const duplicate = seen.has(key);
    seen.add(key);
    rows.push({
      rowNumber,
      draft,
      notebookName: normalizeNotebookName(values.notebookName ?? values.notebook),
      existingEntryId: existingEntry?.id,
      duplicate,
    });
  });

  return { rows, errors };
}

export function serializeEntriesCsv(
  entries: VocabEntry[],
  notebooks: Notebook[] = [],
  notebookEntries: NotebookEntry[] = [],
): string {
  const notebookById = new Map(notebooks.map((notebook) => [notebook.id, notebook]));
  const membershipsByEntryId = new Map<string, NotebookEntry[]>();
  notebookEntries.forEach((link) => {
    membershipsByEntryId.set(link.vocabEntryId, [...membershipsByEntryId.get(link.vocabEntryId) ?? [], link]);
  });
  const rows = entries.flatMap((entry) => {
    const memberships = membershipsByEntryId.get(entry.id) ?? [undefined];
    return memberships.map((membership) => ({ entry, notebook: membership ? notebookById.get(membership.notebookId) : undefined }));
  });
  const body = rows.map(({ entry, notebook }) =>
    vocabularyCsvHeaders
      .map((header) => csvEscape(header === "notebook" ? notebook?.name ?? "" : String(entry[header] ?? "")))
      .join(","),
  );

  return [vocabularyCsvHeaders.join(","), ...body].join("\n");
}

function parseJsonRows(text: string):
  | { rows: Array<{ rowNumber: number; values: Record<string, unknown> }> }
  | { errors: ImportError[] } {
  try {
    const parsed = JSON.parse(text) as unknown;
    const source = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.entries)
        ? parsed.entries
        : null;

    if (!source) {
      return {
        errors: [{ rowNumber: 1, message: "JSON must be an array or an exported payload with `entries`." }],
      };
    }

    if (isRecord(parsed) && Array.isArray(parsed.entries) && Array.isArray(parsed.notebooks)) {
      return { rows: rowsFromExportPayload(parsed) };
    }

    return {
      rows: source
        .filter(isRecord)
        .map((values, index) => ({ rowNumber: index + 1, values })),
    };
  } catch {
    return { errors: [{ rowNumber: 1, message: "Invalid JSON." }] };
  }
}

function rowsFromExportPayload(payload: Record<string, unknown>): Array<{ rowNumber: number; values: Record<string, unknown> }> {
  const notebooks = Array.isArray(payload.notebooks) ? payload.notebooks.filter(isRecord) : [];
  const notebookEntries = Array.isArray(payload.notebookEntries) ? payload.notebookEntries.filter(isRecord) : [];
  const entries = Array.isArray(payload.entries) ? payload.entries.filter(isRecord) : [];
  const notebookNameById = new Map(notebooks.map((notebook) => [String(notebook.id), notebook.name]));
  const membershipsByEntryId = new Map<string, Record<string, unknown>[]>();

  notebookEntries.forEach((link) => {
    const vocabEntryId = String(link.vocabEntryId ?? "");
    membershipsByEntryId.set(vocabEntryId, [...membershipsByEntryId.get(vocabEntryId) ?? [], link]);
  });

  return entries.flatMap((entry, index) => {
    const memberships = membershipsByEntryId.get(String(entry.id ?? "")) ?? [undefined];
    return memberships.map((membership) => ({
      rowNumber: index + 1,
      values: {
        ...entry,
        notebook: membership ? notebookNameById.get(String(membership.notebookId)) ?? "" : "",
      },
    }));
  });
}

function parseCsvRows(text: string):
  | { rows: Array<{ rowNumber: number; values: Record<string, unknown> }> }
  | { errors: ImportError[] } {
  const table = parseCsvTable(text);

  if (table.length < 2) {
    return { errors: [{ rowNumber: 1, message: "CSV needs a header row and at least one word row." }] };
  }

  const csvHeaders = table[0].map((cell) => cell.trim());
  const germanIndex = csvHeaders.indexOf("german");
  const englishIndex = csvHeaders.indexOf("english");

  if (germanIndex === -1 || englishIndex === -1) {
    return { errors: [{ rowNumber: 1, message: "CSV header must include `german` and `english`." }] };
  }

  const rows = table.slice(1).map((cells, index) => {
    const values: Record<string, unknown> = {};
    csvHeaders.forEach((header, cellIndex) => {
      values[header] = cells[cellIndex] ?? "";
    });
    return { rowNumber: index + 2, values };
  });

  return { rows };
}

function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      i += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
