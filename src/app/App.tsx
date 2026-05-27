import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  FileUp,
  Globe2,
  Home,
  Play,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  getStudyState,
  initializeStore,
  exportStudyData,
} from "../data/db";
import {
  maybeRunAutomaticJsonBackup,
  readAutoBackupRecord,
  requestPersistentStorage,
  type AutoBackupRecord,
  type StoragePersistenceStatus,
} from "../data/local-backup";
import type { StudyState } from "../types/vocab";
import {
  Dashboard,
  DWSourceBrowser,
  ErrorScreen,
  ImportPage,
  LoadingScreen,
  NavButton,
  NewWordPage,
  NotebooksPage,
  ReviewSession,
  SettingsPage,
  WordsPage,
  readRoute,
  type Route,
} from "./workspaces";
import { downloadFile } from "./shared";

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [state, setState] = useState<StudyState>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [storagePersistenceStatus, setStoragePersistenceStatus] = useState<StoragePersistenceStatus>();
  const [autoBackupRecord, setAutoBackupRecord] = useState<AutoBackupRecord>(() => readAutoBackupRecord());

  useEffect(() => {
    void initializeStore()
      .then(setState)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void requestStoragePersistence();
  }, []);

  useEffect(() => {
    if (!state) {
      return undefined;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void maybeRunAutomaticJsonBackup({
        getPayload: exportStudyData,
        download: downloadFile,
      }).then((outcome) => {
        if (!cancelled) {
          setAutoBackupRecord(outcome.record);
        }
      });
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [state]);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function requestStoragePersistence() {
    const status = await requestPersistentStorage();
    setStoragePersistenceStatus(status);
    return status;
  }

  async function refresh() {
    setState(await getStudyState());
  }

  function navigate(nextRoute: Route) {
    window.history.pushState({}, "", nextRoute);
    setRoute(nextRoute);
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !state) {
    return <ErrorScreen message={error ?? "The study data could not be loaded."} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand-lockup">
          <span className="brand-mark">DE</span>
          <div>
            <strong>German Study</strong>
            <span>A1 vocabulary trainer</span>
          </div>
        </div>
        <nav className="nav-stack">
          <NavButton active={route === "/" || route === "/dw"} icon={<Globe2 size={18} />} label="DW" onClick={() => navigate("/")} />
          <NavButton active={route === "/dashboard"} icon={<Home size={18} />} label="Dashboard" onClick={() => navigate("/dashboard")} />
          <NavButton active={route === "/review"} icon={<Play size={18} />} label="Review" onClick={() => navigate("/review")} />
          <NavButton active={route === "/articles"} icon={<CalendarDays size={18} />} label="Articles" onClick={() => navigate("/articles")} />
          <NavButton active={route === "/words" || route === "/words/new"} icon={<BookOpen size={18} />} label="Words" onClick={() => navigate("/words")} />
          <NavButton active={route === "/notebooks"} icon={<BookOpen size={18} />} label="Notebooks" onClick={() => navigate("/notebooks")} />
          <NavButton active={route === "/import"} icon={<FileUp size={18} />} label="Import" onClick={() => navigate("/import")} />
          <NavButton active={route === "/settings"} icon={<SettingsIcon size={18} />} label="Settings" onClick={() => navigate("/settings")} />
        </nav>
      </aside>

      <main className="main-content">
        {(route === "/" || route === "/dw") && <DWSourceBrowser state={state} refresh={refresh} />}
        {route === "/dashboard" && <Dashboard state={state} refresh={refresh} navigate={navigate} />}
        {route === "/review" && <ReviewSession mode="words" state={state} refresh={refresh} navigate={navigate} />}
        {route === "/articles" && <ReviewSession mode="articles" state={state} refresh={refresh} navigate={navigate} />}
        {route === "/words" && <WordsPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/words/new" && <NewWordPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/notebooks" && <NotebooksPage state={state} refresh={refresh} />}
        {route === "/import" && <ImportPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/settings" && (
          <SettingsPage
            state={state}
            refresh={refresh}
            storagePersistenceStatus={storagePersistenceStatus}
            requestStoragePersistence={requestStoragePersistence}
            autoBackupRecord={autoBackupRecord}
            onAutoBackupRecordChange={setAutoBackupRecord}
          />
        )}
      </main>
    </div>
  );
}
