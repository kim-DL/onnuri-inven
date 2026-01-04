export const ZONE_KEYWORDS = ["냉동1", "냉동2", "냉장", "상온"] as const;

const ZONE_KEYWORD_SET = new Set(
  ZONE_KEYWORDS.map((keyword) => keyword.toLowerCase())
);

export function parseSearchTokens(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function extractZoneOverride(tokens: string[]): string | null {
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (ZONE_KEYWORD_SET.has(normalized)) {
      const match = ZONE_KEYWORDS.find(
        (keyword) => keyword.toLowerCase() === normalized
      );
      return match ?? null;
    }
  }
  return null;
}

export function tokensMatchText(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token.toLowerCase()));
}
