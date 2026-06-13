-- ============================================================================
-- 032_portfolio_snapshot_on_tx.sql
--
-- מטרה: לעדכן את ה-snapshot של ה-portfolio_value_history מיד כשמשנים
-- טרנזקציה בתיק (קניה / מכירה / סגירת פוזיציה / הפקדה / משיכה / וכו'),
-- כדי שהגרף "שווי תיק לאורך זמן" יתעדכן מיד ולא רק ב-23:00 UTC של ה-cron.
--
-- אסטרטגיה:
--   1) trigger AFTER INSERT/UPDATE/DELETE על public.portfolio_transactions
--      קורא ל-Edge Function portfolio-daily-snapshot עם portfolio_id יחיד
--      (fire-and-forget דרך pg_net.http_post — לא חוסם את הטרנזקציה).
--   2) ה-Edge Function כבר idempotent (UPSERT לפי portfolio_id, date).
--
-- דרישות (כבר קיימים מ-030):
--   - pg_cron + pg_net extensions
--   - vault secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
--
-- ביצועים: pg_net הוא async (queue ב-postgres) — לא משהה את הטרנזקציה
-- ולא נכשל אם ה-Edge Function זמני לא זמין. בעת bulk-import תהיה
-- קריאה לכל שורה; ה-Edge Function תמיד מחזיר ה-snapshot העדכני ביותר.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: trigger_portfolio_snapshot_for_tx
--   נקראת מ-AFTER trigger; מוציאה http_post ל-Edge Function בלי לחסום.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_portfolio_snapshot_for_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url   TEXT;
  v_key   TEXT;
  v_pid   UUID;
BEGIN
  v_pid := COALESCE(NEW.portfolio_id, OLD.portfolio_id);
  IF v_pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- אם המשתמש מפעיל בעצמו backfill או import מסיבי הוא יכול לבטל זמנית:
  --   SET LOCAL "app.skip_portfolio_snapshot_trigger" = 'true';
  IF current_setting('app.skip_portfolio_snapshot_trigger', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    -- אין secrets — שותקים בלי להפיל את הטרנזקציה.
    RAISE WARNING 'portfolio_snapshot_on_tx: missing vault secrets, skipping trigger';
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/portfolio-daily-snapshot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('portfolio_id', v_pid::text),
    timeout_milliseconds := 60000
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- אף פעם לא מפילים טרנזקציה בגלל בעיית snapshot.
  RAISE WARNING 'portfolio_snapshot_on_tx failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_portfolio_snapshot_for_tx()
  FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_portfolio_snapshot_for_tx()
  TO service_role;

COMMENT ON FUNCTION public.trigger_portfolio_snapshot_for_tx IS
  'Trigger ל-portfolio_transactions: מפעיל snapshot יומי מיידי דרך Edge Function (idempotent).';

-- ----------------------------------------------------------------------------
-- Triggers על portfolio_transactions
--   AFTER ולא BEFORE כדי שה-snapshot יחושב על המצב החדש.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_portfolio_tx_snapshot_ins ON public.portfolio_transactions;
CREATE TRIGGER trg_portfolio_tx_snapshot_ins
  AFTER INSERT ON public.portfolio_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_portfolio_snapshot_for_tx();

DROP TRIGGER IF EXISTS trg_portfolio_tx_snapshot_upd ON public.portfolio_transactions;
CREATE TRIGGER trg_portfolio_tx_snapshot_upd
  AFTER UPDATE ON public.portfolio_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_portfolio_snapshot_for_tx();

DROP TRIGGER IF EXISTS trg_portfolio_tx_snapshot_del ON public.portfolio_transactions;
CREATE TRIGGER trg_portfolio_tx_snapshot_del
  AFTER DELETE ON public.portfolio_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_portfolio_snapshot_for_tx();
