import { Keyboard, X } from "lucide-react";
import { englishKeyboardHints, germanSpecialCharacters } from "./text-entry";
import type { GermanKeyboardLayoutLabel } from "./text-entry";

export function GermanKeyboardGuideToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="keyboard-helper-toggle"
      type="button"
      onClick={onClick}
    >
      <Keyboard size={16} />
      Show German keyboard guide
    </button>
  );
}

export function GermanKeyboardHelper({
  className = "",
  layoutLabel,
  onClose,
  onInsert,
}: {
  className?: string;
  layoutLabel: GermanKeyboardLayoutLabel;
  onClose: () => void;
  onInsert: (character: string) => void;
}) {
  return (
    <aside className={`keyboard-helper ${className}`} aria-label="German keyboard helper">
      <div className="keyboard-helper-header">
        <div className="keyboard-helper-title">
          <strong>German keyboard guide</strong>
          <span>{layoutLabel}</span>
        </div>
        <button className="keyboard-helper-close" type="button" aria-label="Hide German keyboard guide" title="Hide guide" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="keyboard-helper-section">
        <span className="keyboard-helper-label">German layout differences</span>
        <div className="keyboard-chip-row">
          <span className="keyboard-chip">Y ↔ Z</span>
          {germanSpecialCharacters.map((character) => (
            <button
              key={character}
              className="keyboard-chip keyboard-chip-button"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsert(character)}
            >
              {character}
            </button>
          ))}
          <span className="keyboard-chip">@ AltGr+Q</span>
          <span className="keyboard-chip">€ AltGr+E</span>
        </div>
      </div>
      <div className="keyboard-helper-section">
        <span className="keyboard-helper-label">On an English keyboard</span>
        <div className="keyboard-method-grid">
          {englishKeyboardHints.map((hint) => (
            <div className="keyboard-method" key={hint.char}>
              <strong>{hint.char}</strong>
              <span>Mac: {hint.mac}</span>
              <span>Windows: {hint.windows}</span>
              <span>US-Intl: {hint.international}</span>
            </div>
          ))}
        </div>
        <p className="keyboard-helper-note">
          Windows Alt codes need the numeric keypad. US-International uses dead keys: press <kbd>"</kbd>,
          then the vowel.
        </p>
      </div>
    </aside>
  );
}
