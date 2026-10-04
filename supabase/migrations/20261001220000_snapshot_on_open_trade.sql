-- snapshot גם בפתיחת פוזיציה OPEN (תיקים ידניים)
-- קודם: upsert_daily_snapshot רק בסגירה → גרף/סקירה ריקים אחרי פתיחה

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
  v_entry_date     DATE;
  v_is_futures     BOOLEAN;
  v_pid            UUID;
  v_source         TEXT;
  v_pf_source      TEXT;
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
    IF TG_OP = 'INSERT' AND NEW.status = 'OPEN' THEN
      v_entry_date := public.local_date_key(NEW.entry_date, 'UTC');
      PERFORM public.upsert_daily_snapshot(v_pid, v_entry_date);
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'OPEN' AND NEW.status = 'CLOSED' THEN
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
    -- נקודת שווי ליום הפתיחה — סקירה/גרף ידני לא נשארים ריקים
    v_entry_date := public.local_date_key(NEW.entry_date, 'UTC');
    PERFORM public.upsert_daily_snapshot(v_pid, v_entry_date);

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
    PERFORM public.range_recalc_snapshots(v_pid, v_exit_date, CURRENT_DATE);

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
    -- רענון snapshot להיום אחרי מחיקת OPEN
    PERFORM public.upsert_daily_snapshot(v_pid, CURRENT_DATE);
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
  'AFTER על trades: cash+stats; snapshot גם ב-INSERT OPEN (ידני/Colmex) ולא רק בסגירה.';
