-- הרחבת reset_portfolio: מאפס גם broker_account_state המקומי לתיק Colmex
CREATE OR REPLACE FUNCTION public.reset_portfolio(p_portfolio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_source text;
  v_broker_account_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT user_id, source, broker_account_id
    INTO v_owner, v_source, v_broker_account_id
  FROM public.portfolios
  WHERE id = p_portfolio_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'portfolio_not_found';
  END IF;

  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  DELETE FROM public.trades
  WHERE portfolio_id = p_portfolio_id;

  DELETE FROM public.daily_portfolio_snapshots
  WHERE portfolio_id = p_portfolio_id;

  DELETE FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id;

  DELETE FROM public.portfolio_value_history
  WHERE portfolio_id = p_portfolio_id;

  IF v_source = 'colmex_pro' AND v_broker_account_id IS NOT NULL THEN
    DELETE FROM public.broker_positions
    WHERE broker_account_id = v_broker_account_id
      AND user_id = v_uid;

    UPDATE public.broker_account_state
    SET balance = 0,
        equity = 0,
        available_funds = 0,
        margin_used = 0,
        margin_available = 0,
        projected_balance = 0,
        unrealized_pnl = 0,
        realized_pnl_today = 0,
        blocked_funds = 0,
        updated_at = NOW()
    WHERE broker_account_id = v_broker_account_id
      AND user_id = v_uid;
  END IF;

  UPDATE public.portfolios
  SET available_cash = 0,
      updated_at = NOW()
  WHERE id = p_portfolio_id;

  PERFORM public.recalc_portfolio_stats(p_portfolio_id);
END;
$$;
