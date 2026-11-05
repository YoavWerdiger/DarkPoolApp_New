import i18n from '../../../lib/i18n';
/**
 * ציפי סינון מתחת ל-«עסקאות אחרונות» בפיד הבית.
 * הכל = קונגרס + Form 4. לא ממציאים עסקאות.
 */

export type FeedRecentKind = 'all' | 'congress' | 'insider';

/** מזהה שורה בפיד הממוזג — אותם discriminators כמו ב-Home. */
export type FeedRecentRowKind = 'congress' | 'insider';

export const FEED_RECENT_KIND_DEFAULT: FeedRecentKind = 'all';

export const FEED_RECENT_KIND_CHIPS: { id: FeedRecentKind; label: string }[] = [
  { id: 'all', label: i18n.t('auto.screens__DarkPool__utils__feedRecentKind.s1') },
  { id: 'congress', label: i18n.t('auto.screens__DarkPool__utils__feedRecentKind.s2') },
  { id: 'insider', label: i18n.t('auto.screens__DarkPool__utils__feedRecentKind.s3') },
];

export function matchesFeedRecentKind(
  rowKind: FeedRecentRowKind,
  filter: FeedRecentKind = FEED_RECENT_KIND_DEFAULT
): boolean {
  if (filter === 'all') return true;
  return rowKind === filter;
}
