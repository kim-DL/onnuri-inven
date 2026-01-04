const ZONE_KEYWORDS = ["냉동1", "냉동2", "냉장", "상온"] as const;

export type ZoneKeyword = (typeof ZONE_KEYWORDS)[number];

export function parseSearchTokens(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function extractZoneOverride(tokens: string[]): ZoneKeyword | null {
  for (const token of tokens) {
    if (ZONE_KEYWORDS.includes(token as ZoneKeyword)) {
      return token as ZoneKeyword;
    }
  }

  return null;
}

export function tokensMatchText(
  text: string,
  tokens: string[],
): boolean {
  const haystack = text.toLowerCase();

  return tokens.every((token) => haystack.includes(token.toLowerCase()));
}

export { ZONE_KEYWORDS };
