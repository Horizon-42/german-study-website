import { describe, expect, it } from "vitest";
import {
  copyworkPhraseFromRange,
  copyworkTermKey,
  tokenizeCopyworkSentence,
} from "./copywork";

describe("DW copywork helpers", () => {
  it("tokenizes German words without punctuation", () => {
    const tokens = tokenizeCopyworkSentence("Ich heiße Emma, komme aus Köln und höre zu.");

    expect(tokens.map((token) => token.text)).toEqual([
      "Ich",
      "heiße",
      "Emma",
      "komme",
      "aus",
      "Köln",
      "und",
      "höre",
      "zu",
    ]);
  });

  it("keeps hyphenated and apostrophe words as one token", () => {
    const tokens = tokenizeCopyworkSentence("E-Mail-Adressen und wie geht's?");

    expect(tokens.map((token) => token.text)).toEqual([
      "E-Mail-Adressen",
      "und",
      "wie",
      "geht's",
    ]);
  });

  it("builds a contiguous phrase from either range direction", () => {
    const tokens = tokenizeCopyworkSentence("Ich komme aus Berlin");

    expect(copyworkPhraseFromRange(tokens, 3, 1).map((token) => token.text)).toEqual([
      "komme",
      "aus",
      "Berlin",
    ]);
  });

  it("normalizes saved term keys", () => {
    expect(copyworkTermKey("  Ich   komme  ")).toBe("ich komme");
  });
});
