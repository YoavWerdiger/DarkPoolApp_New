/** React Query — פרופילים, גרפים, מחירי Yahoo יומיים (אותה סדרה יומית לכל היום). */

/** uw-investor-profile / uw-fund-profile / holdings DB — ממומש בשרת */
export const PROFILE_QUERY_STALE_MS = 6 * 60 * 60 * 1000;

/** close יומי — לא משתנה בתוך יום מסחר */
export const CHART_DAILY_CLOSES_STALE_MS = 24 * 60 * 60 * 1000;

export const PROFILE_QUERY_GC_MS = 7 * 24 * 60 * 60 * 1000;
