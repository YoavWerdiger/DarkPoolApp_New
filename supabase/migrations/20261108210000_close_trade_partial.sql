-- QA 9.2: סגירה חלקית של פוזיציה — אטומית.
-- הטריגר trades_after_change מטפל במזומן רק ב-INSERT OPEN / OPEN→CLOSED / DELETE OPEN,
-- והקטנת quantity של טרייד פתוח לא מחזירה מזומן. לכן:
--   1. מקטינים את הפוזיציה המקורית ב-p_quantity ומחזירים ידנית את עלות החלק הזה (לא בפיוצ'רס — כמו הטריגר)
--   2. מכניסים עותק OPEN בכמות p_quantity (הטריגר מנכה את העלות)
--   3. סוגרים את העותק במחיר/תאריך היציאה (הטריגרים מחשבים P&L ומחזירים עלות + רווח, snapshots)
-- נטו: +עלות החלק + P&L שלו — בדיוק כמו סגירה מלאה של פוזיציה בגודל הזה.
CREATE OR REPLACE FUNCTION public.close_trade_partial(
  p_trade_id uuid,
  p_quantity numeric,
  p_exit_price numeric,
  p_exit_date timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.trades%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO t FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trade_not_found' USING errcode = 'P0002';
  END IF;
  IF t.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized' USING errcode = '42501';
  END IF;
  IF t.status <> 'OPEN' THEN
    RAISE EXCEPTION 'trade_not_open' USING errcode = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity >= t.quantity THEN
    RAISE EXCEPTION 'invalid_quantity' USING errcode = '22023';
  END IF;
  IF p_exit_price IS NULL OR p_exit_price <= 0 THEN
    RAISE EXCEPTION 'invalid_exit_price' USING errcode = '22023';
  END IF;

  UPDATE public.trades SET quantity = quantity - p_quantity WHERE id = t.id;

  IF COALESCE(t.asset_type, 'stock') <> 'futures' THEN
    UPDATE public.portfolios
      SET available_cash = available_cash + p_quantity * t.entry_price
      WHERE id = t.portfolio_id;
  END IF;

  INSERT INTO public.trades (
    portfolio_id, user_id, symbol, asset_type, exchange, currency, direction, status,
    entry_date, entry_price, quantity, leverage, point_value, commission, notes,
    stop_loss, target_price, strategy_name, journal_details, source, tags
  ) VALUES (
    t.portfolio_id, t.user_id, t.symbol, t.asset_type, t.exchange, t.currency, t.direction, 'OPEN',
    t.entry_date, t.entry_price, p_quantity, t.leverage, t.point_value, 0, t.notes,
    t.stop_loss, t.target_price, t.strategy_name, COALESCE(t.journal_details, '{}'::jsonb), t.source, t.tags
  ) RETURNING id INTO v_new_id;

  UPDATE public.trades
    SET status = 'CLOSED', exit_price = p_exit_price, exit_date = COALESCE(p_exit_date, now())
    WHERE id = v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_trade_partial(uuid, numeric, numeric, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_trade_partial(uuid, numeric, numeric, timestamptz) TO authenticated;
