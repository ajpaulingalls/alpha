export type ExpiryCategory =
  | "breaking"
  | "current"
  | "background"
  | "evergreen";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CATEGORY_TTL: Record<ExpiryCategory, number> = {
  breaking: 1 * HOUR_MS,
  current: 6 * HOUR_MS,
  background: 7 * DAY_MS,
  evergreen: 30 * DAY_MS,
};

const BREAKING_KEYWORDS = [
  "breaking",
  "just in",
  "developing",
  "urgent",
  "live updates",
];

const CURRENT_KEYWORDS = [
  "today",
  "latest",
  "this week",
  "election",
  "vote",
  "summit",
  "ceasefire",
  "talks",
  "deal",
];

const BACKGROUND_KEYWORDS = [
  "conflict",
  "crisis",
  "war",
  "climate",
  "economy",
  "history",
  "explained",
  "overview",
];

function textContainsAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

export function classifyContent(
  query: string,
  context: string,
): ExpiryCategory {
  const combined = `${query} ${context}`.toLowerCase();

  if (textContainsAny(combined, BREAKING_KEYWORDS)) return "breaking";
  if (textContainsAny(combined, CURRENT_KEYWORDS)) return "current";
  if (textContainsAny(combined, BACKGROUND_KEYWORDS)) return "background";
  return "evergreen";
}

export function getExpiresAt(category: ExpiryCategory): Date {
  return new Date(Date.now() + CATEGORY_TTL[category]);
}

export function computeExpiry(query: string, context: string): Date {
  return getExpiresAt(classifyContent(query, context));
}
