import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { reviewCard } from "../../data/db";
import { buildPrompt, buildStudyQueue, type ReviewMode } from "../../study/session-planner";
import type { Rating, StudyState } from "../../types/vocab";
import type { Route } from "../route-types";
import { Metric } from "../shared";

const ratingLabels: Record<Rating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export function ReviewSession({
  mode,
  state,
  refresh,
  navigate,
}: {
  mode: ReviewMode;
  state: StudyState;
  refresh: () => Promise<void>;
  navigate: (route: Route) => void;
}) {
  const [queueIds, setQueueIds] = useState(() => buildStudyQueue(state.cards, state.settings, mode, {
    notebookId: state.settings.focusNotebookId,
    notebookEntries: state.notebookEntries,
  }).map((card) => card.id));
  const [revealed, setRevealed] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [sessionRatings, setSessionRatings] = useState<Rating[]>([]);
  const [startedAt, setStartedAt] = useState(Date.now());
  const currentCard = state.cards.find((card) => card.id === queueIds[0]);
  const currentEntry = currentCard ? state.entries.find((entry) => entry.id === currentCard.vocabEntryId) : undefined;
  const prompt = currentCard && currentEntry ? buildPrompt(currentCard, currentEntry) : undefined;

  async function grade(rating: Rating) {
    if (!currentCard) {
      return;
    }

    await reviewCard(currentCard.id, rating, Date.now() - startedAt);
    setSessionRatings((ratings) => [...ratings, rating]);
    setQueueIds((ids) => ids.slice(1));
    setRevealed(false);
    setTypedAnswer("");
    setStartedAt(Date.now());
    await refresh();
  }

  if (!currentCard || !currentEntry || !prompt) {
    return (
      <section className="view-grid">
        <header className="view-header">
          <div>
            <p className="eyebrow">Session complete</p>
            <h1>{sessionRatings.length} cards reviewed</h1>
          </div>
          <button className="primary-action" onClick={() => navigate("/")}>
            <CheckCircle2 size={18} />
            Done
          </button>
        </header>
        <div className="metric-grid">
          {(["again", "hard", "good", "easy"] as Rating[]).map((rating) => (
            <Metric
              key={rating}
              label={ratingLabels[rating]}
              value={sessionRatings.filter((item) => item === rating).length}
              tone={rating === "again" ? "red" : rating === "easy" ? "green" : "ink"}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="review-layout">
      <header className="view-header">
        <div>
          <p className="eyebrow">{mode === "articles" ? "Article practice" : "Review"}</p>
          <h1>{queueIds.length} cards left</h1>
        </div>
        <button className="secondary-action" onClick={() => navigate("/")}>Exit</button>
      </header>

      <article className="review-card">
        <div className="prompt-meta">
          <span>{prompt.mode}</span>
          <span>{currentEntry.level ?? "A1"} · {currentEntry.topic ?? "General"}</span>
        </div>
        <h2>{prompt.prompt}</h2>
        {prompt.context && <p className="prompt-context">{prompt.context}</p>}
        <label className="answer-field">
          <span>Your answer</span>
          <input
            value={typedAnswer}
            onChange={(event) => setTypedAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setRevealed(true);
              }
            }}
            autoFocus
          />
        </label>
        {revealed ? (
          <div className="answer-reveal">
            <span>Answer</span>
            <strong>{prompt.answer}</strong>
            {prompt.detail && <p>{prompt.detail}</p>}
          </div>
        ) : (
          <button className="primary-action wide-action" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        )}
        <div className="grade-bar" aria-label="Grade recall">
          {(["again", "hard", "good", "easy"] as Rating[]).map((rating) => (
            <button key={rating} className={`grade-button grade-${rating}`} disabled={!revealed} onClick={() => void grade(rating)}>
              {ratingLabels[rating]}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
