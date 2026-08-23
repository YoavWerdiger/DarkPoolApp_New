-- ============================================================================
-- 20260806172612_colmex_opening_balance_deposit.sql
--
-- Colmex לא שולח תמיד deposit statements. בלי הפקדות,
-- portfolio_value = net_deposits+realized יוצא שלילי ושובר את הגרף
-- (למרות ש-available_cash + open trades תקינים).
--
-- פתרון: deposit יחיד עם notes='colmex_opening_balance' שמתאים את
-- net_deposits כך ש-net_deposits+realized = cash + open_entry_cost.
-- unrealized נשאר בצד הלקוח — כמו תיקים ידניים.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_colmex_opening_deposit(
  p_portfolio_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT;
  v_user_id UUID;
  v_currency TEXT;
  v_cash NUMERIC(20,8);
  v_open_cost NUMERIC(20,8);
  v_realized NUMERIC(20,8);
  v_net_without_opening NUMERIC(20,8);
  v_needed NUMERIC(20,8);
  v_from DATE;
  v_existing UUID;
BEGIN
  SELECT source, user_id, currency, COALESCE(available_cash, 0)
    INTO v_source, v_user_id, v_currency, v_cash
  FROM public.portfolios
  WHERE id = p_portfolio_id;

  IF v_source IS DISTINCT FROM 'colmex_pro' THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(entry_price * quantity), 0)
    INTO v_open_cost
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id
    AND status = 'OPEN'
    AND COALESCE(asset_type, 'stock') <> 'futures';

  SELECT COALESCE(SUM(profit_loss), 0)
    INTO v_realized
  FROM public.trades
  WHERE portfolio_id = p_portfolio_id
    AND status = 'CLOSED';

  SELECT
    COALESCE(SUM(CASE WHEN type IN ('deposit','dividend') THEN COALESCE(amount,0) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type IN ('withdrawal','fee') THEN COALESCE(amount,0) ELSE 0 END), 0)
  INTO v_net_without_opening
  FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id
    AND COALESCE(notes, '') <> 'colmex_opening_balance';

  -- net_deposits(+opening) + realized = cash + open_cost
  v_needed := (v_cash + v_open_cost) - v_realized - v_net_without_opening;

  IF ABS(v_needed) < 0.01 THEN
    DELETE FROM public.portfolio_transactions
    WHERE portfolio_id = p_portfolio_id
      AND notes = 'colmex_opening_balance';
    RETURN 0;
  END IF;

  SELECT LEAST(
    (SELECT MIN(date::date) FROM public.portfolio_transactions
      WHERE portfolio_id = p_portfolio_id AND COALESCE(notes,'') <> 'colmex_opening_balance'),
    (SELECT MIN(public.local_date_key(entry_date, 'UTC')) FROM public.trades WHERE portfolio_id = p_portfolio_id),
    CURRENT_DATE
  ) INTO v_from;

  SELECT id INTO v_existing
  FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id
    AND notes = 'colmex_opening_balance'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.portfolio_transactions
       SET amount = v_needed,
           date = v_from::timestamptz,
           type = CASE WHEN v_needed >= 0 THEN 'deposit' ELSE 'withdrawal' END,
           updated_at = NOW()
     WHERE id = v_existing;
  ELSE
    INSERT INTO public.portfolio_transactions (
      portfolio_id, user_id, type, symbol, quantity, price, amount,
      commission, currency, date, notes, direction
    ) VALUES (
      p_portfolio_id, v_user_id,
      CASE WHEN v_needed >= 0 THEN 'deposit' ELSE 'withdrawal' END,
      NULL, NULL, NULL, ABS(v_needed),
      0, COALESCE(v_currency, 'USD'), v_from::timestamptz,
      'colmex_opening_balance', 'long'
    );
  END IF;

  PERFORM public.range_recalc_snapshots(p_portfolio_id, v_from, CURRENT_DATE);
  RETURN v_needed;
END;
$$;

COMMENT ON FUNCTION public.reconcile_colmex_opening_deposit(UUID) IS
  'מתאים יתרת פתיחה לתיק Colmex כך ש-snapshots = cash+open_cost (בסיס ללא unrealized).';

GRANT EXECUTE ON FUNCTION public.reconcile_colmex_opening_deposit(UUID) TO authenticated, service_role;

-- קריאה מתוך sync_broker_positions_to_trades (אחרי upsert_daily_snapshot)
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
  v_closed       RECORD;
  v_asset_type   TEXT;
  v_exchange     TEXT;
  v_direction    TEXT;
  v_entry_date   TIMESTAMPTZ;
  v_exit_date    TIMESTAMPTZ;
  v_qty          NUMERIC;
  v_entry_price  NUMERIC;
  v_exit_price   NUMERIC;
  v_realized     NUMERIC;
  v_commission   NUMERIC;
  v_colmex_id    TEXT;
  v_cash         NUMERIC;
  v_symbol       TEXT;
BEGIN
  SELECT p.id, p.user_id, COALESCE(p.currency, ba.currency, 'USD')
    INTO v_portfolio_id, v_user_id, v_currency
  FROM public.broker_accounts ba
  JOIN public.portfolios p ON p.id = ba.portfolio_id
  WHERE ba.id = p_broker_account_id;

  IF v_portfolio_id IS NULL THEN
    RETURN 0;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

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
    v_entry_price := v_pos.avg_open_price;
    v_direction := CASE
      WHEN lower(COALESCE(v_pos.side, 'long')) IN ('short', 'sell') THEN 'short'
      ELSE 'long'
    END;
    v_entry_date := COALESCE(
      v_pos.opened_at,
      CASE
        WHEN v_pos.raw ? 'createdDate' AND (v_pos.raw->>'createdDate') ~ '^[0-9]+$'
        THEN to_timestamp((v_pos.raw->>'createdDate')::double precision / 1000.0)
        ELSE NOW()
      END
    );
    v_asset_type := 'stock';
    v_exchange := NULL;

    SELECT COALESCE(bim.asset_type, 'stock'), bim.exchange
      INTO v_asset_type, v_exchange
    FROM public.broker_instrument_map bim
    WHERE bim.broker = 'colmex_pro'
      AND bim.tradable_instrument_id = v_pos.tradable_instrument_id
    LIMIT 1;

    IF v_asset_type IS NULL OR v_asset_type NOT IN ('stock','etf','fund','forex','crypto','futures') THEN
      v_asset_type := CASE
        WHEN lower(COALESCE(v_pos.raw->>'instrumentType','')) IN ('etf','fund','forex','crypto','futures')
          THEN lower(v_pos.raw->>'instrumentType')
        ELSE 'stock'
      END;
    END IF;

    INSERT INTO public.trades (
      portfolio_id, user_id, symbol, asset_type, exchange, currency,
      direction, status, entry_date, entry_price, quantity, leverage,
      commission, stop_loss, target_price, colmex_position_id, source
    ) VALUES (
      v_portfolio_id, v_user_id, upper(trim(v_pos.symbol)), v_asset_type, v_exchange, v_currency,
      v_direction, 'OPEN', v_entry_date, v_entry_price, v_qty, 1.0,
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

  FOR v_closed IN
    SELECT
      be.position_id,
      COALESCE(
        NULLIF(max(be.symbol), ''),
        NULLIF(max(be.raw->>'instrumentName'), ''),
        'UNKNOWN'
      ) AS symbol,
      CASE
        WHEN lower(COALESCE(max(be.raw->>'positionSide'), 'long')) IN ('short', 'sell')
          THEN 'short'
        ELSE 'long'
      END AS direction,
      CASE
        WHEN lower(COALESCE(max(be.raw->>'instrumentType'), '')) IN ('etf','fund','forex','crypto','futures')
          THEN lower(max(be.raw->>'instrumentType'))
        ELSE 'stock'
      END AS asset_type,
      max(be.raw->>'tradingExchange') AS exchange,
      COALESCE(
        NULLIF(sum(CASE WHEN be.side = 'buy' THEN be.quantity * be.price ELSE 0 END)
              / NULLIF(sum(CASE WHEN be.side = 'buy' THEN be.quantity ELSE 0 END), 0), 0),
        (array_agg(be.price ORDER BY COALESCE(
          be.executed_at,
          CASE WHEN be.raw ? 'createdDate' THEN to_timestamp((be.raw->>'createdDate')::double precision / 1000.0) END
        ) ASC NULLS LAST)
          FILTER (WHERE be.side = 'buy' OR lower(COALESCE(be.raw->>'positionStatus','')) = 'opened'))[1],
        min(be.price)
      ) AS entry_price,
      COALESCE(
        (array_agg(be.price ORDER BY COALESCE(
          be.executed_at,
          CASE WHEN be.raw ? 'createdDate' THEN to_timestamp((be.raw->>'createdDate')::double precision / 1000.0) END
        ) DESC NULLS LAST)
          FILTER (WHERE be.side = 'sell' OR lower(COALESCE(be.raw->>'positionStatus','')) = 'closed'))[1],
        max(be.price)
      ) AS exit_price,
      GREATEST(
        COALESCE(sum(CASE WHEN be.side = 'buy' THEN be.quantity ELSE 0 END), 0),
        COALESCE(sum(CASE WHEN be.side = 'sell' THEN be.quantity ELSE 0 END), 0),
        0.00000001
      ) AS quantity,
      COALESCE(sum(be.realized_pnl), 0) AS realized_pnl,
      COALESCE(sum(be.commission), 0) AS commission,
      min(COALESCE(
        be.executed_at,
        CASE WHEN be.raw ? 'createdDate' AND (be.raw->>'createdDate') ~ '^[0-9]+$'
          THEN to_timestamp((be.raw->>'createdDate')::double precision / 1000.0)
        END
      )) AS entry_date,
      max(COALESCE(
        be.executed_at,
        CASE WHEN be.raw ? 'createdDate' AND (be.raw->>'createdDate') ~ '^[0-9]+$'
          THEN to_timestamp((be.raw->>'createdDate')::double precision / 1000.0)
        END
      )) AS exit_date
    FROM public.broker_executions be
    WHERE be.broker_account_id = p_broker_account_id
      AND be.position_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.broker_positions bp
        WHERE bp.broker_account_id = p_broker_account_id
          AND bp.position_id = be.position_id
      )
    GROUP BY be.position_id
    HAVING
      (
        abs(
          coalesce(sum(CASE WHEN be.side = 'buy' THEN be.quantity ELSE 0 END), 0)
          - coalesce(sum(CASE WHEN be.side = 'sell' THEN be.quantity ELSE 0 END), 0)
        ) < 0.0001
        AND coalesce(sum(CASE WHEN be.side = 'buy' THEN be.quantity ELSE 0 END), 0) > 0
      )
      OR bool_or(lower(COALESCE(be.raw->>'positionStatus','')) = 'closed')
      OR abs(coalesce(sum(be.realized_pnl), 0)) > 0
  LOOP
    v_colmex_id := v_closed.position_id::TEXT;
    v_symbol := upper(trim(v_closed.symbol));
    v_direction := v_closed.direction;
    v_asset_type := CASE
      WHEN v_closed.asset_type IN ('stock','etf','fund','forex','crypto','futures')
        THEN v_closed.asset_type
      ELSE 'stock'
    END;
    v_exchange := NULLIF(v_closed.exchange, '');
    v_entry_price := COALESCE(v_closed.entry_price, 0);
    v_exit_price := COALESCE(v_closed.exit_price, v_entry_price);
    v_qty := ABS(COALESCE(v_closed.quantity, 0));
    IF v_qty <= 0 OR v_entry_price < 0 THEN
      CONTINUE;
    END IF;
    v_realized := v_closed.realized_pnl;
    v_commission := COALESCE(v_closed.commission, 0);
    v_entry_date := COALESCE(v_closed.entry_date, NOW());
    v_exit_date := COALESCE(v_closed.exit_date, v_entry_date, NOW());
    IF v_exit_date < v_entry_date THEN
      v_exit_date := v_entry_date;
    END IF;

    INSERT INTO public.trades (
      portfolio_id, user_id, symbol, asset_type, exchange, currency,
      direction, status, entry_date, entry_price, quantity, leverage,
      exit_date, exit_price, profit_loss, commission,
      colmex_position_id, source
    ) VALUES (
      v_portfolio_id, v_user_id, v_symbol, v_asset_type, v_exchange, v_currency,
      v_direction, 'CLOSED', v_entry_date, v_entry_price, v_qty, 1.0,
      v_exit_date, v_exit_price, v_realized, v_commission,
      v_colmex_id, 'colmex_pro'
    )
    ON CONFLICT (colmex_position_id) WHERE (colmex_position_id IS NOT NULL)
    DO UPDATE SET
      symbol       = EXCLUDED.symbol,
      asset_type   = EXCLUDED.asset_type,
      exchange     = EXCLUDED.exchange,
      direction    = EXCLUDED.direction,
      status       = 'CLOSED',
      entry_date   = EXCLUDED.entry_date,
      entry_price  = EXCLUDED.entry_price,
      quantity     = EXCLUDED.quantity,
      exit_date    = EXCLUDED.exit_date,
      exit_price   = EXCLUDED.exit_price,
      profit_loss  = EXCLUDED.profit_loss,
      commission   = EXCLUDED.commission,
      source       = 'colmex_pro',
      updated_at   = NOW()
    WHERE public.trades.status = 'CLOSED'
       OR public.trades.portfolio_id = v_portfolio_id;

    v_synced := v_synced + 1;
  END LOOP;

  FOR v_pos IN
    SELECT t.id, t.colmex_position_id, t.entry_price
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
      (ARRAY_AGG(be.price ORDER BY COALESCE(
        be.executed_at,
        CASE WHEN be.raw ? 'createdDate' THEN to_timestamp((be.raw->>'createdDate')::double precision / 1000.0) END
      ) DESC NULLS LAST))[1],
      MAX(COALESCE(
        be.executed_at,
        CASE WHEN be.raw ? 'createdDate' THEN to_timestamp((be.raw->>'createdDate')::double precision / 1000.0) END
      )),
      SUM(be.realized_pnl)
    INTO v_exit_price, v_exit_date, v_realized
    FROM public.broker_executions be
    WHERE be.broker_account_id = p_broker_account_id
      AND be.position_id::TEXT = v_pos.colmex_position_id;

    IF v_exit_price IS NULL THEN
      v_exit_price := v_pos.entry_price;
    END IF;
    IF v_exit_date IS NULL THEN
      v_exit_date := NOW();
    END IF;

    UPDATE public.trades
       SET status = 'CLOSED',
           exit_date = v_exit_date,
           exit_price = v_exit_price,
           profit_loss = v_realized,
           updated_at = NOW()
     WHERE id = v_pos.id;
  END LOOP;

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
  PERFORM public.reconcile_colmex_opening_deposit(v_portfolio_id);
  PERFORM public.upsert_daily_snapshot(v_portfolio_id, CURRENT_DATE);

  RETURN v_synced;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_broker_positions_to_trades(UUID) TO authenticated, service_role;

-- Backfill לכל תיקי Colmex
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.portfolios WHERE source = 'colmex_pro'
  LOOP
    PERFORM public.reconcile_colmex_opening_deposit(r.id);
  END LOOP;
END;
$$;
