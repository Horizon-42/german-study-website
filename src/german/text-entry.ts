export type GermanKeyboardLayoutLabel = "Layout guide" | "QWERTZ detected";

export type KeyboardLayoutReader = {
  getLayoutMap?: () => Promise<Map<string, string>>;
};

export type PreferenceStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type TextSelection = {
  start?: number | null;
  end?: number | null;
};

export type TextInsertion = {
  value: string;
  cursor: number;
};

export const germanSpecialCharacters = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"] as const;

export const englishKeyboardHints = [
  { char: "ä", mac: "Option+U, then A", windows: "Alt+0228", international: '" then A' },
  { char: "ö", mac: "Option+U, then O", windows: "Alt+0246", international: '" then O' },
  { char: "ü", mac: "Option+U, then U", windows: "Alt+0252", international: '" then U' },
  { char: "ß", mac: "Option+S", windows: "Alt+0223", international: "AltGr+S" },
] as const;

const keyboardHelperVisibilityKey = "german-study.keyboard-helper-visible";

export async function detectGermanKeyboardLayout(
  keyboard: KeyboardLayoutReader | undefined = browserKeyboardLayoutReader(),
): Promise<GermanKeyboardLayoutLabel> {
  try {
    const layoutMap = await keyboard?.getLayoutMap?.();
    if (!layoutMap) {
      return "Layout guide";
    }

    const keyY = layoutMap.get("KeyY")?.toLowerCase();
    const keyZ = layoutMap.get("KeyZ")?.toLowerCase();
    return keyY === "z" && keyZ === "y" ? "QWERTZ detected" : "Layout guide";
  } catch {
    return "Layout guide";
  }
}

export function insertTextAtSelection(
  value: string,
  text: string,
  selection: TextSelection = {},
): TextInsertion {
  const start = clampSelection(selection.start ?? value.length, value.length);
  const end = clampSelection(selection.end ?? start, value.length);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const nextValue = `${value.slice(0, from)}${text}${value.slice(to)}`;
  const cursor = from + text.length;

  return { value: nextValue, cursor };
}

export function readGermanKeyboardHelperVisibility(
  store: PreferenceStore | undefined = browserPreferenceStore(),
): boolean {
  try {
    return store?.getItem(keyboardHelperVisibilityKey) !== "false";
  } catch {
    return true;
  }
}

export function writeGermanKeyboardHelperVisibility(
  visible: boolean,
  store: PreferenceStore | undefined = browserPreferenceStore(),
): void {
  try {
    store?.setItem(keyboardHelperVisibilityKey, visible ? "true" : "false");
  } catch {
    // Local storage can be unavailable in private or restricted browser modes.
  }
}

function browserKeyboardLayoutReader(): KeyboardLayoutReader | undefined {
  const maybeNavigator = globalThis.navigator as Navigator & {
    keyboard?: KeyboardLayoutReader;
  };

  return maybeNavigator.keyboard;
}

function browserPreferenceStore(): PreferenceStore | undefined {
  return globalThis.localStorage;
}

function clampSelection(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}
