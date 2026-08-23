-- migration: reset_portfolio_rpc
-- --------------------------------------------------------------------------
-- איפוס תיק אטומי (SECURITY DEFINER) — עוקף RLS חסר על snapshots/stats/
-- broker_positions (יש רק SELECT) שגרם ל-DELETE שקט של 0 שורות.
--
-- מוחק: trades, daily_portfolio_snapshots, portfolio_transactions,
--        portfolio_value_history, ו-broker_positions לתיק Colmex מקושר.
-- מאפס available_cash ל-0 ומחשב מחדש portfolio_stats.
-- --------------------------------------------------------------------------

-- מדיניות DELETE לבעלים על snapshots (גם לקריאות ישירות מהקליינט)
DROP POLICY IF EXISTS daily_snapshots_owner_delete ON public.daily_portfolio_snapshots;
CREATE POLICY daily_snapshots_owner_delete ON public.daily_portfolio_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = daily_portfolio_snapshots.portfolio_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS daily_snapshots_owner_insert ON public.daily_portfolio_snapshots;
CREATE POLICY daily_snapshots_owner_insert ON public.daily_portfolio_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = daily_portfolio_snapshots.portfolio_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS daily_snapshots_owner_update ON public.daily_portfolio_snapshots;
CREATE POLICY daily_snapshots_owner_update ON public.daily_portfolio_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = daily_portfolio_snapshots.portfolio_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = daily_portfolio_snapshots.portfolio_id
        AND p.user_id = auth.uid()
    )
  );

-- broker_positions: אפשר לבעלים למחוק (איפוס / ניתוק מקומי)
DROP POLICY IF EXISTS broker_positions_owner_delete ON public.broker_positions;
CREATE POLICY broker_positions_owner_delete ON public.broker_positions
  FOR DELETE USING (auth.uid() = user_id);

-- portfolio_value_history: מחיקה לבעלים (fallback לגרף ישן)
DROP POLICY IF EXISTS portfolio_value_history_owner_delete ON public.portfolio_value_history;
CREATE POLICY portfolio_value_history_owner_delete ON public.portfolio_value_history
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_value_history.portfolio_id
        AND p.user_id = auth.uid()
    )
  );

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

  -- 1) trades — טריגרים יעדכנו cash/stats בדרך; נאפס cash בסוף
  DELETE FROM public.trades
  WHERE portfolio_id = p_portfolio_id;

  -- 2) snapshots (גרף / TWR)
  DELETE FROM public.daily_portfolio_snapshots
  WHERE portfolio_id = p_portfolio_id;

  -- 3) טרנזקציות (הפקדות / קנייה-מכירה / דיבידנדים)
  DELETE FROM public.portfolio_transactions
  WHERE portfolio_id = p_portfolio_id;

  -- 4) היסטוריית שווי ישנה (fallback לגרף)
  DELETE FROM public.portfolio_value_history
  WHERE portfolio_id = p_portfolio_id;

  -- 5) Colmex: נקה פוזיציות מקומיות + איפוס מצב חשבון מקומי.
  --    סנכרון הבא מהברוקר ימלא מחדש אם החשבון עדיין מחובר.
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

  -- 6) מזומן ל-0 (יתרת פתיחה לאחר איפוס מלא)
  UPDATE public.portfolios
  SET available_cash = 0,
      updated_at = NOW()
  WHERE id = p_portfolio_id;

  -- 7) סטטיסטיקות מחדש (עמודות: win_trades, total_pnl, open_trades, …)
  PERFORM public.recalc_portfolio_stats(p_portfolio_id);
END;
$$;

COMMENT ON FUNCTION public.reset_portfolio(uuid) IS
  'מאפס תיק של הבעלים: מוחק trades/snapshots/transactions/value_history, מנקה broker_positions ל-Colmex, מאפס available_cash ו-stats.';

REVOKE ALL ON FUNCTION public.reset_portfolio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_portfolio(uuid) TO authenticated;
