-- migration: sync_broker_positions_to_trades
-- --------------------------------------------------------------------------
-- גשר חסר: Colmex sync כותב ל-broker_positions / broker_account_state,
-- אבל מסכי התיק (Overview / Open Trades / סטטיסטיקות) קוראים מ-trades +
-- available_cash. העמודות colmex_position_id/source כבר נוספו ל-trades,
-- אבל אף sync לא מילא אותן.
--
-- השינוי:
--   1. RPC sync_broker_positions_to_trades — upsert OPEN מ-broker_positions,
--      סגירת trades שנעלמו, וסנכרון available_cash מ-broker_account_state.
--   2. דילוג על עדכוני available_cash בטריגרים עבור תיקי colmex_pro
--      (המקור האמת הוא מצב החשבון בברוקר).
--   3. ingest_broker_executions_to_portfolio — לא מעתיק buy/sell לתיקי
--      colmex_pro (פוזיציות מגיעות מ-trades; buy/sell מזהמים holdings).
-- --------------------------------------------------------------------------

-- ============================================================================
-- 1. טריגר trades — אל תיגע ב-available_cash לתיקי/טריידים מ-Colmex
-- ============================================================================
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
  v_source        TEXT;
  v_pf_source     TEXT;
BEGIN
  v_pid := COALESCE(NEW.portfolio_id, OLD.portfolio_id);
  v_source := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.source ELSE NEW.source END,
    'manual'
  );
  SELECT source INTO v_pf_source FROM public.portfolios WHERE id = v_pid;

  -- תיקי Colmex / טריידים מסונכרנים: cash מגיע מ-broker_account_state בלבד
  IF v_source = 'colmex_pro' OR v_pf_source = 'colmex_pro' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.recalc_portfolio_stats(v_pid);
      RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'OPEN' AND NEW.status = 'CLOSED' THEN
      v_exit_date := public.local_date_key(NEW.exit_date, 'UTC');
      PERFORM public.upsert_daily_snapshot(v_pid, v_exit_date);
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
    END IF;
    PERFORM public.recalc_portfolio_stats(v_pid);
    RETURN NEW;
  END IF;

  v_is_futures := (COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.asset_type ELSE NEW.asset_type END,
    'stock'
  ) = 'futures');

  IF TG_OP = 'INSERT' AND NEW.status = 'OPEN' THEN
    IF NOT v_is_futures THEN
      v_position_size := NEW.quantity * NEW.entry_price;
      UPDATE public.portfolios
        SET available_cash = available_cash - v_position_size
        WHERE id = v_pid;
    END IF;

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

    v_exit_date := public.local_date_key(NEW.exit_date, 'UTC');
    PERFORM public.upsert_daily_snapshot(v_pid, v_exit_date);

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

-- ============================================================================
-- 2. טריגר portfolio_transactions — אל תיגע ב-cash של תיקי Colmex
-- ============================================================================
CREATE OR REPLACE FUNCTION public.portfolio_tx_cash_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
  v_pf_source TEXT;
BEGIN
  v_pid := COALESCE(NEW.portfolio_id, OLD.portfolio_id);
  SELECT source INTO v_pf_source FROM public.portfolios WHERE id = v_pid;
  IF v_pf_source = 'colmex_pro' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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

-- ============================================================================
-- 3. ingest executions — דלג על buy/sell לתיקי Colmex (trades הם המקור)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ingest_broker_executions_to_portfolio(
  p_broker_account_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio_id UUID;
  v_user_id      UUID;
  v_pf_source    TEXT;
  v_inserted     INTEGER := 0;
BEGIN
  SELECT p.id, p.user_id, p.source
    INTO v_portfolio_id, v_user_id, v_pf_source
  FROM public.broker_accounts ba
  JOIN public.portfolios p ON p.broker_account_id = ba.id
  WHERE ba.id = p_broker_account_id;

  IF v_portfolio_id IS NULL THEN
    RETURN 0;
  END IF;

  -- תיקי Colmex: פוזיציות מגיעות מ-sync_broker_positions_to_trades
  IF v_pf_source = 'colmex_pro' THEN
    UPDATE public.broker_executions
       SET ingested_into_portfolio = TRUE
     WHERE broker_account_id = p_broker_account_id
       AND ingested_into_portfolio = FALSE
       AND side IN ('buy', 'sell');
    RETURN 0;
  END IF;

  WITH new_tx AS (
    INSERT INTO public.portfolio_transactions (
      portfolio_id, user_id, type, symbol, asset_type, exchange,
      quantity, price, commission, currency, date, notes
    )
    SELECT
      v_portfolio_id,
      v_user_id,
      be.side,
      COALESCE(be.symbol, 'UNKNOWN'),
      COALESCE(bim.asset_type, 'stock'),
      COALESCE(bim.exchange, NULL),
      ABS(COALESCE(be.quantity, 0)),
      COALESCE(be.price, 0),
      COALESCE(be.commission, 0),
      COALESCE(be.currency, 'USD'),
      COALESCE(be.executed_at, NOW()),
      'colmex:exec:' || be.execution_id::TEXT
    FROM public.broker_executions be
    LEFT JOIN public.broker_instrument_map bim
      ON bim.broker = 'colmex_pro' AND bim.tradable_instrument_id = be.tradable_instrument_id
    WHERE be.broker_account_id = p_broker_account_id
      AND be.ingested_into_portfolio = FALSE
      AND be.side IN ('buy','sell')
      AND be.quantity IS NOT NULL AND be.quantity > 0
      AND be.price    IS NOT NULL AND be.price    >= 0
    RETURNING id, notes
  )
  UPDATE public.broker_executions be
     SET ingested_into_portfolio = TRUE,
         portfolio_transaction_id = nt.id
    FROM new_tx nt
   WHERE nt.notes = 'colmex:exec:' || be.execution_id::TEXT
     AND be.broker_account_id = p_broker_account_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ============================================================================
-- 4. RPC ראשי: broker_positions → trades + cash מ-broker state
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_broker_positions_to_trades(
  p_broker_account_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio_id UUID;
  v_user_id      UUID;
  v_currency     TEXT;
  v_synced       INTEGER := 0;
  v_pos          RECORD;
  v_asset_type   TEXT;
  v_exchange     TEXT;
  v_direction    TEXT;
  v_entry_date   TIMESTAMPTZ;
  v_qty          NUMERIC;
  v_price        NUMERIC;
  v_exit_price   NUMERIC;
  v_exit_at      TIMESTAMPTZ;
  v_realized     NUMERIC;
  v_colmex_id    TEXT;
  v_cash         NUMERIC;
BEGIN
  SELECT p.id, p.user_id, COALESCE(p.currency, ba.currency, 'USD')
    INTO v_portfolio_id, v_user_id, v_currency
  FROM public.broker_accounts ba
  JOIN public.portfolios p ON p.id = ba.portfolio_id
  WHERE ba.id = p_broker_account_id;

  IF v_portfolio_id IS NULL THEN
    RETURN 0;
  END IF;

  -- קריאות מ-authenticated חייבות להיות של בעל החשבון; service_role עוקף
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- ---- Upsert פוזיציות פתוחות ----
  FOR v_pos IN
    SELECT *
    FROM public.broker_positions
    WHERE broker_account_id = p_broker_account_id
      AND quantity IS NOT NULL
      AND ABS(quantity) > 0
      AND avg_open_price IS NOT NULL
      AND avg_open_price >= 0
      AND symbol IS NOT NULL
      AND length(trim(symbol)) > 0
  LOOP
    v_colmex_id := v_pos.position_id::TEXT;
    v_qty := ABS(v_pos.quantity);
    v_price := v_pos.avg_open_price;
    v_direction := CASE
      WHEN lower(COALESCE(v_pos.side, 'long')) IN ('short', 'sell') THEN 'short'
      ELSE 'long'
    END;
    v_entry_date := COALESCE(v_pos.opened_at, NOW());
    v_asset_type := 'stock';
    v_exchange := NULL;

    SELECT COALESCE(bim.asset_type, 'stock'), bim.exchange
      INTO v_asset_type, v_exchange
    FROM public.broker_instrument_map bim
    WHERE bim.broker = 'colmex_pro'
      AND bim.tradable_instrument_id = v_pos.tradable_instrument_id
    LIMIT 1;

    IF v_asset_type IS NULL OR v_asset_type NOT IN ('stock','etf','fund','forex','crypto','futures') THEN
      v_asset_type := 'stock';
    END IF;

    INSERT INTO public.trades (
      portfolio_id, user_id, symbol, asset_type, exchange, currency,
      direction, status, entry_date, entry_price, quantity, leverage,
      commission, stop_loss, target_price, colmex_position_id, source
    ) VALUES (
      v_portfolio_id, v_user_id, upper(trim(v_pos.symbol)), v_asset_type, v_exchange, v_currency,
      v_direction, 'OPEN', v_entry_date, v_price, v_qty, 1.0,
      COALESCE(v_pos.commission, 0), v_pos.stop_loss, v_pos.take_profit,
      v_colmex_id, 'colmex_pro'
    )
    ON CONFLICT (colmex_position_id) WHERE (colmex_position_id IS NOT NULL)
    DO UPDATE SET
      symbol       = EXCLUDED.symbol,
      asset_type   = EXCLUDED.asset_type,
      exchange     = EXCLUDED.exchange,
      direction    = EXCLUDED.direction,
      status       = 'OPEN',
      entry_price  = EXCLUDED.entry_price,
      quantity     = EXCLUDED.quantity,
      commission   = EXCLUDED.commission,
      stop_loss    = EXCLUDED.stop_loss,
      target_price = EXCLUDED.target_price,
      exit_date    = NULL,
      exit_price   = NULL,
      profit_loss  = NULL,
      source       = 'colmex_pro',
      updated_at   = NOW();

    v_synced := v_synced + 1;
  END LOOP;

  -- ---- סגור trades שאין להם יותר broker_position ----
  FOR v_pos IN
    SELECT t.id, t.colmex_position_id, t.entry_price, t.quantity, t.direction
    FROM public.trades t
    WHERE t.portfolio_id = v_portfolio_id
      AND t.status = 'OPEN'
      AND t.source = 'colmex_pro'
      AND t.colmex_position_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.broker_positions bp
        WHERE bp.broker_account_id = p_broker_account_id
          AND bp.position_id::TEXT = t.colmex_position_id
      )
  LOOP
    SELECT
      (ARRAY_AGG(be.price ORDER BY be.executed_at DESC NULLS LAST))[1],
      MAX(be.executed_at),
      SUM(be.realized_pnl)
    INTO v_exit_price, v_exit_at, v_realized
    FROM public.broker_executions be
    WHERE be.broker_account_id = p_broker_account_id
      AND be.position_id::TEXT = v_pos.colmex_position_id;

    IF v_exit_price IS NULL THEN
      v_exit_price := v_pos.entry_price;
    END IF;
    IF v_exit_at IS NULL THEN
      v_exit_at := NOW();
    END IF;

    UPDATE public.trades
       SET status = 'CLOSED',
           exit_date = v_exit_at,
           exit_price = v_exit_price,
           profit_loss = v_realized,
           updated_at = NOW()
     WHERE id = v_pos.id;
  END LOOP;

  -- ---- סנכרון מזומן ממצב הברוקר ----
  SELECT COALESCE(bas.available_funds, bas.balance, 0)
    INTO v_cash
  FROM public.broker_account_state bas
  WHERE bas.broker_account_id = p_broker_account_id;

  IF v_cash IS NOT NULL THEN
    UPDATE public.portfolios
       SET available_cash = v_cash,
           updated_at = NOW()
     WHERE id = v_portfolio_id;
  END IF;

  PERFORM public.recalc_portfolio_stats(v_portfolio_id);
  RETURN v_synced;
END;
$$;

COMMENT ON FUNCTION public.sync_broker_positions_to_trades(UUID) IS
  'מסנכרן broker_positions → trades (OPEN/CLOSED) ומעדכן available_cash מ-broker_account_state לתיק Colmex מקושר';

GRANT EXECUTE ON FUNCTION public.sync_broker_positions_to_trades(UUID) TO authenticated, service_role;

-- ============================================================================
-- 5. Backfill לתיקים מקושרים קיימים
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ba.id
    FROM public.broker_accounts ba
    WHERE ba.portfolio_id IS NOT NULL
  LOOP
    PERFORM public.sync_broker_positions_to_trades(r.id);
  END LOOP;
END;
$$;
