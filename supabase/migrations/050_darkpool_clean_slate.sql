-- איפוס מלא של נתוני Dark Pool — ללא mock / seed.
-- פרופילים מומלצים, מעקב משתמש ו-watchlist מתאפסים; ימולאו מחדש מסנכרון SEC / שימוש.

TRUNCATE TABLE
  public.dark_pool_alerts_log,
  public.dark_pool_signals,
  public.dark_pool_trades,
  public.dark_pool_daily_aggregates,
  public.dark_pool_insider_buys,
  public.dark_pool_insider_signals,
  public.dark_pool_congress_trades,
  public.dark_pool_uw_snapshots,
  public.dark_pool_fund_holdings,
  public.dark_pool_fund_managers,
  public.dark_pool_provider_state,
  public.dark_pool_featured_profiles,
  public.dark_pool_followed_investors,
  public.dark_pool_watchlists
RESTART IDENTITY CASCADE;

COMMENT ON TABLE public.dark_pool_featured_profiles IS
  'פרופילים מומלצים — ריק עד הוספה ידנית / sync-featured-profiles מנתונים אמיתיים';
