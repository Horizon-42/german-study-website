import { useEffect, useState } from "react";
import { CheckCircle2, Download, Upload } from "lucide-react";
import { exportStudyData, restoreStudyData, saveSettings } from "../../data/db";
import { serializeEntriesCsv } from "../../data/importers";
import {
  parseStudyBackup,
  readAutoBackupPreferences,
  runManualJsonBackup,
  writeAutoBackupPreferences,
  type AutoBackupPreferences,
  type AutoBackupRecord,
  type StoragePersistenceStatus,
} from "../../data/local-backup";
import type { Settings, StudyState } from "../../types/vocab";
import { downloadFile } from "../shared";

export function SettingsPage({
  state,
  refresh,
  storagePersistenceStatus,
  requestStoragePersistence,
  autoBackupRecord,
  onAutoBackupRecordChange,
}: {
  state: StudyState;
  refresh: () => Promise<void>;
  storagePersistenceStatus?: StoragePersistenceStatus;
  requestStoragePersistence: () => Promise<StoragePersistenceStatus>;
  autoBackupRecord: AutoBackupRecord;
  onAutoBackupRecordChange: (record: AutoBackupRecord) => void;
}) {
  const [settings, setSettings] = useState<Settings>(state.settings);
  const [saved, setSaved] = useState(false);
  const [backupPreferences, setBackupPreferences] = useState<AutoBackupPreferences>(() => readAutoBackupPreferences());
  const [backupMessage, setBackupMessage] = useState("");
  const [requestingStorage, setRequestingStorage] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setSettings(state.settings);
  }, [state.settings]);

  async function persistSettings() {
    await saveSettings(settings);
    await refresh();
    setSaved(true);
  }

  async function exportJson() {
    const payload = await exportStudyData();
    downloadFile("german-study-export.json", JSON.stringify(payload, null, 2), "application/json");
  }

  async function backupJsonNow() {
    const outcome = await runManualJsonBackup({
      getPayload: exportStudyData,
      download: downloadFile,
    });
    onAutoBackupRecordChange(outcome.record);
    setBackupMessage(outcome.status === "downloaded" ? `Saved ${outcome.filename}.` : outcome.status === "failed" ? outcome.error : "Backup skipped.");
  }

  async function restoreFromBackup(file: File) {
    setRestoreMessage(undefined);
    const parsed = parseStudyBackup(await file.text());
    if (!parsed.ok) {
      setRestoreMessage({ kind: "error", text: parsed.error });
      return;
    }

    const { payload } = parsed;
    const exportedAt = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : "an unknown date";
    const confirmed = window.confirm(
      `Replace ALL current words, notebooks, review progress and settings with the backup from ${exportedAt}? `
        + `(${payload.entries.length} words, ${payload.reviewLogs.length} reviews.) This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setRestoring(true);
    try {
      await restoreStudyData(payload);
      await refresh();
      setRestoreMessage({ kind: "success", text: `Restored ${payload.entries.length} words and ${payload.reviewLogs.length} reviews.` });
    } catch (error) {
      setRestoreMessage({ kind: "error", text: error instanceof Error ? error.message : "Restore failed." });
    } finally {
      setRestoring(false);
    }
  }

  async function requestPersistentStorageAgain() {
    setRequestingStorage(true);
    await requestStoragePersistence();
    setRequestingStorage(false);
  }

  function updateBackupPreferences(next: Partial<AutoBackupPreferences>) {
    const savedPreferences = writeAutoBackupPreferences({ ...backupPreferences, ...next });
    setBackupPreferences(savedPreferences);
  }

  function exportCsv() {
    downloadFile("german-vocabulary.csv", serializeEntriesCsv(state.entries, state.notebooks, state.notebookEntries), "text/csv");
  }

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Review controls</h1>
        </div>
      </header>

      <section className="panel settings-grid">
        <label className="range-field">
          <span>New cards per day</span>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.dailyNewLimit}
            onChange={(event) => setSettings({ ...settings, dailyNewLimit: Number(event.target.value) })}
          />
        </label>
        <label className="range-field">
          <span>Target retention</span>
          <input
            type="number"
            min={0.7}
            max={0.98}
            step={0.01}
            value={settings.targetRetention}
            onChange={(event) => setSettings({ ...settings, targetRetention: Number(event.target.value) })}
          />
        </label>
        <div className="settings-actions">
          <button className="primary-action" onClick={() => void persistSettings()}>
            <CheckCircle2 size={18} />
            Save
          </button>
          <button className="secondary-action" onClick={() => void exportJson()}>
            <Download size={18} />
            JSON
          </button>
          <button className="secondary-action" onClick={exportCsv}>
            <Download size={18} />
            CSV
          </button>
        </div>
        {saved && <p className="success-text">Settings saved.</p>}
      </section>

      <section className="panel settings-grid">
        <div className="status-tile">
          <span>Persistent storage</span>
          <strong>{storagePersistenceStatus?.label ?? "Checking"}</strong>
          <small>{storagePersistenceStatus?.checkedAt ? new Date(storagePersistenceStatus.checkedAt).toLocaleString() : "Browser storage"}</small>
        </div>
        <div className="status-tile">
          <span>Last JSON backup</span>
          <strong>{autoBackupRecord.lastBackupAt ? new Date(autoBackupRecord.lastBackupAt).toLocaleString() : "Not yet"}</strong>
          <small>{autoBackupRecord.lastBackupFilename ?? autoBackupRecord.lastOutcome ?? "Automatic backup"}</small>
        </div>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={backupPreferences.enabled}
            onChange={(event) => updateBackupPreferences({ enabled: event.target.checked })}
          />
          <span>Automatic JSON backup</span>
        </label>
        <label className="range-field">
          <span>Backup interval hours</span>
          <input
            type="number"
            min={1}
            max={168}
            value={backupPreferences.intervalHours}
            onChange={(event) => updateBackupPreferences({ intervalHours: Number(event.target.value) })}
          />
        </label>
        <div className="settings-actions">
          <button className="secondary-action" disabled={requestingStorage} onClick={() => void requestPersistentStorageAgain()}>
            <CheckCircle2 size={18} />
            {requestingStorage ? "Checking..." : "Persist"}
          </button>
          <button className="primary-action" onClick={() => void backupJsonNow()}>
            <Download size={18} />
            Backup JSON now
          </button>
        </div>
        {backupMessage && <p className={backupMessage.startsWith("Saved") ? "success-text" : "error-text"}>{backupMessage}</p>}
      </section>

      <section className="panel settings-grid">
        <div className="status-tile">
          <span>Restore from backup</span>
          <strong>Everything</strong>
          <small>Words, notebooks, review progress and settings. Replaces current data.</small>
        </div>
        <div className="settings-actions">
          <label className={`secondary-action${restoring ? " is-disabled" : ""}`}>
            <Upload size={18} />
            {restoring ? "Restoring..." : "Choose backup JSON"}
            <input
              type="file"
              accept="application/json,.json"
              hidden
              disabled={restoring}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void restoreFromBackup(file);
                }
              }}
            />
          </label>
        </div>
        {restoreMessage && <p className={`${restoreMessage.kind}-text`}>{restoreMessage.text}</p>}
      </section>
    </section>
  );
}
