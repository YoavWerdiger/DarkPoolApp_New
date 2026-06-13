-- ============================================================================
-- 013_portfolios.sql
-- תיקי השקעות (Portfolios) – זהה לפיצ'ר של TradingView
--
-- טבלאות:
--   1. portfolios               – הגדרת התיק
--   2. portfolio_transactions   – טרנזקציות (buy/sell/deposit/withdrawal/fee/dividend)
--   3. portfolio_price_cache    – cache למחירים (last + close היסטורי)
--   4. portfolio_value_history  – snapshot יומי של שווי התיק (לגרף Performance)
--
-- Views (חישובים):
--   v_portfolio_holdings        – פוזיציות פתוחות (FIFO) לפי תיק
--   v_portfolio_summary         – Cash, Value, Invested, Unrealized/Realized gain
--
-- כל הטבלאות מוגנות ב-RLS – משתמש רואה רק את התיקים שלו.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. portfolios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  currency            TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) BETWEEN 3 AND 6),
  risk_free_rate      NUMERIC(8,4) NOT NULL DEFAULT 4.0000,
  benchmark_symbol    TEXT NOT NULL DEFAULT 'SPY',
  auto_adjust_splits  BOOLEAN NOT NULL DEFAULT TRUE,
  description         TEXT CHECK (description IS NULL OR length(description) <= 1200),
  is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id
  ON public.portfolios(user_id)
  WHERE is_archived = FALSE;

COMMENT ON TABLE public.portfolios IS 'תיקי השקעות של משתמשים - זהה ל-TradingView Portfolios';
COMMENT ON COLUMN public.portfolios.risk_free_rate IS 'באחוזים שנתיים, לחישוב Sharpe/Sortino';
COMMENT ON COLUMN public.portfolios.benchmark_symbol IS 'סימבול מדד השוואה (SPY/QQQ/IWM/BTC/TA35)';

-- ----------------------------------------------------------------------------
-- 2. portfolio_transactions
--   types:
--     buy / sell                – הוספה/הפחתה של נכס
--     deposit / withdrawal      – תזרים מזומנים
--     fee                       – מסים ועמלות
--     dividend                  – דיבידנד
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('buy','sell','deposit','withdrawal','fee','dividend')),

  -- שדות לעסקאות נכס (buy/sell/dividend)
  symbol        TEXT,
  asset_type    TEXT CHECK (asset_type IS NULL OR asset_type IN ('stock','etf','fund','forex','crypto')),
  exchange      TEXT,
  quantity      NUMERIC(20,8),
  price         NUMERIC(20,8),
  commission    NUMERIC(20,8) DEFAULT 0,

  -- שדות לעסקאות מזומן (deposit/withdrawal/fee)
  amount        NUMERIC(20,8),

  -- אופציונלי
  currency      TEXT NOT NULL DEFAULT 'USD',
  date          TIMESTAMPTZ NOT NULL,
  notes         TEXT CHECK (notes IS NULL OR length(notes) <= 128),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validations:
  CONSTRAINT portfolio_tx_asset_fields_check CHECK (
    (type IN ('buy','sell','dividend') AND symbol IS NOT NULL)
    OR type IN ('deposit','withdrawal','fee')
  ),
  CONSTRAINT portfolio_tx_buysell_qty_price_check CHECK (
    type NOT IN ('buy','sell')
    OR (quantity IS NOT NULL AND quantity > 0 AND price IS NOT NULL AND price >= 0)
  ),
  CONSTRAINT portfolio_tx_cash_amount_check CHECK (
    type NOT IN ('deposit','withdrawal','fee')
    OR (amount IS NOT NULL AND amount >= 0)
  ),
  CONSTRAINT portfolio_tx_dividend_amount_check CHECK (
    type <> 'dividend'
    OR (amount IS NOT NULL AND amount >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_portfolio_tx_portfolio_id
  ON public.portfolio_transactions(portfolio_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_tx_user_id
  ON public.portfolio_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_tx_symbol
  ON public.portfolio_transactions(portfolio_id, symbol)
  WHERE symbol IS NOT NULL;

COMMENT ON TABLE public.portfolio_transactions IS 'כל עסקת תיק: רכישה/מכירה/הפקדה/משיכה/עמלה/דיבידנד';

-- ----------------------------------------------------------------------------
-- 3. portfolio_price_cache
--   cache למחירים שוטפים והיסטוריים (משותף לכל המשתמשים, public read).
--   key: (symbol, date) - כאשר date='current' זה quote שוטף.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_price_cache (
  symbol         TEXT NOT NULL,
  as_of          TIMESTAMPTZ NOT NULL,
  price          NUMERIC(20,8) NOT NULL,
  previous_close NUMERIC(20,8),
  currency       TEXT NOT NULL DEFAULT 'USD',
  source         TEXT NOT NULL DEFAULT 'finnhub',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, as_of)
);

CREATE INDEX IF NOT EXISTS idx_price_cache_symbol_recent
  ON public.portfolio_price_cache(symbol, as_of DESC);

COMMENT ON TABLE public.portfolio_price_cache IS 'cache למחירי מניות לחישובי תיק';

-- ----------------------------------------------------------------------------
-- 4. portfolio_value_history
--   snapshot יומי של שווי התיק (לגרף Performance vs benchmark)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_value_history (
  portfolio_id   UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  total_value    NUMERIC(20,8) NOT NULL,
  cash           NUMERIC(20,8) NOT NULL,
  invested       NUMERIC(20,8) NOT NULL,
  unrealized     NUMERIC(20,8) NOT NULL,
  realized       NUMERIC(20,8) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_value_history_portfolio
  ON public.portfolio_value_history(portfolio_id, date DESC);

COMMENT ON TABLE public.portfolio_value_history IS 'snapshot יומי של שווי התיק לגרף ביצועים';

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_portfolio()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portfolios_updated_at ON public.portfolios;
CREATE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_portfolio();

DROP TRIGGER IF EXISTS trg_portfolio_tx_updated_at ON public.portfolio_transactions;
CREATE TRIGGER trg_portfolio_tx_updated_at
  BEFORE UPDATE ON public.portfolio_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_portfolio();

-- ============================================================================
-- VIEW: v_portfolio_cash_flow
--   סיכום של זרימת המזומן בתיק (deposits - withdrawals - fees - buys + sells + dividends)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_portfolio_cash_flow AS
SELECT
  pt.portfolio_id,
  pt.user_id,
  COALESCE(SUM(CASE WHEN pt.type = 'deposit'    THEN pt.amount ELSE 0 END), 0) AS total_deposits,
  COALESCE(SUM(CASE WHEN pt.type = 'withdrawal' THEN pt.amount ELSE 0 END), 0) AS total_withdrawals,
  COALESCE(SUM(CASE WHEN pt.type = 'fee'        THEN pt.amount ELSE 0 END), 0) AS total_fees,
  COALESCE(SUM(CASE WHEN pt.type = 'buy'  THEN (pt.quantity * pt.price) + COALESCE(pt.commission, 0) ELSE 0 END), 0) AS total_buys,
  COALESCE(SUM(CASE WHEN pt.type = 'sell' THEN (pt.quantity * pt.price) - COALESCE(pt.commission, 0) ELSE 0 END), 0) AS total_sells,
  COALESCE(SUM(CASE WHEN pt.type = 'dividend' THEN pt.amount ELSE 0 END), 0) AS total_dividends
FROM public.portfolio_transactions pt
GROUP BY pt.portfolio_id, pt.user_id;

COMMENT ON VIEW public.v_portfolio_cash_flow IS 'סיכומי תזרים – משמש לחישוב יתרת מזומן';

-- ============================================================================
-- VIEW: v_portfolio_holdings_raw
--   חישוב פוזיציות לפי FIFO - per (portfolio_id, symbol).
--   החישוב כאן הוא פשוט (avg cost), ה-FIFO המלא מבוצע ב-TS/Edge Function כי יותר ביצועי.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_portfolio_holdings_raw AS
WITH symbol_agg AS (
  SELECT
    pt.portfolio_id,
    pt.user_id,
    pt.symbol,
    MAX(pt.asset_type) AS asset_type,
    MAX(pt.exchange) AS exchange,
    SUM(CASE WHEN pt.type = 'buy'  THEN pt.quantity ELSE 0 END) AS total_bought,
    SUM(CASE WHEN pt.type = 'sell' THEN pt.quantity ELSE 0 END) AS total_sold,
    SUM(CASE WHEN pt.type = 'buy'
             THEN (pt.quantity * pt.price) + COALESCE(pt.commission, 0)
             ELSE 0 END) AS total_invested,
    SUM(CASE WHEN pt.type = 'sell'
             THEN (pt.quantity * pt.price) - COALESCE(pt.commission, 0)
             ELSE 0 END) AS total_proceeds,
    SUM(CASE WHEN pt.type = 'dividend' THEN COALESCE(pt.amount, 0) ELSE 0 END) AS total_dividends,
    MIN(CASE WHEN pt.type = 'buy' THEN pt.date END) AS first_buy_date,
    MAX(pt.date) AS last_tx_date
  FROM public.portfolio_transactions pt
  WHERE pt.symbol IS NOT NULL
  GROUP BY pt.portfolio_id, pt.user_id, pt.symbol
)
SELECT
  sa.portfolio_id,
  sa.user_id,
  sa.symbol,
  sa.asset_type,
  sa.exchange,
  (sa.total_bought - sa.total_sold)                                  AS quantity,
  sa.total_bought,
  sa.total_sold,
  sa.total_invested,
  sa.total_proceeds,
  sa.total_dividends,
  CASE
    WHEN sa.total_bought > 0
    THEN sa.total_invested / NULLIF(sa.total_bought, 0)
    ELSE 0
  END                                                                AS avg_buy_price,
  sa.first_buy_date,
  sa.last_tx_date
FROM symbol_agg sa;

COMMENT ON VIEW public.v_portfolio_holdings_raw IS 'אגרגציה גולמית לפי symbol - בסיס לחישובי FIFO ב-Edge Function';

-- ============================================================================
-- RLS – הפעלה והגנות
-- ============================================================================
ALTER TABLE public.portfolios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_value_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_price_cache    ENABLE ROW LEVEL SECURITY;

-- portfolios: בעלים בלבד
DROP POLICY IF EXISTS portfolios_owner_select ON public.portfolios;
CREATE POLICY portfolios_owner_select ON public.portfolios
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS portfolios_owner_insert ON public.portfolios;
CREATE POLICY portfolios_owner_insert ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS portfolios_owner_update ON public.portfolios;
CREATE POLICY portfolios_owner_update ON public.portfolios
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS portfolios_owner_delete ON public.portfolios;
CREATE POLICY portfolios_owner_delete ON public.portfolios
  FOR DELETE USING (auth.uid() = user_id);

-- portfolio_transactions: בעלים בלבד
DROP POLICY IF EXISTS portfolio_tx_owner_select ON public.portfolio_transactions;
CREATE POLICY portfolio_tx_owner_select ON public.portfolio_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS portfolio_tx_owner_insert ON public.portfolio_transactions;
CREATE POLICY portfolio_tx_owner_insert ON public.portfolio_transactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portfolio_tx_owner_update ON public.portfolio_transactions;
CREATE POLICY portfolio_tx_owner_update ON public.portfolio_transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS portfolio_tx_owner_delete ON public.portfolio_transactions;
CREATE POLICY portfolio_tx_owner_delete ON public.portfolio_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- portfolio_value_history: read לבעלים, כתיבה רק ל-service role (Edge Function)
DROP POLICY IF EXISTS portfolio_value_history_owner_select ON public.portfolio_value_history;
CREATE POLICY portfolio_value_history_owner_select ON public.portfolio_value_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  );

-- portfolio_price_cache: כל משתמש מאומת יכול לקרוא, כתיבה רק ל-service role
DROP POLICY IF EXISTS portfolio_price_cache_authenticated_select ON public.portfolio_price_cache;
CREATE POLICY portfolio_price_cache_authenticated_select ON public.portfolio_price_cache
  FOR SELECT TO authenticated USING (TRUE);

-- ============================================================================
-- GRANTs לviews
-- ============================================================================
GRANT SELECT ON public.v_portfolio_cash_flow      TO authenticated;
GRANT SELECT ON public.v_portfolio_holdings_raw   TO authenticated;
