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
} from "../data/db";
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

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [state, setState] = useState<StudyState>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void initializeStore()
      .then(setState)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
          <NavButton active={route === "/"} icon={<Home size={18} />} label="Dashboard" onClick={() => navigate("/")} />
          <NavButton active={route === "/review"} icon={<Play size={18} />} label="Review" onClick={() => navigate("/review")} />
          <NavButton active={route === "/articles"} icon={<CalendarDays size={18} />} label="Articles" onClick={() => navigate("/articles")} />
          <NavButton active={route === "/words" || route === "/words/new"} icon={<BookOpen size={18} />} label="Words" onClick={() => navigate("/words")} />
          <NavButton active={route === "/notebooks"} icon={<BookOpen size={18} />} label="Notebooks" onClick={() => navigate("/notebooks")} />
          <NavButton active={route === "/dw"} icon={<Globe2 size={18} />} label="DW" onClick={() => navigate("/dw")} />
          <NavButton active={route === "/import"} icon={<FileUp size={18} />} label="Import" onClick={() => navigate("/import")} />
          <NavButton active={route === "/settings"} icon={<SettingsIcon size={18} />} label="Settings" onClick={() => navigate("/settings")} />
        </nav>
      </aside>

      <main className="main-content">
        {route === "/" && <Dashboard state={state} refresh={refresh} navigate={navigate} />}
        {route === "/review" && <ReviewSession mode="words" state={state} refresh={refresh} navigate={navigate} />}
        {route === "/articles" && <ReviewSession mode="articles" state={state} refresh={refresh} navigate={navigate} />}
        {route === "/dw" && <DWSourceBrowser state={state} refresh={refresh} />}
        {route === "/words" && <WordsPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/words/new" && <NewWordPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/notebooks" && <NotebooksPage state={state} refresh={refresh} />}
        {route === "/import" && <ImportPage state={state} refresh={refresh} navigate={navigate} />}
        {route === "/settings" && <SettingsPage state={state} refresh={refresh} />}
      </main>
    </div>
  );
}
