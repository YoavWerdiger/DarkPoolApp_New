-- fix_colmex_statement_dates_and_cashflow
-- --------------------------------------------------------------------------
-- 1. Backfill occurred_at מ-raw.createDate / createdDate (Colmex panel)
-- 2. עדכון normalized_type להפקדות/משיכות/עמלות לפי operation_type
-- 3. יישור תאריכי portfolio_transactions שנוצרו מ-statements
-- 4. הרחבת ingest למיפוי גמיש יותר
-- --------------------------------------------------------------------------

-- 1+2. Backfill dates + normalize types
UPDATE public.broker_statements bs
SET
  occurred_at = COALESCE(
    bs.occurred_at,
    CASE
      WHEN COALESCE(bs.raw->>'createDate', bs.raw->>'createdDate') ~ '^[0-9]+$'
        THEN to_timestamp(
          (COALESCE(bs.raw->>'createDate', bs.raw->>'createdDate'))::double precision / 1000.0
        )
      ELSE NULL
    END
  ),
  normalized_type = CASE
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%withdraw%' THEN 'withdrawal'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%deposit%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%transfer in%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%funding%' THEN 'deposit'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%fee%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%commission%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%swap%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%tax%' THEN 'fee'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%dividend%' THEN 'dividend'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%interest%' THEN 'interest'
    ELSE bs.normalized_type
  END
WHERE bs.occurred_at IS NULL
   OR bs.normalized_type = 'other';

-- 3. יישור תאריכי טקסאות cashflow שנבלעו מ-colmex:op:
UPDATE public.portfolio_transactions pt
SET date = bs.occurred_at
FROM public.broker_statements bs
WHERE pt.id = bs.portfolio_transaction_id
  AND bs.occurred_at IS NOT NULL
  AND pt.notes LIKE 'colmex:op:%'
  AND (pt.date IS DISTINCT FROM bs.occurred_at);

-- 4. Ingest גמיש יותר (deposit/withdrawal/fee/overnight)
CREATE OR REPLACE FUNCTION public.ingest_broker_statements_to_portfolio(
  p_broker_account_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio_id UUID;
  v_user_id      UUID;
  v_inserted     INTEGER := 0;
BEGIN
  SELECT p.id, p.user_id
    INTO v_portfolio_id, v_user_id
  FROM public.broker_accounts ba
  JOIN public.portfolios p ON p.broker_account_id = ba.id
  WHERE ba.id = p_broker_account_id;

  IF v_portfolio_id IS NULL THEN
    RETURN 0;
  END IF;

  -- רענון normalized_type לפני ingest
  UPDATE public.broker_statements bs
  SET normalized_type = CASE
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%withdraw%' THEN 'withdrawal'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%deposit%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%transfer in%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%funding%' THEN 'deposit'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%fee%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%commission%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%swap%'
      OR lower(COALESCE(bs.operation_type, '')) LIKE '%tax%' THEN 'fee'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%dividend%' THEN 'dividend'
    WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%interest%' THEN 'interest'
    ELSE bs.normalized_type
  END,
  occurred_at = COALESCE(
    bs.occurred_at,
    CASE
      WHEN bs.raw ? 'createDate' AND (bs.raw->>'createDate') ~ '^[0-9]+$'
        THEN to_timestamp((bs.raw->>'createDate')::double precision / 1000.0)
      WHEN bs.raw ? 'createdDate' AND (bs.raw->>'createdDate') ~ '^[0-9]+$'
        THEN to_timestamp((bs.raw->>'createdDate')::double precision / 1000.0)
      ELSE NULL
    END
  )
  WHERE bs.broker_account_id = p_broker_account_id
    AND bs.ingested_into_portfolio = FALSE;

  WITH new_tx AS (
    INSERT INTO public.portfolio_transactions (
      portfolio_id, user_id, type, symbol, amount, currency, date, notes
    )
    SELECT
      v_portfolio_id,
      v_user_id,
      CASE
        WHEN bs.normalized_type IN ('deposit','withdrawal','fee','dividend')
          THEN bs.normalized_type
        WHEN lower(COALESCE(bs.operation_type, '')) LIKE '%fee%' THEN 'fee'
        ELSE bs.normalized_type
      END,
      CASE WHEN bs.normalized_type = 'dividend' THEN NULLIF(bs.symbol, 'N/A') ELSE NULL END,
      ABS(COALESCE(bs.amount, 0)),
      COALESCE(NULLIF(bs.currency, ''), 'USD'),
      COALESCE(bs.occurred_at, NOW()),
      'colmex:op:' || bs.operation_id::TEXT
    FROM public.broker_statements bs
    WHERE bs.broker_account_id = p_broker_account_id
      AND bs.ingested_into_portfolio = FALSE
      AND (
        bs.normalized_type IN ('deposit','withdrawal','fee','dividend')
        OR lower(COALESCE(bs.operation_type, '')) LIKE '%fee%'
      )
      AND bs.amount IS NOT NULL AND bs.amount <> 0
      AND lower(COALESCE(bs.operation_type, '')) NOT IN ('p/l', 'pl', 'pnl')
    RETURNING id, notes
  )
  UPDATE public.broker_statements bs
     SET ingested_into_portfolio = TRUE,
         portfolio_transaction_id = nt.id
    FROM new_tx nt
   WHERE nt.notes = 'colmex:op:' || bs.operation_id::TEXT
     AND bs.broker_account_id = p_broker_account_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE public.broker_statements
     SET ingested_into_portfolio = TRUE
   WHERE broker_account_id = p_broker_account_id
     AND ingested_into_portfolio = FALSE
     AND lower(COALESCE(operation_type, '')) IN ('p/l', 'pl', 'pnl');

  RETURN v_inserted;
END;
$$;

-- 5. ניקוי buy/sell junk מתיקי Colmex (לא אמורים להגיע מ-statements)
DELETE FROM public.portfolio_transactions pt
USING public.portfolios p
WHERE pt.portfolio_id = p.id
  AND p.source = 'colmex_pro'
  AND pt.type IN ('buy', 'sell');

-- 6. Snapshot היום ל-COLH99795 מ-equity הברוקר (כדי שהגרף לא יישאר עם 0/1 נקודה שגויה)
INSERT INTO public.daily_portfolio_snapshots (
  portfolio_id, snapshot_date, portfolio_value,
  deposits_today, withdrawals_today, dividends_today, fees_today
)
SELECT
  p.id,
  CURRENT_DATE,
  COALESCE(bas.equity, p.available_cash, 0),
  COALESCE((
    SELECT SUM(ABS(amount)) FROM public.portfolio_transactions t
    WHERE t.portfolio_id = p.id AND t.type = 'deposit'
      AND t.date::date = CURRENT_DATE
  ), 0),
  COALESCE((
    SELECT SUM(ABS(amount)) FROM public.portfolio_transactions t
    WHERE t.portfolio_id = p.id AND t.type = 'withdrawal'
      AND t.date::date = CURRENT_DATE
  ), 0),
  0,
  COALESCE((
    SELECT SUM(ABS(amount)) FROM public.portfolio_transactions t
    WHERE t.portfolio_id = p.id AND t.type = 'fee'
      AND t.date::date = CURRENT_DATE
  ), 0)
FROM public.portfolios p
JOIN public.broker_accounts ba ON ba.id = p.broker_account_id
LEFT JOIN public.broker_account_state bas ON bas.broker_account_id = ba.id
WHERE p.id = '37ef1b42-0794-4452-96e1-fbb5e30bedf2'
ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
  portfolio_value = EXCLUDED.portfolio_value,
  deposits_today = EXCLUDED.deposits_today,
  withdrawals_today = EXCLUDED.withdrawals_today,
  fees_today = EXCLUDED.fees_today;

-- 7. Snapshot ליום המשיכה (היסטוריה בסיסית) אם יש withdrawal עם תאריך אמיתי
INSERT INTO public.daily_portfolio_snapshots (
  portfolio_id, snapshot_date, portfolio_value,
  deposits_today, withdrawals_today, dividends_today, fees_today
)
SELECT
  p.id,
  bs.occurred_at::date,
  GREATEST(0, COALESCE(bas.equity, 0) + ABS(bs.amount)),
  0,
  ABS(bs.amount),
  0,
  0
FROM public.portfolios p
JOIN public.broker_accounts ba ON ba.id = p.broker_account_id
JOIN public.broker_statements bs ON bs.broker_account_id = ba.id
LEFT JOIN public.broker_account_state bas ON bas.broker_account_id = ba.id
WHERE p.id = '37ef1b42-0794-4452-96e1-fbb5e30bedf2'
  AND bs.normalized_type = 'withdrawal'
  AND bs.occurred_at IS NOT NULL
  AND bs.occurred_at::date < CURRENT_DATE
ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
  withdrawals_today = GREATEST(
    public.daily_portfolio_snapshots.withdrawals_today,
    EXCLUDED.withdrawals_today
  );
