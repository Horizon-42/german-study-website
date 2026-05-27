import type { ExportPayload } from "../types/vocab";

export type StoragePersistenceStatus =
  | {
      supported: false;
      persisted: false;
      requested: false;
      granted: false;
      checkedAt: string;
      label: "Unsupported";
    }
  | {
      supported: true;
      persisted: boolean;
      requested: boolean;
      granted: boolean;
      checkedAt: string;
      label: "Persisted" | "Granted" | "Denied";
    };

export type AutoBackupPreferences = {
  enabled: boolean;
  intervalHours: number;
};

export type AutoBackupRecord = {
  lastBackupAt?: string;
  lastSnapshotHash?: string;
  lastBackupFilename?: string;
  lastOutcome?: "downloaded" | "disabled" | "waiting" | "unchanged" | "failed";
  lastError?: string;
};

export type BackupOutcome =
  | { status: "downloaded"; filename: string; record: AutoBackupRecord }
  | { status: "disabled"; record: AutoBackupRecord }
  | { status: "waiting"; record: AutoBackupRecord; nextBackupAt?: string }
  | { status: "unchanged"; record: AutoBackupRecord }
  | { status: "failed"; record: AutoBackupRecord; error: string };

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const preferencesKey = "german-study:auto-backup-preferences";
const recordKey = "german-study:auto-backup-record";
const defaultPreferences: AutoBackupPreferences = {
  enabled: true,
  intervalHours: 24,
};

export async function requestPersistentStorage(now = () => new Date()): Promise<StoragePersistenceStatus> {
  const checkedAt = now().toISOString();

  if (!navigator.storage?.persist) {
    return {
      supported: false,
      persisted: false,
      requested: false,
      granted: false,
      checkedAt,
      label: "Unsupported",
    };
  }

  const persisted = await navigator.storage.persisted?.() ?? false;
  if (persisted) {
    return {
      supported: true,
      persisted: true,
      requested: false,
      granted: true,
      checkedAt,
      label: "Persisted",
    };
  }

  const granted = await navigator.storage.persist();
  return {
    supported: true,
    persisted: granted,
    requested: true,
    granted,
    checkedAt,
    label: granted ? "Granted" : "Denied",
  };
}

export function readAutoBackupPreferences(storage = browserStorage()): AutoBackupPreferences {
  const parsed = readJson<Partial<AutoBackupPreferences>>(preferencesKey, storage);
  return normalizePreferences(parsed);
}

export function writeAutoBackupPreferences(
  preferences: Partial<AutoBackupPreferences>,
  storage = browserStorage(),
): AutoBackupPreferences {
  const normalized = normalizePreferences(preferences);
  writeJson(preferencesKey, normalized, storage);
  return normalized;
}

export function readAutoBackupRecord(storage = browserStorage()): AutoBackupRecord {
  return readJson<AutoBackupRecord>(recordKey, storage) ?? {};
}

export async function runManualJsonBackup({
  getPayload,
  download,
  storage = browserStorage(),
  now = () => new Date(),
}: {
  getPayload: () => Promise<ExportPayload>;
  download: (filename: string, content: string, type: string) => void;
  storage?: KeyValueStorage;
  now?: () => Date;
}): Promise<BackupOutcome> {
  return writeJsonBackup({ getPayload, download, storage, now });
}

export async function maybeRunAutomaticJsonBackup({
  getPayload,
  download,
  storage = browserStorage(),
  now = () => new Date(),
}: {
  getPayload: () => Promise<ExportPayload>;
  download: (filename: string, content: string, type: string) => void;
  storage?: KeyValueStorage;
  now?: () => Date;
}): Promise<BackupOutcome> {
  const preferences = readAutoBackupPreferences(storage);
  const existingRecord = readAutoBackupRecord(storage);

  if (!preferences.enabled) {
    const record = { ...existingRecord, lastOutcome: "disabled" as const };
    writeJson(recordKey, record, storage);
    return { status: "disabled", record };
  }

  const nextBackupAt = nextBackupTime(existingRecord.lastBackupAt, preferences.intervalHours);
  if (nextBackupAt && nextBackupAt.getTime() > now().getTime()) {
    const record = { ...existingRecord, lastOutcome: "waiting" as const };
    writeJson(recordKey, record, storage);
    return { status: "waiting", record, nextBackupAt: nextBackupAt.toISOString() };
  }

  const payload = await getPayload();
  const hash = backupSnapshotHash(payload);
  if (existingRecord.lastSnapshotHash === hash) {
    const record = { ...existingRecord, lastOutcome: "unchanged" as const };
    writeJson(recordKey, record, storage);
    return { status: "unchanged", record };
  }

  return writeJsonBackup({ payload, download, storage, now, hash });
}

export function backupSnapshotHash(payload: ExportPayload): string {
  const snapshot = {
    schemaVersion: payload.schemaVersion,
    entries: sortById(payload.entries),
    cards: sortById(payload.cards),
    reviewLogs: sortById(payload.reviewLogs),
    notebooks: sortById(payload.notebooks),
    notebookEntries: sortById(payload.notebookEntries),
    settings: payload.settings,
  };

  return hashString(stableStringify(snapshot));
}

export function backupFilename(exportedAt: string): string {
  const stamp = exportedAt.replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "-");
  return `german-study-backup-${stamp}.json`;
}

async function writeJsonBackup({
  getPayload,
  payload,
  download,
  storage,
  now,
  hash,
}: {
  getPayload?: () => Promise<ExportPayload>;
  payload?: ExportPayload;
  download: (filename: string, content: string, type: string) => void;
  storage?: KeyValueStorage;
  now: () => Date;
  hash?: string;
}): Promise<BackupOutcome> {
  try {
    const exportedPayload = payload ?? await getPayload?.();
    if (!exportedPayload) {
      throw new Error("No backup payload was produced.");
    }

    const snapshotHash = hash ?? backupSnapshotHash(exportedPayload);
    const filename = backupFilename(exportedPayload.exportedAt);
    download(filename, JSON.stringify(exportedPayload, null, 2), "application/json");
    const record: AutoBackupRecord = {
      lastBackupAt: now().toISOString(),
      lastSnapshotHash: snapshotHash,
      lastBackupFilename: filename,
      lastOutcome: "downloaded",
    };
    writeJson(recordKey, record, storage);
    return { status: "downloaded", filename, record };
  } catch (error) {
    const record: AutoBackupRecord = {
      ...readAutoBackupRecord(storage),
      lastOutcome: "failed",
      lastError: error instanceof Error ? error.message : String(error),
    };
    writeJson(recordKey, record, storage);
    return { status: "failed", record, error: record.lastError ?? "Backup failed." };
  }
}

function nextBackupTime(lastBackupAt: string | undefined, intervalHours: number): Date | undefined {
  if (!lastBackupAt) {
    return undefined;
  }

  const timestamp = new Date(lastBackupAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Date(timestamp + intervalHours * 60 * 60 * 1000);
}

function normalizePreferences(values: Partial<AutoBackupPreferences> | undefined | null): AutoBackupPreferences {
  const intervalHours = Number(values?.intervalHours);
  return {
    enabled: typeof values?.enabled === "boolean" ? values.enabled : defaultPreferences.enabled,
    intervalHours: Number.isFinite(intervalHours) && intervalHours > 0 ? intervalHours : defaultPreferences.intervalHours,
  };
}

function sortById<T extends { id: string }>(values: T[]): T[] {
  return [...values].sort((a, b) => a.id.localeCompare(b.id));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readJson<T>(key: string, storage?: KeyValueStorage): T | undefined {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) as T : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown, storage?: KeyValueStorage): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort only. The backup file itself is the important artifact.
  }
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
