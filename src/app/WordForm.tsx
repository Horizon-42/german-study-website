import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  GermanKeyboardGuideToggle,
  GermanKeyboardHelper,
} from "../german/GermanKeyboardHelper";
import {
  detectGermanKeyboardLayout,
  insertTextAtSelection,
  readGermanKeyboardHelperVisibility,
  writeGermanKeyboardHelperVisibility,
  type GermanKeyboardLayoutLabel,
} from "../german/text-entry";
import {
  normalizeVocabularyDraft,
  validateVocabularyDraft,
} from "../vocabulary/authoring";
import {
  draftFromVocabulary,
  levelOptions,
  partOfSpeechOptions,
} from "../vocabulary/schema";
import type { Level, PartOfSpeech, VocabDraft, VocabEntry } from "../types/vocab";

export function WordForm({
  initial,
  submitLabel,
  resetOnSubmit = false,
  onSubmit,
}: {
  initial: VocabDraft | VocabEntry;
  submitLabel: string;
  resetOnSubmit?: boolean;
  onSubmit: (draft: VocabDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<VocabDraft>(() => draftFromVocabulary(initial));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [activeGermanField, setActiveGermanField] = useState<"german" | "exampleGerman">("german");
  const [showKeyboardHelper, setShowKeyboardHelper] = useState(readGermanKeyboardHelperVisibility);
  const [keyboardLayout, setKeyboardLayout] = useState<GermanKeyboardLayoutLabel>("Layout guide");
  const germanInputRef = useRef<HTMLInputElement>(null);
  const germanExampleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(draftFromVocabulary(initial));
    setFormError("");
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    void detectGermanKeyboardLayout().then((layout) => {
      if (!cancelled) {
        setKeyboardLayout(layout);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedDraft = normalizeVocabularyDraft(draft);
    const [validationError] = validateVocabularyDraft(normalizedDraft);

    if (validationError) {
      setFormError(validationError.message);
      return;
    }

    setFormError("");
    setSaving(true);
    await onSubmit(normalizedDraft);
    if (resetOnSubmit) {
      setDraft(draftFromVocabulary(initial));
    }
    setSaving(false);
  }

  function insertGermanCharacter(field: "german" | "exampleGerman", character: string) {
    const input = field === "german" ? germanInputRef.current : germanExampleInputRef.current;
    const currentValue = draft[field] ?? "";
    const insertion = insertTextAtSelection(currentValue, character, {
      start: input?.selectionStart,
      end: input?.selectionEnd,
    });

    setDraft({ ...draft, [field]: insertion.value });
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(insertion.cursor, insertion.cursor);
    });
  }

  function updateKeyboardHelperVisibility(visible: boolean) {
    setShowKeyboardHelper(visible);
    writeGermanKeyboardHelperVisibility(visible);
  }

  return (
    <form className="word-form" onSubmit={(event) => void submit(event)}>
      <div className="german-input-group wide-field">
        <label>
          <span>German</span>
          <input
            ref={germanInputRef}
            required
            value={draft.german}
            onChange={(event) => setDraft({ ...draft, german: event.target.value })}
            onFocus={() => setActiveGermanField("german")}
          />
        </label>
        {showKeyboardHelper && activeGermanField === "german" && (
          <GermanKeyboardHelper
            layoutLabel={keyboardLayout}
            onClose={() => updateKeyboardHelperVisibility(false)}
            onInsert={(character) => insertGermanCharacter("german", character)}
          />
        )}
        {!showKeyboardHelper && (
          <GermanKeyboardGuideToggle onClick={() => updateKeyboardHelperVisibility(true)} />
        )}
      </div>
      <label>
        <span>English</span>
        <input required value={draft.english} onChange={(event) => setDraft({ ...draft, english: event.target.value })} />
      </label>
      <label>
        <span>Part of speech</span>
        <select value={draft.partOfSpeech} onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value as PartOfSpeech })}>
          {partOfSpeechOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Article</span>
        <select required={draft.partOfSpeech === "noun"} value={draft.article ?? ""} onChange={(event) => setDraft({ ...draft, article: event.target.value ? event.target.value as VocabDraft["article"] : undefined })}>
          <option value="">None</option>
          <option value="der">der</option>
          <option value="die">die</option>
          <option value="das">das</option>
        </select>
      </label>
      <label>
        <span>Plural</span>
        <input value={draft.plural ?? ""} onChange={(event) => setDraft({ ...draft, plural: event.target.value })} />
      </label>
      <label>
        <span>Level</span>
        <select value={draft.level ?? "A1"} onChange={(event) => setDraft({ ...draft, level: event.target.value as Level })}>
          {levelOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Topic</span>
        <input value={draft.topic ?? ""} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} />
      </label>
      <label>
        <span>Source</span>
        <input value={draft.sourceName ?? ""} onChange={(event) => setDraft({ ...draft, sourceName: event.target.value })} />
      </label>
      <label className="wide-field">
        <span>Source URL</span>
        <input type="url" value={draft.sourceUrl ?? ""} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} />
      </label>
      <label className="wide-field">
        <span>German example</span>
        <input
          ref={germanExampleInputRef}
          value={draft.exampleGerman ?? ""}
          onChange={(event) => setDraft({ ...draft, exampleGerman: event.target.value })}
          onFocus={() => setActiveGermanField("exampleGerman")}
        />
      </label>
      {showKeyboardHelper && activeGermanField === "exampleGerman" && (
        <GermanKeyboardHelper
          className="wide-field"
          layoutLabel={keyboardLayout}
          onClose={() => updateKeyboardHelperVisibility(false)}
          onInsert={(character) => insertGermanCharacter("exampleGerman", character)}
        />
      )}
      <label className="wide-field">
        <span>English example</span>
        <input value={draft.exampleEnglish ?? ""} onChange={(event) => setDraft({ ...draft, exampleEnglish: event.target.value })} />
      </label>
      <label className="wide-field">
        <span>Notes</span>
        <textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </label>
      {formError && <p className="error-text wide-field">{formError}</p>}
      <button className="primary-action form-submit" disabled={saving}>
        <Plus size={18} />
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
