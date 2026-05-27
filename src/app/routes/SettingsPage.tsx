import { useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { exportStudyData, saveSettings } from "../../data/db";
import { serializeEntriesCsv } from "../../data/importers";
import type { Settings, StudyState } from "../../types/vocab";
import { downloadFile } from "../shared";

export function SettingsPage({ state, refresh }: { state: StudyState; refresh: () => Promise<void> }) {
  const [settings, setSettings] = useState<Settings>(state.settings);
  const [saved, setSaved] = useState(false);

  async function persistSettings() {
    await saveSettings(settings);
    await refresh();
    setSaved(true);
  }

  async function exportJson() {
    const payload = await exportStudyData();
    downloadFile("german-study-export.json", JSON.stringify(payload, null, 2), "application/json");
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
    </section>
  );
}
