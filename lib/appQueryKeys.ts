import type { CourseListParams } from '../types/learning';

/** מפתחות cache גלובליים — משותפים ל-prefetch, hooks ו-persist */
export const appQueryKeys = {
  // market / learning / chat
  fearGreed: ['market', 'fearGreed'] as const,
  courses: (params?: CourseListParams) =>
    ['learning', 'courses', params ?? null] as const,
  chatGroups: (userId: string) => ['chat', 'groups', userId] as const,
  chatMessages: (groupId: string) => ['chat', 'messages', groupId] as const,

  // DarkPool / Unusual Whales — list-type (נשמרים לדיסק)
  uwExplore: ['uw', 'explore'] as const,
  uwSignals: ['uw', 'signals'] as const,
  featuredProfiles: ['uw', 'featured'] as const,
  darkPoolFeed: (isPremium: boolean) => ['darkpool', 'feed', isPremium] as const,
  congressFeed: (limit: number) => ['darkpool', 'congress', limit] as const,
  insiderFeed: (tab: string, isPremium: boolean, limit?: number) =>
    ['darkpool', 'insider', tab, isPremium, limit ?? null] as const,
  followingFeed: ['darkpool', 'following'] as const,
  followedInvestors: ['darkpool', 'followed'] as const,

  // DarkPool / UW — per-entity (cache בזיכרון בלבד, לא נשמר לדיסק)
  investorProfile: (id: string, kind: string, ticker?: string) =>
    ['uw', 'investorProfile', id, kind, ticker ?? null] as const,
  fundProfile: (cik: string) => ['uw', 'fundProfile', cik] as const,
  politicianMetrics: (id: string) => ['uw', 'politicianMetrics', id] as const,
  tickerInsights: (ticker: string) => ['uw', 'tickerInsights', ticker] as const,
  darkPoolTicker: (ticker: string, isPremium: boolean) =>
    ['darkpool', 'ticker', ticker, isPremium] as const,

  // News
  newsList: (filtersKey: string) => ['news', 'list', filtersKey] as const,
  earningsList: (paramsKey: string) => ['news', 'earnings', paramsKey] as const,

  // User entitlements (cache בזיכרון בלבד — לא נשמר לדיסק כדי לא להציג הרשאה ישנה)
  userSubscription: (userId: string) => ['user', 'subscription', userId] as const,
  userIsAdmin: (userId: string) => ['user', 'isAdmin', userId] as const,

  // Portfolios / Stories
  portfolios: ['portfolios', 'list'] as const,
  storiesUsers: ['stories', 'users'] as const,

  // Economic calendar / Journal trades
  economicEvents: ['economic', 'events'] as const,
  trades: (userId: string) => ['trades', 'list', userId] as const,
};
