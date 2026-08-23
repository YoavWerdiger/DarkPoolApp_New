-- מאפשר לקליינט (authenticated owner) לקרוא ל-sync_broker_positions_to_trades
-- אחרי Colmex sync, עם בדיקת בעלות בתוך הפונקציה.

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

GRANT EXECUTE ON FUNCTION public.sync_broker_positions_to_trades(UUID) TO authenticated, service_role;
