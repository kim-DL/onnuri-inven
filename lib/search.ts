export const ZONE_KEYWORDS = ["냉동1", "냉동2", "냉장", "상온"] as const;

export function parseSearchTokens(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function tokensMatchText(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token.toLowerCase()));
}
