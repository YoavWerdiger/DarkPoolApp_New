/** הודעות גילוי — לעולם לא HTML / stack מ-API. */
export function formatExploreWarning(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/[<]|\bhtml\b|doctype/i.test(s)) return null;
  if (/quiver|unusualwhales|\/beta\/|\/api\//i.test(s)) {
    if (s.includes('429') || /rate limit/i.test(s)) {
      return 'מכסת API — מוצגים נתונים שמורים.';
    }
    return null;
  }
  if (s.length > 100) return `${s.slice(0, 97)}…`;
  return s;
}

export function sanitizeExploreWarnings(warnings?: string[]): string[] {
  if (!warnings?.length) return [];
  return warnings
    .map(formatExploreWarning)
    .filter((w): w is string => Boolean(w))
    .slice(0, 2);
}
