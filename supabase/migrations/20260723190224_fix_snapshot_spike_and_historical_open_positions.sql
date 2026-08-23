-- ============================================================================
-- 20260723190224_fix_snapshot_spike_and_historical_open_positions.sql
--
-- תיקון שתי בעיות בגרף שווי התיק:
--
-- בעיה 1 — Spike לא טבעי:
--   upsert_daily_snapshot חישב portfolio_value = available_cash (נוכחי),
--   וה-ON CONFLICT לא עדכן portfolio_value.
--   תיקון: נוסחה חדשה (net_deposits + realized_pnl מצטבר עד לתאריך),
--   ו-ON CONFLICT מעדכן גם portfolio_value.
--
-- בעיה 2 — Spike בסגירה לתאריך עבר:
--   trades_after_change קרא upsert_daily_snapshot ליום הסגירה בלבד.
--   תיקון: קריאה ל-range_recalc_snapshots מיום הסגירה עד היום.
--
-- שווי היסטורי פוזיציות פתוחות (unrealized):
--   מחושב בצד הלקוח ב-buildHistoricalPortfolioSeriesFromSnapshots
--   עם מחירים מ-Yahoo Finance.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. upsert_daily_snapshot — נוסחה חדשה + תיקון ON CONFLICT
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
  v_portfolio_value NUMERIC(20,8);
  v_realized_pnl    NUMERIC(20,8);
  v_trade_count     INTEGER;
  v_cash            NUMERIC(20,8);
  v_net_deposits    NUMERIC(20,8);
  v_cum_realized    NUMERIC(20,8);
  v_deposits        NUMERIC(20,8);
  v_withdrawals     NUMERIC(20,8);
  v_dividends       NUMERIC(20,8);
  v_fees            NUMERIC(20,8);
BEGIN
  -- P&L ממומש שנסגר בדיוק ב-p_date
  SELECT
    COALESCE(SUM(profit_loss), 0),
    COUNT(*)
  INTO v_realized_pnl, v_trade_count
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id
    AND status       = 'CLOSED'
    AND public.local_date_key(exit_date, 'UTC') = p_date;

  -- P&L מצטבר עד p_date (כולל)
  SELECT COALESCE(SUM(profit_loss), 0)
  INTO v_cum_realized
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id
    AND status       = 'CLOSED'
    AND public.local_date_key(exit_date, 'UTC') <= p_date;

  -- הפקדות נטו מצטברות עד p_date (כולל)
  SELECT
    COALESCE(SUM(CASE WHEN type IN ('deposit','dividend') THEN COALESCE(amount,0) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type IN ('withdrawal','fee')  THEN COALESCE(amount,0) ELSE 0 END), 0)
  INTO v_net_deposits
  FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id
    AND date::DATE   <= p_date;

  -- portfolio_value = הפקדות נטו + P&L מצטבר
  -- (unrealized P&L מחושב בצד הלקוח עם מחירים היסטוריים מ-Yahoo Finance)
  v_portfolio_value := v_net_deposits + v_cum_realized;

  -- יתרת מזומן נוכחית (לעמודת cash — reference בלבד)
  SELECT COALESCE(available_cash, 0)
  INTO v_cash
  FROM public.portfolios
  WHERE id = p_portfolio_id;

  -- cash flow יומי מ-portfolio_transactions (לחישוב TWR בצד הלקוח)
  SELECT
    COALESCE(SUM(CASE WHEN type = 'deposit'    THEN COALESCE(amount,0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN COALESCE(amount,0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'dividend'   THEN COALESCE(amount,0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'fee'        THEN COALESCE(amount,0) ELSE 0 END), 0)
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
    v_portfolio_value,
    v_realized_pnl,
    v_cash,
    v_trade_count,
    v_deposits, v_withdrawals, v_dividends, v_fees,
    NOW()
  )
  ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
    portfolio_value   = EXCLUDED.portfolio_value,
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
  'Snapshot יומי — portfolio_value = net_deposits_up_to_date + realized_pnl_cumulative. '
  'unrealized P&L מחושב בצד הלקוח. ON CONFLICT מעדכן גם portfolio_value.';

-- ----------------------------------------------------------------------------
-- 2. trades_after_change — range_recalc בסגירה במקום upsert בודד
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trades_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_position_size  NUMERIC(20,8);
  v_exit_date      DATE;
  v_prev_exit_date DATE;
  v_is_futures     BOOLEAN;
  v_pid            UUID;
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
      UPDATE public.portfolios
        SET available_cash = available_cash + COALESCE(NEW.profit_loss, 0)
        WHERE id = v_pid;
    ELSE
      v_position_size := NEW.quantity * NEW.entry_price;
      UPDATE public.portfolios
        SET available_cash = available_cash + v_position_size + COALESCE(NEW.profit_loss, 0)
        WHERE id = v_pid;
    END IF;

    -- range_recalc מיום היציאה עד היום — פותר את ה-spike
    v_exit_date := public.local_date_key(NEW.exit_date, 'UTC');
    PERFORM public.range_recalc_snapshots(v_pid, v_exit_date, CURRENT_DATE);

  -- ---- Case 3: UPDATE exit_date שינוי — range recalc ----
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'CLOSED'
        AND NEW.status = 'CLOSED'
        AND OLD.exit_date IS DISTINCT FROM NEW.exit_date THEN
    v_prev_exit_date := public.local_date_key(OLD.exit_date, 'UTC');
    v_exit_date      := public.local_date_key(NEW.exit_date, 'UTC');
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

  PERFORM public.recalc_portfolio_stats(v_pid);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trades_after_change failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.trades_after_change IS
  'Trigger AFTER על trades — Case 2 (סגירה): range_recalc_snapshots מיום הסגירה עד היום, '
  'פותר spike בגרף שנגרם מ-snapshots ישנים שלא עודכנו.';

-- ----------------------------------------------------------------------------
-- 3. חישוב מחדש של כל ה-snapshots הקיימים עם הנוסחה החדשה
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_pid  UUID;
  v_from DATE;
  v_to   DATE := CURRENT_DATE;
BEGIN
  FOR v_pid IN SELECT DISTINCT id FROM public.portfolios LOOP
    BEGIN
      SELECT LEAST(
        MIN(public.local_date_key(entry_date, 'UTC')),
        MIN(snapshot_date)
      )
      INTO v_from
      FROM public.trades t
      LEFT JOIN public.daily_portfolio_snapshots s USING (portfolio_id)
      WHERE t.portfolio_id = v_pid OR s.portfolio_id = v_pid;

      IF v_from IS NOT NULL THEN
        PERFORM public.range_recalc_snapshots(v_pid, v_from, v_to);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalc failed for portfolio %: %', v_pid, SQLERRM;
    END;
  END LOOP;
END;
$$;
