import { describe, expect, it } from "vitest";
import {
  backupFilename,
  backupSnapshotHash,
  maybeRunAutomaticJsonBackup,
  readAutoBackupPreferences,
  runManualJsonBackup,
  writeAutoBackupPreferences,
} from "./local-backup";
import type { ExportPayload } from "../types/vocab";

describe("local backup", () => {
  it("defaults automatic JSON backup to enabled once per day", () => {
    expect(readAutoBackupPreferences(memoryStorage())).toEqual({
      enabled: true,
      intervalHours: 24,
    });
  });

  it("stores normalized backup preferences", () => {
    const storage = memoryStorage();

    expect(writeAutoBackupPreferences({ enabled: false, intervalHours: 0 }, storage)).toEqual({
      enabled: false,
      intervalHours: 24,
    });
    expect(readAutoBackupPreferences(storage)).toEqual({
      enabled: false,
      intervalHours: 24,
    });
  });

  it("creates a stable snapshot hash that ignores export time and record ordering", () => {
    const first = exportPayload({
      exportedAt: "2026-05-27T10:00:00.000Z",
      entries: [
        { id: "b", german: "gehen", english: "to go", createdAt: "now", updatedAt: "now" },
        { id: "a", german: "Haus", english: "house", createdAt: "now", updatedAt: "now" },
      ],
    });
    const second = exportPayload({
      exportedAt: "2026-05-28T10:00:00.000Z",
      entries: [...first.entries].reverse(),
    });

    expect(backupSnapshotHash(first)).toBe(backupSnapshotHash(second));
  });

  it("downloads an automatic backup only when the interval has passed and data changed", async () => {
    const storage = memoryStorage();
    const downloads: string[] = [];
    const getPayload = async () => exportPayload();

    const first = await maybeRunAutomaticJsonBackup({
      getPayload,
      storage,
      now: () => new Date("2026-05-27T10:00:00.000Z"),
      download: (filename) => downloads.push(filename),
    });
    const second = await maybeRunAutomaticJsonBackup({
      getPayload,
      storage,
      now: () => new Date("2026-05-27T12:00:00.000Z"),
      download: (filename) => downloads.push(filename),
    });
    const third = await maybeRunAutomaticJsonBackup({
      getPayload,
      storage,
      now: () => new Date("2026-05-28T11:00:00.000Z"),
      download: (filename) => downloads.push(filename),
    });

    expect(first.status).toBe("downloaded");
    expect(second.status).toBe("waiting");
    expect(third.status).toBe("unchanged");
    expect(downloads).toEqual(["german-study-backup-2026-05-27T10-00-00Z.json"]);
  });

  it("manual backup always downloads the current JSON payload", async () => {
    const downloads: Array<{ filename: string; content: string; type: string }> = [];

    const outcome = await runManualJsonBackup({
      getPayload: async () => exportPayload(),
      storage: memoryStorage(),
      now: () => new Date("2026-05-27T10:00:00.000Z"),
      download: (filename, content, type) => downloads.push({ filename, content, type }),
    });

    expect(outcome.status).toBe("downloaded");
    expect(downloads[0]).toMatchObject({
      filename: backupFilename("2026-05-27T10:00:00.000Z"),
      type: "application/json",
    });
    expect(JSON.parse(downloads[0].content)).toMatchObject({ schemaVersion: 2 });
  });
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function exportPayload(overrides: Partial<ExportPayload> = {}): ExportPayload {
  return {
    schemaVersion: 2,
    exportedAt: "2026-05-27T10:00:00.000Z",
    entries: [
      {
        id: "entry",
        german: "Haus",
        english: "house",
        createdAt: "2026-05-27T09:00:00.000Z",
        updatedAt: "2026-05-27T09:00:00.000Z",
      },
    ],
    cards: [],
    reviewLogs: [],
    notebooks: [],
    notebookEntries: [],
    settings: {
      id: "settings",
      dailyNewLimit: 10,
      targetRetention: 0.9,
    },
    ...overrides,
  };
}
