-- פרטי יומן מסחר פר-טרייד (מסגרת זמן, רגש, תוכנית, אסטרטגיה, סיבות, טעויות)
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS journal_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trades.journal_details IS 'JSON: timeframe, mood_before/after, followed_plan, strategy_type, entry_reason, exit_reason, mistakes[]';
