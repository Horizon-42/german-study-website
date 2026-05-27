import { useMemo } from "react";
import { BookOpen, CalendarDays, Play, Plus } from "lucide-react";
import { filterEntriesForNotebook, notebookCounts } from "../../study/notebook-focus";
import {
  buildStats,
  buildStudyQueue,
  directionLabel,
  displayGerman,
  formatDue,
  isDue,
} from "../../study/session-planner";
import type { StudyState } from "../../types/vocab";
import type { Route } from "../route-types";
import { EmptyState, FocusNotebookSelect, Metric, notebookFocusName } from "../shared";

export function Dashboard({
  state,
  refresh,
  navigate,
}: {
  state: StudyState;
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const stats = useMemo(() => buildStats(state), [state]);
  const queueOptions = {
    notebookId: state.settings.focusNotebookId,
    notebookEntries: state.notebookEntries,
  };
  const queue = useMemo(
    () => buildStudyQueue(state.cards, state.settings, "words", queueOptions),
    [state.cards, state.settings, state.notebookEntries],
  );
  const articleQueue = useMemo(
    () => buildStudyQueue(state.cards, state.settings, "articles", queueOptions),
    [state.cards, state.settings, state.notebookEntries],
  );
  const focusedEntries = useMemo(
    () => filterEntriesForNotebook(state.entries, state.notebookEntries, state.settings.focusNotebookId),
    [state.entries, state.notebookEntries, state.settings.focusNotebookId],
  );
  const notebookStats = useMemo(
    () => notebookCounts(state.notebooks, state.entries, state.cards, state.notebookEntries, (card) => isDue(card)),
    [state.notebooks, state.entries, state.cards, state.notebookEntries],
  );
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    focusedEntries.forEach((entry) => counts.set(entry.topic ?? "General", (counts.get(entry.topic ?? "General") ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [focusedEntries]);
  const focusName = notebookFocusName(state);

  return (
    <section className="view-grid">
      <header className="view-header">
        <div>
          <p className="eyebrow">Today</p>
          <h1>{focusName} words ready for recall</h1>
        </div>
        <div className="view-actions">
          <FocusNotebookSelect state={state} refresh={refresh} />
          <button className="primary-action" disabled={queue.length === 0} onClick={() => navigate("/review")}>
            <Play size={18} />
            Start review
          </button>
        </div>
      </header>

      <div className="metric-grid">
        <Metric label="Due cards" value={stats.dueCards} tone="ink" />
        <Metric label="Article cards" value={articleQueue.length} tone="green" />
        <Metric label="Studied today" value={stats.studiedToday} tone="blue" />
        <Metric label="Streak" value={`${stats.streak}d`} tone="amber" />
      </div>

      <div className="dashboard-layout">
        <section className="panel study-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Next session</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          {queue.length === 0 ? (
            <EmptyState title="All clear" body="Add new words or come back when more cards are due." />
          ) : (
            <div className="queue-list">
              {queue.slice(0, 8).map((card) => {
                const entry = state.entries.find((item) => item.id === card.vocabEntryId);
                return entry ? (
                  <div className="queue-row" key={card.id}>
                    <span className={`state-dot state-${card.state}`} />
                    <div>
                      <strong>{displayGerman(entry)}</strong>
                      <span>{directionLabel(card.direction)} · {entry.topic ?? "General"}</span>
                    </div>
                    <time>{formatDue(card.dueAt)}</time>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Topics</h2>
            </div>
            <button className="icon-button" aria-label="Add word" title="Add word" onClick={() => navigate("/words/new")}>
              <Plus size={18} />
            </button>
          </div>
          <div className="topic-list">
            {topics.map((topic) => (
              <div className="topic-row" key={topic.name}>
                <span>{topic.name}</span>
                <strong>{topic.count}</strong>
              </div>
            ))}
          </div>
          <button className="secondary-action wide-action article-shortcut" disabled={articleQueue.length === 0} onClick={() => navigate("/articles")}>
            <CalendarDays size={18} />
            Practice articles
          </button>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Notebooks</p>
              <h2>Study focus</h2>
            </div>
            <button className="icon-button" aria-label="Manage notebooks" title="Manage notebooks" onClick={() => navigate("/notebooks")}>
              <BookOpen size={18} />
            </button>
          </div>
          <div className="topic-list">
            {notebookStats.slice(0, 6).map((item) => (
              <div className="topic-row" key={item.notebook.id}>
                <span>{item.notebook.name}</span>
                <strong>{item.dueCardCount}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
