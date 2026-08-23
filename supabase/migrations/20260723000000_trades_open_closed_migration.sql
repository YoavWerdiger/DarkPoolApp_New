-- ============================================================================
-- 20260723000000_trades_open_closed_migration.sql
--
-- מיגרציה: Trading Journal — מעבר מ-portfolio_transactions+FIFO
-- ל-trades עם OPEN/CLOSED, available_cash, portfolio_stats, daily_portfolio_snapshots.
--
-- שלבים:
--   1. הרחב asset_type ב-portfolio_transactions לכלול 'futures'
--   2. הוסף available_cash ל-portfolios
--   3. צור טבלת trades (פוזיציות עם סטטוס)
--   4. צור daily_portfolio_snapshots
--   5. צור portfolio_stats
--   6. פונקציות עזר: local_date_key, recalc_portfolio_stats, upsert_daily_snapshot,
--      range_recalc_snapshots
--   7. טריגרים על trades (BEFORE לחישוב profit_loss, AFTER לעדכון cash+stats+snapshots)
--   8. טריגר על portfolio_transactions לעדכון available_cash (הפקדות/משיכות)
--   9. RLS על כל הטבלאות החדשות
--  10. אתחול available_cash מנתונים קיימים
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. הרחב asset_type ב-portfolio_transactions לכלול 'futures'
-- ----------------------------------------------------------------------------
ALTER TABLE public.portfolio_transactions
  DROP CONSTRAINT IF EXISTS portfolio_transactions_asset_type_check;

ALTER TABLE public.portfolio_transactions
  ADD CONSTRAINT portfolio_transactions_asset_type_check CHECK (
    asset_type IS NULL
    OR asset_type IN ('stock','etf','fund','forex','crypto','futures')
  );

-- ----------------------------------------------------------------------------
-- 2. available_cash ב-portfolios
-- ----------------------------------------------------------------------------
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS available_cash NUMERIC(20,8) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.portfolios.available_cash IS
  'יתרת מזומן זמינה — מתעדכנת ע"י טריגרים: הפקדה/משיכה + פתיחה/סגירת trades';

-- ----------------------------------------------------------------------------
-- 3. טבלת trades — פוזיציות עם סטטוס OPEN/CLOSED
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- זיהוי נכס
  symbol          TEXT NOT NULL,
  asset_type      TEXT NOT NULL
                    CHECK (asset_type IN ('stock','etf','fund','forex','crypto','futures')),
  exchange        TEXT,
  currency        TEXT NOT NULL DEFAULT 'USD',

  -- כיוון וסטטוס
  direction       TEXT NOT NULL DEFAULT 'long'
                    CHECK (direction IN ('long', 'short')),
  status          TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN', 'CLOSED')),

  -- כניסה
  entry_date      TIMESTAMPTZ NOT NULL,
  entry_price     NUMERIC(20,8) NOT NULL CHECK (entry_price >= 0),
  quantity        NUMERIC(20,8) NOT NULL CHECK (quantity > 0),
  leverage        NUMERIC(8,4) NOT NULL DEFAULT 1.0 CHECK (leverage > 0),

  -- יציאה (ממולא ב-CLOSED)
  exit_date       TIMESTAMPTZ,
  exit_price      NUMERIC(20,8),

  -- P&L — מחושב אוטומטית ע"י טריגר BEFORE בסגירה
  profit_loss     NUMERIC(20,8),

  -- פיוצ'רס: ערך לנקודה (לדוגמה $50 ל-ES)
  point_value     NUMERIC(20,8),

  -- עמלות
  commission      NUMERIC(20,8) NOT NULL DEFAULT 0,

  -- יומן מסחר
  notes           TEXT CHECK (notes IS NULL OR length(notes) <= 512),
  stop_loss       NUMERIC(20,8),
  target_price    NUMERIC(20,8),
  strategy_name   TEXT,
  journal_details JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- אילוץ: אם CLOSED — חייבים exit_date ו-exit_price
  CONSTRAINT trades_closed_fields_check CHECK (
    status = 'OPEN'
    OR (exit_date IS NOT NULL AND exit_price IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trades_portfolio_status
  ON public.trades(portfolio_id, status);

CREATE INDEX IF NOT EXISTS idx_trades_portfolio_entry
  ON public.trades(portfolio_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_trades_portfolio_exit
  ON public.trades(portfolio_id, exit_date DESC)
  WHERE exit_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_user
  ON public.trades(user_id);

COMMENT ON TABLE public.trades IS
  'יומן טריידים — פוזיציות בודדות עם סטטוס OPEN/CLOSED, leverage, profit_loss אוטומטי';

-- ----------------------------------------------------------------------------
-- 4. daily_portfolio_snapshots — snapshot יומי מבוסס trades
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_portfolio_snapshots (
  portfolio_id    UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  portfolio_value NUMERIC(20,8) NOT NULL DEFAULT 0,
  realized_pnl    NUMERIC(20,8) NOT NULL DEFAULT 0,
  cash            NUMERIC(20,8) NOT NULL DEFAULT 0,
  trade_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_portfolio
  ON public.daily_portfolio_snapshots(portfolio_id, snapshot_date DESC);

COMMENT ON TABLE public.daily_portfolio_snapshots IS
  'Snapshot יומי לגרף ביצועים — מחושב מ-trades סגורים ו-available_cash';

-- ----------------------------------------------------------------------------
-- 5. portfolio_stats — אגרגציה
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_stats (
  portfolio_id   UUID PRIMARY KEY REFERENCES public.portfolios(id) ON DELETE CASCADE,
  total_trades   INTEGER NOT NULL DEFAULT 0,
  open_trades    INTEGER NOT NULL DEFAULT 0,
  closed_trades  INTEGER NOT NULL DEFAULT 0,
  win_trades     INTEGER NOT NULL DEFAULT 0,
  loss_trades    INTEGER NOT NULL DEFAULT 0,
  total_pnl      NUMERIC(20,8) NOT NULL DEFAULT 0,
  win_rate       NUMERIC(8,4),
  avg_pnl        NUMERIC(20,8),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.portfolio_stats IS
  'אגרגציה של ביצועי תיק — מתעדכנת אוטומטית ע"י טריגר על trades';

-- ============================================================================
-- פונקציות עזר
-- ============================================================================

-- 6a. local_date_key — ממיר timestamp ל-DATE לפי timezone מקומי
CREATE OR REPLACE FUNCTION public.local_date_key(
  ts  TIMESTAMPTZ,
  tz  TEXT DEFAULT 'UTC'
)
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (ts AT TIME ZONE tz)::DATE;
$$;

COMMENT ON FUNCTION public.local_date_key IS
  'ממיר timestamptz ל-DATE לפי timezone נתון. ברירת מחדל UTC. מונע UTC-drift.';

-- 6b. recalc_portfolio_stats — מחשב מחדש stats לתיק נתון
CREATE OR REPLACE FUNCTION public.recalc_portfolio_stats(p_portfolio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     INTEGER;
  v_open      INTEGER;
  v_closed    INTEGER;
  v_wins      INTEGER;
  v_losses    INTEGER;
  v_total_pnl NUMERIC(20,8);
  v_win_rate  NUMERIC(8,4);
  v_avg_pnl   NUMERIC(20,8);
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'OPEN'),
    COUNT(*) FILTER (WHERE status = 'CLOSED'),
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit_loss > 0),
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit_loss < 0),
    COALESCE(SUM(profit_loss) FILTER (WHERE status = 'CLOSED'), 0),
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'CLOSED') > 0
      THEN (COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit_loss > 0)::NUMERIC
            / COUNT(*) FILTER (WHERE status = 'CLOSED')::NUMERIC) * 100
      ELSE NULL
    END,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'CLOSED') > 0
      THEN SUM(profit_loss) FILTER (WHERE status = 'CLOSED')
           / COUNT(*) FILTER (WHERE status = 'CLOSED')
      ELSE NULL
    END
  INTO v_total, v_open, v_closed, v_wins, v_losses, v_total_pnl, v_win_rate, v_avg_pnl
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id;

  INSERT INTO public.portfolio_stats(
    portfolio_id, total_trades, open_trades, closed_trades,
    win_trades, loss_trades, total_pnl, win_rate, avg_pnl, updated_at
  )
  VALUES (
    p_portfolio_id,
    COALESCE(v_total,0), COALESCE(v_open,0), COALESCE(v_closed,0),
    COALESCE(v_wins,0), COALESCE(v_losses,0), COALESCE(v_total_pnl,0),
    v_win_rate, v_avg_pnl, NOW()
  )
  ON CONFLICT (portfolio_id) DO UPDATE SET
    total_trades  = EXCLUDED.total_trades,
    open_trades   = EXCLUDED.open_trades,
    closed_trades = EXCLUDED.closed_trades,
    win_trades    = EXCLUDED.win_trades,
    loss_trades   = EXCLUDED.loss_trades,
    total_pnl     = EXCLUDED.total_pnl,
    win_rate      = EXCLUDED.win_rate,
    avg_pnl       = EXCLUDED.avg_pnl,
    updated_at    = EXCLUDED.updated_at;
END;
$$;

-- 6c. upsert_daily_snapshot — מעדכן/יוצר snapshot ליום ספציפי
CREATE OR REPLACE FUNCTION public.upsert_daily_snapshot(
  p_portfolio_id UUID,
  p_date         DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_realized_pnl NUMERIC(20,8);
  v_trade_count  INTEGER;
  v_cash         NUMERIC(20,8);
BEGIN
  -- P&L ממומש לאותו יום (לפי exit_date ב-local time UTC)
  SELECT
    COALESCE(SUM(profit_loss), 0),
    COUNT(*)
  INTO v_realized_pnl, v_trade_count
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id
    AND status = 'CLOSED'
    AND public.local_date_key(exit_date, 'UTC') = p_date;

  -- יתרת מזומן נוכחית מהתיק
  SELECT COALESCE(available_cash, 0)
  INTO v_cash
  FROM public.portfolios
  WHERE id = p_portfolio_id;

  INSERT INTO public.daily_portfolio_snapshots(
    portfolio_id, snapshot_date, portfolio_value,
    realized_pnl, cash, trade_count, updated_at
  )
  VALUES (
    p_portfolio_id, p_date,
    v_cash,           -- portfolio_value = cash כ-baseline; ניתן לשפר עם שווי פוזיציות פתוחות
    v_realized_pnl,
    v_cash,
    v_trade_count,
    NOW()
  )
  ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
    realized_pnl = EXCLUDED.realized_pnl,
    cash         = EXCLUDED.cash,
    trade_count  = EXCLUDED.trade_count,
    updated_at   = NOW();
END;
$$;

-- 6d. range_recalc_snapshots — מחשב snapshots לטווח תאריכים (לשימוש כשמעדכנים exit_date לאחור)
CREATE OR REPLACE FUNCTION public.range_recalc_snapshots(
  p_portfolio_id UUID,
  p_from         DATE,
  p_to           DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := p_from;
BEGIN
  WHILE v_date <= p_to LOOP
    PERFORM public.upsert_daily_snapshot(p_portfolio_id, v_date);
    v_date := v_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.range_recalc_snapshots IS
  'מחשב מחדש snapshots לטווח תאריכים — שימושי כשמעדכנים exit_date לתאריך קודם';

-- ============================================================================
-- טריגרים על trades
-- ============================================================================

-- 7a. BEFORE trigger — מחשב profit_loss אוטומטית בסגירה
CREATE OR REPLACE FUNCTION public.trades_before_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- עדכן updated_at תמיד
  NEW.updated_at := NOW();

  -- חשב profit_loss אוטומטית כשסוגרים עסקה וה-profit_loss לא סופק ידנית
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'OPEN'
     AND NEW.status = 'CLOSED'
     AND NEW.profit_loss IS NULL THEN

    IF NEW.asset_type = 'futures' AND NEW.point_value IS NOT NULL THEN
      -- פיוצ'רס: (כיוון × הפרש נקודות) × point_value × חוזים × leverage − עמלה
      IF NEW.direction = 'long' THEN
        NEW.profit_loss :=
          (NEW.exit_price - NEW.entry_price)
          * NEW.point_value
          * NEW.quantity
          * COALESCE(NEW.leverage, 1)
          - COALESCE(NEW.commission, 0);
      ELSE
        NEW.profit_loss :=
          (NEW.entry_price - NEW.exit_price)
          * NEW.point_value
          * NEW.quantity
          * COALESCE(NEW.leverage, 1)
          - COALESCE(NEW.commission, 0);
      END IF;
    ELSE
      -- מניות/קריפטו/אחר: (כיוון × הפרש מחירים) × כמות × leverage − עמלה
      IF NEW.direction = 'long' THEN
        NEW.profit_loss :=
          (NEW.exit_price - NEW.entry_price)
          * NEW.quantity
          * COALESCE(NEW.leverage, 1)
          - COALESCE(NEW.commission, 0);
      ELSE
        NEW.profit_loss :=
          (NEW.entry_price - NEW.exit_price)
          * NEW.quantity
          * COALESCE(NEW.leverage, 1)
          - COALESCE(NEW.commission, 0);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trades_before ON public.trades;
CREATE TRIGGER trg_trades_before
  BEFORE INSERT OR UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.trades_before_change();

-- 7b. AFTER trigger — עדכון available_cash, stats, snapshots
CREATE OR REPLACE FUNCTION public.trades_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_position_size NUMERIC(20,8);
  v_exit_date     DATE;
  v_prev_exit_date DATE;
  v_is_futures    BOOLEAN;
  v_pid           UUID;
BEGIN
  v_pid := COALESCE(NEW.portfolio_id, OLD.portfolio_id);
  v_is_futures := (COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.asset_type ELSE NEW.asset_type END,
    'stock'
  ) = 'futures');

  -- ---- Case 1: INSERT — פתיחת פוזיציה ----
  IF TG_OP = 'INSERT' AND NEW.status = 'OPEN' THEN
    IF NOT v_is_futures THEN
      v_position_size := NEW.quantity * NEW.entry_price;
      UPDATE public.portfolios
        SET available_cash = available_cash - v_position_size
        WHERE id = v_pid;
    END IF;

  -- ---- Case 2: UPDATE OPEN→CLOSED — סגירת פוזיציה ----
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'OPEN' AND NEW.status = 'CLOSED' THEN
    IF v_is_futures THEN
      -- פיוצ'רס: מחזיר רק profit_loss
      UPDATE public.portfolios
        SET available_cash = available_cash + COALESCE(NEW.profit_loss, 0)
        WHERE id = v_pid;
    ELSE
      -- מניות/קריפטו: מחזיר capital + profit_loss
      v_position_size := NEW.quantity * NEW.entry_price;
      UPDATE public.portfolios
        SET available_cash = available_cash + v_position_size + COALESCE(NEW.profit_loss, 0)
        WHERE id = v_pid;
    END IF;

    -- Upsert snapshot ליום היציאה
    v_exit_date := public.local_date_key(NEW.exit_date, 'UTC');
    PERFORM public.upsert_daily_snapshot(v_pid, v_exit_date);

  -- ---- Case 3: UPDATE exit_date שינוי ---- (range recalc)
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'CLOSED'
        AND NEW.status = 'CLOSED'
        AND OLD.exit_date IS DISTINCT FROM NEW.exit_date THEN
    v_prev_exit_date := public.local_date_key(OLD.exit_date, 'UTC');
    v_exit_date      := public.local_date_key(NEW.exit_date, 'UTC');
    -- חשב מחדש מהתאריך המוקדם יותר עד היום
    PERFORM public.range_recalc_snapshots(
      v_pid,
      LEAST(v_prev_exit_date, v_exit_date),
      CURRENT_DATE
    );

  -- ---- Case 4: DELETE פוזיציה פתוחה — החזרת cash ----
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'OPEN' THEN
    IF NOT v_is_futures THEN
      v_position_size := OLD.quantity * OLD.entry_price;
      UPDATE public.portfolios
        SET available_cash = available_cash + v_position_size
        WHERE id = v_pid;
    END IF;
    PERFORM public.recalc_portfolio_stats(v_pid);
    RETURN OLD;
  END IF;

  -- Recalc stats (INSERT/UPDATE)
  PERFORM public.recalc_portfolio_stats(v_pid);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trades_after_change failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_trades_after ON public.trades;
CREATE TRIGGER trg_trades_after
  AFTER INSERT OR UPDATE OR DELETE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.trades_after_change();

-- ============================================================================
-- טריגר על portfolio_transactions — עדכון available_cash להפקדות/משיכות/דיבידנדים
-- ============================================================================
CREATE OR REPLACE FUNCTION public.portfolio_tx_cash_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- undo old value on UPDATE/DELETE
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.type = 'deposit' OR OLD.type = 'dividend' THEN
      UPDATE public.portfolios
        SET available_cash = available_cash - COALESCE(OLD.amount, 0)
        WHERE id = OLD.portfolio_id;
    ELSIF OLD.type IN ('withdrawal', 'fee') THEN
      UPDATE public.portfolios
        SET available_cash = available_cash + COALESCE(OLD.amount, 0)
        WHERE id = OLD.portfolio_id;
    END IF;
  END IF;

  -- apply new value on INSERT/UPDATE
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.type = 'deposit' OR NEW.type = 'dividend' THEN
      UPDATE public.portfolios
        SET available_cash = available_cash + COALESCE(NEW.amount, 0)
        WHERE id = NEW.portfolio_id;
    ELSIF NEW.type IN ('withdrawal', 'fee') THEN
      UPDATE public.portfolios
        SET available_cash = available_cash - COALESCE(NEW.amount, 0)
        WHERE id = NEW.portfolio_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'portfolio_tx_cash_update failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_portfolio_tx_cash_upd ON public.portfolio_transactions;
CREATE TRIGGER trg_portfolio_tx_cash_upd
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_transactions
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_tx_cash_update();

-- ============================================================================
-- RLS על הטבלאות החדשות
-- ============================================================================

ALTER TABLE public.trades                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_stats           ENABLE ROW LEVEL SECURITY;

-- trades
DROP POLICY IF EXISTS trades_owner_select ON public.trades;
CREATE POLICY trades_owner_select ON public.trades FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.is_public = TRUE
  )
);

DROP POLICY IF EXISTS trades_owner_insert ON public.trades;
CREATE POLICY trades_owner_insert ON public.trades FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS trades_owner_update ON public.trades;
CREATE POLICY trades_owner_update ON public.trades FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS trades_owner_delete ON public.trades;
CREATE POLICY trades_owner_delete ON public.trades FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
);

-- daily_portfolio_snapshots
DROP POLICY IF EXISTS daily_snapshots_owner_select ON public.daily_portfolio_snapshots;
CREATE POLICY daily_snapshots_owner_select ON public.daily_portfolio_snapshots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.is_public = TRUE)
);

-- portfolio_stats
DROP POLICY IF EXISTS portfolio_stats_owner_select ON public.portfolio_stats;
CREATE POLICY portfolio_stats_owner_select ON public.portfolio_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.is_public = TRUE)
);

-- ============================================================================
-- Grants לתפקידים
-- ============================================================================
GRANT SELECT ON public.trades                    TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trades    TO authenticated;
GRANT SELECT ON public.daily_portfolio_snapshots TO authenticated;
GRANT SELECT ON public.portfolio_stats           TO authenticated;

-- ============================================================================
-- אתחול available_cash מנתונים קיימים ב-portfolio_transactions
-- ============================================================================
UPDATE public.portfolios p
SET available_cash = COALESCE((
  SELECT
    SUM(CASE WHEN type IN ('deposit', 'dividend') THEN COALESCE(amount, 0) ELSE 0 END)
    - SUM(CASE WHEN type IN ('withdrawal', 'fee')  THEN COALESCE(amount, 0) ELSE 0 END)
  FROM public.portfolio_transactions
  WHERE portfolio_id = p.id
), 0)
WHERE available_cash = 0;
