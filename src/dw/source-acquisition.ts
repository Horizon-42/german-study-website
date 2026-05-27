import { dwSources } from "../data/dw-sources";
import type { DWSource, DWSourceKind } from "../data/dw-sources";
import type { Level, NotebookDraft, VocabDraft } from "../types/vocab";

export type { DWSource, DWSourceKind };

export type DWSourceFilters = {
  query?: string;
  kind?: DWSourceKind | "all";
  level?: Level | "all";
};

export const allDwSources = dwSources;

export function initialDwSource(sources: DWSource[] = allDwSources): DWSource {
  const [source] = sources;

  if (!source) {
    throw new Error("DW source catalog is empty.");
  }

  return source;
}

export function findDwSource(sourceId: string, sources: DWSource[] = allDwSources): DWSource | undefined {
  return sources.find((source) => source.id === sourceId);
}

export function filterDwSources(
  filters: DWSourceFilters,
  sources: DWSource[] = allDwSources,
): DWSource[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const kind = filters.kind ?? "all";
  const level = filters.level ?? "all";

  return sources.filter((source) => {
    const matchesQuery = query === "" || sourceSearchText(source).includes(query);
    const matchesKind = kind === "all" || source.kind === kind;
    const matchesLevel = level === "all" || source.level === level;
    return matchesQuery && matchesKind && matchesLevel;
  });
}

export function dwSourceTopics(sources: DWSource[] = allDwSources): string[] {
  return Array.from(new Set(sources.map((source) => source.topic))).sort();
}

export function sourceToVocabularyDraft(source: DWSource): VocabDraft {
  return {
    german: "",
    english: "",
    partOfSpeech: "noun",
    article: undefined,
    plural: "",
    exampleGerman: "",
    exampleEnglish: "",
    topic: source.topic,
    level: source.level ?? "A1",
    sourceName: "DW Learn German",
    sourceUrl: source.url,
    notes: `DW source: ${source.title}`,
  };
}

export function sourceToNotebookDraft(source: DWSource): NotebookDraft {
  return {
    name: source.title,
    description: `Words collected while studying ${source.title}.`,
    sourceName: "DW Learn German",
    sourceUrl: source.url,
  };
}

function sourceSearchText(source: DWSource): string {
  return `${source.title} ${source.topic} ${source.kind} ${source.level ?? ""}`.toLowerCase();
}
