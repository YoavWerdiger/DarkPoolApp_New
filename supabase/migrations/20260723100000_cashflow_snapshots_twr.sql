-- ============================================================================
-- 20260723100000_cashflow_snapshots_twr.sql
--
-- מטרה: הוספת מעקב cash flow יומי ל-daily_portfolio_snapshots ו-portfolio_stats.
--
-- שלבים:
--   1. הוסף עמודות deposits_today/withdrawals_today/dividends_today/fees_today
--      ל-daily_portfolio_snapshots (לחישוב TWR בצד הלקוח)
--   2. הוסף עמודות avg_win/avg_loss/total_dividends/total_fees/net_deposits
--      ל-portfolio_stats (פירוט P&L נקי)
--   3. עדכן recalc_portfolio_stats — חישוב העמודות החדשות
--   4. עדכן upsert_daily_snapshot — מילוי cash flow יומי
--   5. עדכן portfolio_tx_cash_update — קריאה ל-upsert_daily_snapshot + recalc_stats
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. עמודות חדשות ב-daily_portfolio_snapshots
--    נאפשר TWR: clients מחשבים twr_factor = V[t] / (V[t-1] + CF[t])
--    כאשר CF[t] = deposits_today - withdrawals_today (הון חיצוני בלבד)
-- ----------------------------------------------------------------------------
ALTER TABLE public.daily_portfolio_snapshots
  ADD COLUMN IF NOT EXISTS deposits_today    NUMERIC(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawals_today NUMERIC(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dividends_today   NUMERIC(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees_today        NUMERIC(20,8) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_portfolio_snapshots.deposits_today    IS
  'הפקדות שנכנסו ביום זה (מ-portfolio_transactions). משמש לחישוב TWR בצד הלקוח.';
COMMENT ON COLUMN public.daily_portfolio_snapshots.withdrawals_today IS
  'משיכות שיצאו ביום זה. משמש לחישוב TWR בצד הלקוח.';
COMMENT ON COLUMN public.daily_portfolio_snapshots.dividends_today   IS
  'דיבידנדים שהתקבלו ביום זה — הכנסה מתיק, לא הון חיצוני.';
COMMENT ON COLUMN public.daily_portfolio_snapshots.fees_today        IS
  'עמלות/דמי-ניהול שנגבו ביום זה — הוצאה מתיק, לא הון חיצוני.';

-- ----------------------------------------------------------------------------
-- 2. עמודות חדשות ב-portfolio_stats
-- ----------------------------------------------------------------------------
ALTER TABLE public.portfolio_stats
  ADD COLUMN IF NOT EXISTS avg_win         NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS avg_loss        NUMERIC(20,8),
  ADD COLUMN IF NOT EXISTS total_dividends NUMERIC(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fees      NUMERIC(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_deposits    NUMERIC(20,8) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.portfolio_stats.avg_win         IS
  'ממוצע P&L של trades רווחיים בלבד (status=CLOSED ו-profit_loss > 0)';
COMMENT ON COLUMN public.portfolio_stats.avg_loss        IS
  'ממוצע P&L של trades הפסדיים בלבד (status=CLOSED ו-profit_loss < 0)';
COMMENT ON COLUMN public.portfolio_stats.total_dividends IS
  'סך דיבידנדים מ-portfolio_transactions (type=dividend)';
COMMENT ON COLUMN public.portfolio_stats.total_fees      IS
  'סך עמלות ודמי-ניהול מ-portfolio_transactions (type=fee)';
COMMENT ON COLUMN public.portfolio_stats.net_deposits    IS
  'הפקדות פחות משיכות — הון חיצוני נטו שהוכנס לתיק';

-- ----------------------------------------------------------------------------
-- 3. עדכון recalc_portfolio_stats
--    כולל: avg_win, avg_loss, total_dividends, total_fees, net_deposits
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_portfolio_stats(p_portfolio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total           INTEGER;
  v_open            INTEGER;
  v_closed          INTEGER;
  v_wins            INTEGER;
  v_losses          INTEGER;
  v_total_pnl       NUMERIC(20,8);
  v_win_rate        NUMERIC(8,4);
  v_avg_pnl         NUMERIC(20,8);
  v_avg_win         NUMERIC(20,8);
  v_avg_loss        NUMERIC(20,8);
  v_total_dividends NUMERIC(20,8);
  v_total_fees      NUMERIC(20,8);
  v_net_deposits    NUMERIC(20,8);
BEGIN
  -- ---- מ-trades: ספירות, P&L מסחרי, win rate, avg win/loss ----
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'OPEN'),
    COUNT(*) FILTER (WHERE status = 'CLOSED'),
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit_loss > 0),
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit_loss < 0),
    COALESCE(SUM(profit_loss)   FILTER (WHERE status = 'CLOSED'), 0),
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'CLOSED') > 0
      THEN (COUNT(*) FILTER (WHERE status = 'CLOSED' AND profit_loss > 0)::NUMERIC
            / COUNT(*) FILTER (WHERE status = 'CLOSED')::NUMERIC) * 100
      ELSE NULL
    END,
    CASE
      WHEN COUNT(*) FILTER (WHERE status = 'CLOSED') > 0
      THEN SUM(profit_loss)  FILTER (WHERE status = 'CLOSED')
           / COUNT(*) FILTER (WHERE status = 'CLOSED')
      ELSE NULL
    END,
    AVG(profit_loss) FILTER (WHERE status = 'CLOSED' AND profit_loss > 0),
    AVG(profit_loss) FILTER (WHERE status = 'CLOSED' AND profit_loss < 0)
  INTO v_total, v_open, v_closed, v_wins, v_losses,
       v_total_pnl, v_win_rate, v_avg_pnl, v_avg_win, v_avg_loss
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id;

  -- ---- מ-portfolio_transactions: dividends, fees, net deposits ----
  SELECT
    COALESCE(SUM(CASE WHEN type = 'dividend'    THEN COALESCE(amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'fee'          THEN COALESCE(amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'deposit'      THEN COALESCE(amount, 0) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type = 'withdrawal'  THEN COALESCE(amount, 0) ELSE 0 END), 0)
  INTO v_total_dividends, v_total_fees, v_net_deposits
  FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id;

  INSERT INTO public.portfolio_stats(
    portfolio_id,
    total_trades, open_trades, closed_trades,
    win_trades, loss_trades,
    total_pnl, win_rate, avg_pnl,
    avg_win, avg_loss,
    total_dividends, total_fees, net_deposits,
    updated_at
  )
  VALUES (
    p_portfolio_id,
    COALESCE(v_total, 0), COALESCE(v_open, 0), COALESCE(v_closed, 0),
    COALESCE(v_wins, 0), COALESCE(v_losses, 0),
    COALESCE(v_total_pnl, 0), v_win_rate, v_avg_pnl,
    v_avg_win, v_avg_loss,
    COALESCE(v_total_dividends, 0), COALESCE(v_total_fees, 0), COALESCE(v_net_deposits, 0),
    NOW()
  )
  ON CONFLICT (portfolio_id) DO UPDATE SET
    total_trades    = EXCLUDED.total_trades,
    open_trades     = EXCLUDED.open_trades,
    closed_trades   = EXCLUDED.closed_trades,
    win_trades      = EXCLUDED.win_trades,
    loss_trades     = EXCLUDED.loss_trades,
    total_pnl       = EXCLUDED.total_pnl,
    win_rate        = EXCLUDED.win_rate,
    avg_pnl         = EXCLUDED.avg_pnl,
    avg_win         = EXCLUDED.avg_win,
    avg_loss        = EXCLUDED.avg_loss,
    total_dividends = EXCLUDED.total_dividends,
    total_fees      = EXCLUDED.total_fees,
    net_deposits    = EXCLUDED.net_deposits,
    updated_at      = EXCLUDED.updated_at;
END;
$$;

COMMENT ON FUNCTION public.recalc_portfolio_stats IS
  'מחשב מחדש stats לתיק נתון — כולל avg_win/avg_loss/dividends/fees/net_deposits';

-- ----------------------------------------------------------------------------
-- 4. עדכון upsert_daily_snapshot — מילוי cash flow יומי
--    קורא את deposits/withdrawals/dividends/fees מ-portfolio_transactions
--    לאותו יום, ומאחסן לצורך חישוב TWR בצד הלקוח.
-- ----------------------------------------------------------------------------
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
  v_realized_pnl    NUMERIC(20,8);
  v_trade_count     INTEGER;
  v_cash            NUMERIC(20,8);
  v_deposits        NUMERIC(20,8);
  v_withdrawals     NUMERIC(20,8);
  v_dividends       NUMERIC(20,8);
  v_fees            NUMERIC(20,8);
BEGIN
  -- P&L ממומש ל-p_date (לפי exit_date ב-UTC)
  SELECT
    COALESCE(SUM(profit_loss), 0),
    COUNT(*)
  INTO v_realized_pnl, v_trade_count
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id
    AND status       = 'CLOSED'
    AND public.local_date_key(exit_date, 'UTC') = p_date;

  -- יתרת מזומן נוכחית מהתיק
  SELECT COALESCE(available_cash, 0)
  INTO v_cash
  FROM public.portfolios
  WHERE id = p_portfolio_id;

  -- cash flow events ל-p_date מ-portfolio_transactions
  -- date הוא timestamptz — חותכים ל-DATE
  SELECT
    COALESCE(SUM(CASE WHEN type = 'deposit'    THEN COALESCE(amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN COALESCE(amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'dividend'   THEN COALESCE(amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'fee'         THEN COALESCE(amount, 0) ELSE 0 END), 0)
  INTO v_deposits, v_withdrawals, v_dividends, v_fees
  FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id
    AND date::DATE   = p_date;

  INSERT INTO public.daily_portfolio_snapshots(
    portfolio_id, snapshot_date,
    portfolio_value, realized_pnl, cash, trade_count,
    deposits_today, withdrawals_today, dividends_today, fees_today,
    updated_at
  )
  VALUES (
    p_portfolio_id, p_date,
    v_cash,               -- portfolio_value = available_cash (baseline; TWR עם שווי שוק מחושב בלקוח)
    v_realized_pnl,
    v_cash,
    v_trade_count,
    v_deposits, v_withdrawals, v_dividends, v_fees,
    NOW()
  )
  ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
    realized_pnl      = EXCLUDED.realized_pnl,
    cash              = EXCLUDED.cash,
    trade_count       = EXCLUDED.trade_count,
    deposits_today    = EXCLUDED.deposits_today,
    withdrawals_today = EXCLUDED.withdrawals_today,
    dividends_today   = EXCLUDED.dividends_today,
    fees_today        = EXCLUDED.fees_today,
    updated_at        = NOW();
END;
$$;

COMMENT ON FUNCTION public.upsert_daily_snapshot IS
  'Upsert snapshot יומי — כולל cash flow יומי לחישוב TWR בצד הלקוח';

-- ----------------------------------------------------------------------------
-- 5. עדכון portfolio_tx_cash_update
--    בנוסף לעדכון available_cash — גם:
--    (a) upsert_daily_snapshot לתאריך הטרנזקציה (מעדכן cash flow יומי)
--    (b) recalc_portfolio_stats (מעדכן dividends/fees/net_deposits)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portfolio_tx_cash_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_date DATE;
  v_new_date DATE;
BEGIN
  -- =========================================================================
  -- שלב 1: undo old cash impact (UPDATE / DELETE)
  -- =========================================================================
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.type IN ('deposit', 'dividend') THEN
      UPDATE public.portfolios
        SET available_cash = available_cash - COALESCE(OLD.amount, 0)
        WHERE id = OLD.portfolio_id;
    ELSIF OLD.type IN ('withdrawal', 'fee') THEN
      UPDATE public.portfolios
        SET available_cash = available_cash + COALESCE(OLD.amount, 0)
        WHERE id = OLD.portfolio_id;
    END IF;
  END IF;

  -- =========================================================================
  -- שלב 2: apply new cash impact (INSERT / UPDATE)
  -- =========================================================================
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.type IN ('deposit', 'dividend') THEN
      UPDATE public.portfolios
        SET available_cash = available_cash + COALESCE(NEW.amount, 0)
        WHERE id = NEW.portfolio_id;
    ELSIF NEW.type IN ('withdrawal', 'fee') THEN
      UPDATE public.portfolios
        SET available_cash = available_cash - COALESCE(NEW.amount, 0)
        WHERE id = NEW.portfolio_id;
    END IF;
  END IF;

  -- =========================================================================
  -- שלב 3: upsert_daily_snapshot ל-portfolio_transactions מסוג cash flow
  --   (buy/sell לא משפיעים על daily snapshots — מטופלים בטריגר של trades)
  -- =========================================================================
  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.type IN ('deposit', 'withdrawal', 'dividend', 'fee') THEN
    -- עדכן snapshot לתאריך הישן
    v_old_date := OLD.date::DATE;
    PERFORM public.upsert_daily_snapshot(OLD.portfolio_id, v_old_date);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.type IN ('deposit', 'withdrawal', 'dividend', 'fee') THEN
    -- עדכן snapshot לתאריך החדש
    v_new_date := NEW.date::DATE;
    PERFORM public.upsert_daily_snapshot(NEW.portfolio_id, v_new_date);
  END IF;

  -- =========================================================================
  -- שלב 4: recalc portfolio_stats לעדכון total_dividends/total_fees/net_deposits
  --   רק לסוגים שמשפיעים — buy/sell לא משנים portfolio_stats (מטופלים ב-trades trigger)
  -- =========================================================================
  IF COALESCE(NEW.type, OLD.type) IN ('deposit', 'withdrawal', 'dividend', 'fee') THEN
    PERFORM public.recalc_portfolio_stats(
      COALESCE(NEW.portfolio_id, OLD.portfolio_id)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'portfolio_tx_cash_update failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.portfolio_tx_cash_update IS
  'Trigger על portfolio_transactions: עדכון available_cash + daily_snapshot + portfolio_stats';

-- הטריגר עצמו לא משתנה (DROP+CREATE רק ל-function החדשה)
DROP TRIGGER IF EXISTS trg_portfolio_tx_cash_upd ON public.portfolio_transactions;
CREATE TRIGGER trg_portfolio_tx_cash_upd
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_transactions
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_tx_cash_update();

-- ----------------------------------------------------------------------------
-- 6. אתחול נתונים קיימים
--    מלא deposits_today/withdrawals_today/dividends_today/fees_today
--    בשורות קיימות ב-daily_portfolio_snapshots
-- ----------------------------------------------------------------------------
UPDATE public.daily_portfolio_snapshots dps
SET
  deposits_today    = COALESCE(cf.deposits,    0),
  withdrawals_today = COALESCE(cf.withdrawals, 0),
  dividends_today   = COALESCE(cf.dividends,   0),
  fees_today        = COALESCE(cf.fees,         0),
  updated_at        = NOW()
FROM (
  SELECT
    portfolio_id,
    date::DATE AS tx_date,
    SUM(CASE WHEN type = 'deposit'    THEN COALESCE(amount, 0) ELSE 0 END) AS deposits,
    SUM(CASE WHEN type = 'withdrawal' THEN COALESCE(amount, 0) ELSE 0 END) AS withdrawals,
    SUM(CASE WHEN type = 'dividend'   THEN COALESCE(amount, 0) ELSE 0 END) AS dividends,
    SUM(CASE WHEN type = 'fee'         THEN COALESCE(amount, 0) ELSE 0 END) AS fees
  FROM public.portfolio_transactions
  WHERE type IN ('deposit', 'withdrawal', 'dividend', 'fee')
  GROUP BY portfolio_id, date::DATE
) AS cf
WHERE dps.portfolio_id  = cf.portfolio_id
  AND dps.snapshot_date = cf.tx_date;

-- אתחל portfolio_stats לכל תיק קיים (ימלא avg_win/avg_loss/total_dividends/...)
DO $$
DECLARE
  v_pid UUID;
BEGIN
  FOR v_pid IN SELECT DISTINCT id FROM public.portfolios LOOP
    BEGIN
      PERFORM public.recalc_portfolio_stats(v_pid);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalc_portfolio_stats failed for %: %', v_pid, SQLERRM;
    END;
  END LOOP;
END;
$$;
