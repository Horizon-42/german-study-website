export type CopyworkToken = {
  id: string;
  text: string;
  index: number;
};

export function tokenizeCopyworkSentence(sentence: string): CopyworkToken[] {
  const matches = sentence.matchAll(/[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu);

  return Array.from(matches, (match, index) => ({
    id: `${index}-${match[0].toLowerCase()}`,
    text: match[0],
    index,
  }));
}

export function copyworkPhraseFromRange(
  tokens: CopyworkToken[],
  startIndex: number,
  endIndex: number,
): CopyworkToken[] {
  const [start, end] = startIndex <= endIndex
    ? [startIndex, endIndex]
    : [endIndex, startIndex];

  return tokens.filter((token) => token.index >= start && token.index <= end);
}

export function copyworkTermKey(german: string): string {
  return german.trim().replace(/\s+/g, " ").toLowerCase();
}
