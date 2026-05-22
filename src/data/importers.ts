import {
  normalizeVocabularyDraft,
  validateVocabularyDraft,
  vocabularyIdentity,
} from "../vocabulary/authoring";
import type { VocabDraft, VocabEntry } from "../types/vocab";

export type ImportRow = {
  rowNumber: number;
  draft: VocabDraft;
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

const headers = [
  "german",
  "english",
  "partOfSpeech",
  "article",
  "plural",
  "exampleGerman",
  "exampleEnglish",
  "level",
  "topic",
  "sourceName",
  "sourceUrl",
  "notes",
] as const;

type Header = (typeof headers)[number];

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

  const seen = new Set(existingEntries.map(vocabularyIdentity));
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
    const duplicate = seen.has(key);
    seen.add(key);
    rows.push({ rowNumber, draft, duplicate });
  });

  return { rows, errors };
}

export function serializeEntriesCsv(entries: VocabEntry[]): string {
  const body = entries.map((entry) =>
    headers
      .map((header) => csvEscape(String(entry[header] ?? "")))
      .join(","),
  );

  return [headers.join(","), ...body].join("\n");
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

    return {
      rows: source
        .filter(isRecord)
        .map((values, index) => ({ rowNumber: index + 1, values })),
    };
  } catch {
    return { errors: [{ rowNumber: 1, message: "Invalid JSON." }] };
  }
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
