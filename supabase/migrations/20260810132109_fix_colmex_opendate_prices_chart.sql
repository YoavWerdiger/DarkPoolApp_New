-- ============================================================================
-- 20260810132109_fix_colmex_opendate_prices_chart.sql
--
-- בעיות:
-- 1. Colmex שולח openDate / unrealizedPl — הפרסר וה-RPC התעלמו → opened_at=null
--    → entry_date=NOW() בטריידים פתוחים → גרף שטוח + צניחה חדה + "היום" = כל ה-unrealized
-- 2. ON CONFLICT לא עדכן entry_date — תאריך שגוי ננעל לנצח
--
-- תיקון: קריאת openDate מה-raw, עדכון entry_date, backfill + recalc.
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
  v_exec_open    TIMESTAMPTZ;
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

    -- תאריך פתיחה אמיתי: opened_at → openDate/createdDate ב-raw → min(execution)
    SELECT MIN(be.executed_at)
      INTO v_exec_open
    FROM public.broker_executions be
    WHERE be.broker_account_id = p_broker_account_id
      AND be.position_id = v_pos.position_id;

    v_entry_date := COALESCE(
      v_pos.opened_at,
      CASE
        WHEN v_pos.raw ? 'openDate' AND (v_pos.raw->>'openDate') ~ '^[0-9]+$'
          THEN to_timestamp((v_pos.raw->>'openDate')::double precision / 1000.0)
        WHEN v_pos.raw ? 'createdDate' AND (v_pos.raw->>'createdDate') ~ '^[0-9]+$'
          THEN to_timestamp((v_pos.raw->>'createdDate')::double precision / 1000.0)
        ELSE NULL
      END,
      v_exec_open,
      NOW()
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
    ON CONFLICT (portfolio_id, colmex_position_id) WHERE (colmex_position_id IS NOT NULL)
    DO UPDATE SET
      symbol       = EXCLUDED.symbol,
      asset_type   = EXCLUDED.asset_type,
      exchange     = EXCLUDED.exchange,
      direction    = EXCLUDED.direction,
      status       = 'OPEN',
      -- תמיד קח את התאריך המוקדם יותר (מתקן entry_date=NOW() שגוי)
      entry_date   = LEAST(public.trades.entry_date, EXCLUDED.entry_date),
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
    ON CONFLICT (portfolio_id, colmex_position_id) WHERE (colmex_position_id IS NOT NULL)
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
      updated_at   = NOW();

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

COMMENT ON FUNCTION public.sync_broker_positions_to_trades(UUID) IS
  'Upsert OPEN/CLOSED trades מ-broker_positions/executions. entry_date מ-openDate/executions; מתעדכן ב-ON CONFLICT.';

-- Backfill opened_at / unrealized / current_price מ-raw הקיים
UPDATE public.broker_positions bp
SET
  opened_at = COALESCE(
    bp.opened_at,
    CASE
      WHEN bp.raw ? 'openDate' AND (bp.raw->>'openDate') ~ '^[0-9]+$'
        THEN to_timestamp((bp.raw->>'openDate')::double precision / 1000.0)
      WHEN bp.raw ? 'createdDate' AND (bp.raw->>'createdDate') ~ '^[0-9]+$'
        THEN to_timestamp((bp.raw->>'createdDate')::double precision / 1000.0)
      ELSE NULL
    END
  ),
  unrealized_pnl = COALESCE(
    bp.unrealized_pnl,
    CASE
      WHEN bp.raw ? 'unrealizedPl' AND (bp.raw->>'unrealizedPl') ~ '^-?[0-9.]+$'
        THEN (bp.raw->>'unrealizedPl')::numeric
      ELSE NULL
    END
  ),
  current_price = COALESCE(
    bp.current_price,
    CASE
      WHEN bp.avg_open_price IS NOT NULL
       AND bp.quantity IS NOT NULL
       AND ABS(bp.quantity) > 0
       AND (
         bp.unrealized_pnl IS NOT NULL
         OR (bp.raw ? 'unrealizedPl' AND (bp.raw->>'unrealizedPl') ~ '^-?[0-9.]+$')
       )
      THEN
        bp.avg_open_price
        + (
          CASE
            WHEN lower(COALESCE(bp.side, 'long')) IN ('short', 'sell') THEN -1
            ELSE 1
          END
        ) * COALESCE(
          bp.unrealized_pnl,
          (bp.raw->>'unrealizedPl')::numeric
        ) / ABS(bp.quantity)
      ELSE NULL
    END
  ),
  updated_at = NOW()
WHERE bp.raw IS NOT NULL
  AND (
    bp.opened_at IS NULL
    OR bp.unrealized_pnl IS NULL
    OR bp.current_price IS NULL
  );

-- תקן entry_date בטריידים פתוחים לפי opened_at / openDate
UPDATE public.trades t
SET
  entry_date = LEAST(
    t.entry_date,
    COALESCE(
      bp.opened_at,
      CASE
        WHEN bp.raw ? 'openDate' AND (bp.raw->>'openDate') ~ '^[0-9]+$'
          THEN to_timestamp((bp.raw->>'openDate')::double precision / 1000.0)
      END
    )
  ),
  updated_at = NOW()
FROM public.broker_positions bp
JOIN public.broker_accounts ba ON ba.id = bp.broker_account_id
WHERE t.portfolio_id = ba.portfolio_id
  AND t.colmex_position_id = bp.position_id::text
  AND t.status = 'OPEN'
  AND t.source = 'colmex_pro'
  AND (
    bp.opened_at IS NOT NULL
    OR (bp.raw ? 'openDate' AND (bp.raw->>'openDate') ~ '^[0-9]+$')
  )
  AND t.entry_date > COALESCE(
    bp.opened_at,
    CASE
      WHEN bp.raw ? 'openDate' AND (bp.raw->>'openDate') ~ '^[0-9]+$'
        THEN to_timestamp((bp.raw->>'openDate')::double precision / 1000.0)
    END
  );

-- Re-sync + reconcile לכל חשבונות Colmex מקושרים
DO $$
DECLARE
  r RECORD;
  v_from DATE;
BEGIN
  FOR r IN
    SELECT ba.id AS broker_account_id, ba.portfolio_id
    FROM public.broker_accounts ba
    WHERE ba.portfolio_id IS NOT NULL
  LOOP
    PERFORM public.sync_broker_positions_to_trades(r.broker_account_id);

    SELECT LEAST(
      (SELECT MIN(public.local_date_key(entry_date, 'UTC')) FROM public.trades WHERE portfolio_id = r.portfolio_id),
      (SELECT MIN(date::date) FROM public.portfolio_transactions WHERE portfolio_id = r.portfolio_id),
      CURRENT_DATE - 400
    ) INTO v_from;

    IF v_from IS NOT NULL THEN
      PERFORM public.range_recalc_snapshots(r.portfolio_id, v_from, CURRENT_DATE);
    END IF;
  END LOOP;
END $$;
