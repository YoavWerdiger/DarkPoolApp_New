/**
 * ציפי סינון מתחת ל-«עסקאות אחרונות» בפיד הבית.
 * הכל = קונגרס + Form 4. לא ממציאים עסקאות.
 */

export type FeedRecentKind = 'all' | 'congress' | 'insider';

/** מזהה שורה בפיד הממוזג — אותם discriminators כמו ב-Home. */
export type FeedRecentRowKind = 'congress' | 'insider';

export const FEED_RECENT_KIND_DEFAULT: FeedRecentKind = 'all';

export const FEED_RECENT_KIND_CHIPS: { id: FeedRecentKind; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'congress', label: 'קונגרס' },
  { id: 'insider', label: 'בכירים' },
];

export function matchesFeedRecentKind(
  rowKind: FeedRecentRowKind,
  filter: FeedRecentKind = FEED_RECENT_KIND_DEFAULT
): boolean {
  if (filter === 'all') return true;
  return rowKind === filter;
}
