import { describe, expect, it } from "vitest";
import {
  detectGermanKeyboardLayout,
  insertTextAtSelection,
  readGermanKeyboardHelperVisibility,
  writeGermanKeyboardHelperVisibility,
} from "./text-entry";
import type { PreferenceStore } from "./text-entry";

describe("German text entry", () => {
  it("detects a QWERTZ keyboard layout", async () => {
    await expect(detectGermanKeyboardLayout({
      getLayoutMap: async () => new Map([
        ["KeyY", "z"],
        ["KeyZ", "y"],
      ]),
    })).resolves.toBe("QWERTZ detected");
  });

  it("falls back to a layout guide when layout detection is unavailable", async () => {
    await expect(detectGermanKeyboardLayout(undefined)).resolves.toBe("Layout guide");
    await expect(detectGermanKeyboardLayout({
      getLayoutMap: async () => {
        throw new Error("permission denied");
      },
    })).resolves.toBe("Layout guide");
  });

  it("inserts text at the current selection", () => {
    expect(insertTextAtSelection("schon", "ö", { start: 3, end: 4 })).toEqual({
      value: "schön",
      cursor: 4,
    });
  });

  it("inserts at the end when no selection exists", () => {
    expect(insertTextAtSelection("gru", "ß")).toEqual({
      value: "gruß",
      cursor: 4,
    });
  });

  it("clamps invalid selection ranges", () => {
    expect(insertTextAtSelection("Haus", "ä", { start: -10, end: 99 })).toEqual({
      value: "ä",
      cursor: 1,
    });
  });

  it("reads and writes helper visibility through a preference store", () => {
    const store = memoryPreferenceStore();

    expect(readGermanKeyboardHelperVisibility(store)).toBe(true);
    writeGermanKeyboardHelperVisibility(false, store);
    expect(readGermanKeyboardHelperVisibility(store)).toBe(false);
    writeGermanKeyboardHelperVisibility(true, store);
    expect(readGermanKeyboardHelperVisibility(store)).toBe(true);
  });

  it("keeps the helper visible when preference storage fails", () => {
    const failingStore: PreferenceStore = {
      getItem: () => {
        throw new Error("no storage");
      },
      setItem: () => {
        throw new Error("no storage");
      },
    };

    expect(readGermanKeyboardHelperVisibility(failingStore)).toBe(true);
    expect(() => writeGermanKeyboardHelperVisibility(false, failingStore)).not.toThrow();
  });
});

function memoryPreferenceStore(): PreferenceStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
