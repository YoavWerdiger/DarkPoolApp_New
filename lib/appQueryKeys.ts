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
  /** פס אנשים במסך בית אינסיידרים */
  uwExploreHomeStrip: ['uw', 'explore', 'home-strip-v2'] as const,
  uwSignals: ['uw', 'signals'] as const,
  featuredProfiles: ['uw', 'featured'] as const,
  darkPoolFeed: (isPremium: boolean) => ['darkpool', 'feed', isPremium] as const,
  /**
   * ציטוטי מחיר חי לפיד — cache נפרד מהשורות.
   * First paint קורא מכאן כדי שלא ייעלם «מחיר חי» כשהפיד חוזר בלי quotes.
   * Prefix `darkpool/feed` נשמר לדיסק ב-queryPersist.
   */
  feedQuotes: ['darkpool', 'feed', 'quotes'] as const,
  /** in-flight בלבד — לא תחת prefix שנשמר, כדי שלא יישאר pulse אחרי cold start */
  feedQuotesPending: ['darkpool', 'quotes', 'pending'] as const,
  congressFeed: (limit: number) => ['darkpool', 'congress', limit] as const,
  /** "פעילות אחרונה" במסך פרטי עסקה — אותו אדם, אותו טיקר */
  congressPersonTickerTrades: (politicianId: string, ticker: string) =>
    ['darkpool', 'congress', 'person-ticker', politicianId, ticker] as const,
  /** "פעילות אחרונה" במסך פרטי עסקת בכיר — אותו שם Form 4, אותו טיקר */
  insiderPersonTickerTrades: (insiderName: string, ticker: string) =>
    ['darkpool', 'insider', 'person-ticker', insiderName, ticker] as const,
  insiderFeed: (tab: string, isPremium: boolean, limit?: number) =>
    ['darkpool', 'insider', tab, isPremium, limit ?? null] as const,
  followingFeed: ['darkpool', 'following'] as const,
  followedInvestors: ['darkpool', 'followed'] as const,
  exploreFollowCounts: ['darkpool', 'explore', 'follow-counts'] as const,
  exploreExcessLeaders: ['darkpool', 'explore', 'excess-leaders'] as const,
  exploreRecentlyActive: ['darkpool', 'explore', 'recently-active'] as const,
  exploreDiscoveryExtras: ['darkpool', 'explore', 'discovery-extras'] as const,
  congressPersonStats: (politicianId: string) =>
    ['darkpool', 'congress', 'person-stats', politicianId] as const,
  congressHoldingsByBioguide: (bioguideId: string) =>
    ['darkpool', 'congress', 'holdings', bioguideId] as const,
  congressHoldingsByTicker: (ticker: string) =>
    ['darkpool', 'congress', 'holdings-by-ticker', ticker] as const,
  congressTradesByTicker: (ticker: string) =>
    ['darkpool', 'congress', 'ticker-trades', ticker] as const,
  /** פתיחה יומית ליום ביצוע — «מאז העסקה» כשאין PriceChange */
  congressTradeOpen: (ticker: string, transactionDate: string) =>
    ['darkpool', 'congress', 'trade-open', ticker, transactionDate] as const,
  congressTickerDailyBars: (ticker: string) =>
    ['darkpool', 'congress', 'daily-bars', ticker] as const,
  tickerInsiderBuys: (ticker: string) =>
    ['darkpool', 'ticker', ticker, 'insider-buys'] as const,
  tickerQuote: (ticker: string) => ['darkpool', 'ticker', ticker, 'quote'] as const,
  tickerHistory: (ticker: string, range = '10y', interval = '1d') =>
    ['darkpool', 'ticker', ticker, 'history', range, interval] as const,
  congressPersonTrades: (politicianId: string) =>
    ['darkpool', 'congress', 'person-trades', politicianId] as const,
  congressBasketPrices: (bioguideId: string, tickersKey: string) =>
    ['darkpool', 'congress', 'basket-prices', bioguideId, tickersKey] as const,
  trumpNotionalPrices: (tickersKey: string) =>
    ['darkpool', 'trump', 'notional-prices', tickersKey] as const,
  insiderForm4Prices: (insiderName: string, tickersKey: string) =>
    ['darkpool', 'insider', 'form4-prices', insiderName, tickersKey] as const,
  insiderPersonTrades: (insiderName: string) =>
    ['darkpool', 'insider', 'person-trades', insiderName] as const,

  // DarkPool / UW — per-entity (cache בזיכרון בלבד, לא נשמר לדיסק)
  investorProfile: (id: string, kind: string, ticker?: string) =>
    ['uw', 'investorProfile', id, kind, ticker ?? null] as const,
  fundProfile: (cik: string) => ['uw', 'fundProfile', cik] as const,
  fundHoldingsHistory: (cik: string) =>
    ['uw', 'fundHoldingsHistory', cik] as const,
  fund13fPrices: (cik: string, tickersKey: string) =>
    ['uw', 'fund13fPrices', cik, tickersKey] as const,
  politicianMetrics: (id: string) => ['uw', 'politicianMetrics', id] as const,
  tickerInsights: (ticker: string) => ['uw', 'tickerInsights', ticker] as const,
  darkPoolTicker: (ticker: string, isPremium: boolean) =>
    ['darkpool', 'ticker', ticker, isPremium] as const,

  // News / community
  newsList: (filtersKey: string) => ['news', 'list', filtersKey] as const,
  earningsList: (paramsKey: string) => ['news', 'earnings', paramsKey] as const,
  /** פיד ציוצי קהילה (מיקרו-בלוג פנימי) — mode: for_you | following */
  tweetsList: (mode: 'for_you' | 'following' = 'for_you') =>
    ['community', 'posts', mode] as const,
  /** @deprecated העדף tweetsList() — נשמר לתאימות cache ישן */
  communityPostsList: ['community', 'posts'] as const,

  // User entitlements (cache בזיכרון בלבד — לא נשמר לדיסק כדי לא להציג הרשאה ישנה)
  userSubscription: (userId: string) => ['user', 'subscription', userId] as const,
  userPaymentHistory: (userId: string) => ['user', 'paymentHistory', userId] as const,
  userIsAdmin: (userId: string) => ['user', 'isAdmin', userId] as const,

  // Portfolios / Stories
  portfolios: ['portfolios', 'list'] as const,
  storiesUsers: ['stories', 'users'] as const,

  // Stock watchlists
  watchlists: ['watchlist', 'lists'] as const,
  watchlistItems: (watchlistId: string) =>
    ['watchlist', 'items', watchlistId] as const,
  watchlistQuotes: (symbolsKey: string) =>
    ['watchlist', 'quotes', symbolsKey] as const,
  watchlistInsights: (symbolsKey: string) =>
    ['watchlist', 'insights', symbolsKey] as const,
  watchlistRangeStats: (symbolsKey: string) =>
    ['watchlist', 'rangeStats', symbolsKey] as const,

  // Economic calendar / Journal trades
  economicEvents: ['economic', 'events'] as const,
  trades: (userId: string) => ['trades', 'list', userId] as const,
};
