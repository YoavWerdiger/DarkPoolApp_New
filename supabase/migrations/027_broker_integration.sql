-- ============================================================================
-- 027_broker_integration.sql
-- אינטגרציית broker חיצוני (Colmex Pro / TraderEvolution Client REST API)
-- ----------------------------------------------------------------------------
-- מבנה כללי:
--   1. broker_connections      – חיבור user-to-broker (credentials ב-vault.secrets)
--   2. broker_accounts         – חשבונות trading תחת חיבור (ממופים לתיקים)
--   3. broker_instrument_map   – mapping של tradableInstrumentId → symbol
--   4. broker_panel_config     – cache של /config (שמות עמודות דינמיים)
--   5. broker_account_state    – snapshot שוטף של חשבון (balance/equity/margin)
--   6. broker_positions        – פוזיציות פתוחות
--   7. broker_open_orders      – פקודות פתוחות + SL/TP
--   8. broker_executions       – executions (fills)
--   9. broker_statements       – הפקדות/משיכות/עמלות/דיבידנדים/ריבית
--   10. broker_sync_log        – לוג סנכרון
--
-- הגנה: כל הטבלאות מוגנות RLS לפי user_id.
-- כתיבה לכלל הטבלאות מתבצעת רק ע"י service_role דרך Edge Functions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pgcrypto לצורך gen_random_uuid (אם עדיין לא קיים)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. broker_connections
--   חיבור פעיל בין user לברוקר. ה-credentials מוצפנים ב-vault.secrets.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker              TEXT NOT NULL CHECK (broker IN ('colmex_pro')),
  environment         TEXT NOT NULL DEFAULT 'uat' CHECK (environment IN ('uat','prod')),
  display_name        TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','expired','failed','disconnected')),

  -- שם ה-secret ב-vault.secrets (לא ID של supabase user — name unique).
  -- ה-secret עצמו: JSON {"username": "...", "password": "..."} מוצפן.
  vault_secret_name   TEXT,

  -- Access/Refresh tokens החיים ל-token caching בין sync runs.
  -- מוצפנים גם הם ב-vault.secrets בשם vault_token_secret_name.
  vault_token_secret_name TEXT,
  token_expires_at    TIMESTAMPTZ,

  last_sync_at        TIMESTAMPTZ,
  last_sync_status    TEXT,
  last_sync_error     TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- משתמש יכול להחזיק רק חיבור אחד פעיל פר (broker, environment).
  -- חיבורים מנותקים (disconnected) לא תופסים את המפתח – נמחקים בפועל ע"י cleanup.
  CONSTRAINT broker_connections_unique_per_user
    UNIQUE (user_id, broker, environment)
);

CREATE INDEX IF NOT EXISTS idx_broker_connections_user
  ON public.broker_connections(user_id) WHERE status = 'active';

COMMENT ON TABLE  public.broker_connections        IS 'חיבורי משתמש ל-broker חיצוני (Colmex Pro וכו'')';
COMMENT ON COLUMN public.broker_connections.vault_secret_name IS 'שם ה-secret ב-vault.secrets המכיל user/pass מוצפן';
COMMENT ON COLUMN public.broker_connections.vault_token_secret_name IS 'שם ה-secret המכיל access/refresh token (לחיסכון ב-re-auth)';

-- ----------------------------------------------------------------------------
-- 2. broker_accounts
--   חשבונות הלקוח אצל הברוקר (משתמש אחד יכול להחזיק כמה).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  broker_account_id   TEXT NOT NULL,     -- "ACC-001" / מספר חשבון Colmex
  account_name        TEXT,
  account_type        TEXT CHECK (account_type IN ('demo','live','contest','funded','challenge')),
  currency            TEXT NOT NULL DEFAULT 'USD',
  status              TEXT,              -- ACTIVE/CLOSED/SUSPENDED/...

  -- TradingRules / RiskRules / MarginRules הגולמיים
  trading_rules       JSONB,
  risk_rules          JSONB,
  margin_rules        JSONB,

  -- portfolio שמייצג את החשבון הזה ב-DarkPoolApp.
  portfolio_id        UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT broker_accounts_unique UNIQUE (connection_id, broker_account_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_accounts_user      ON public.broker_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_portfolio ON public.broker_accounts(portfolio_id) WHERE portfolio_id IS NOT NULL;

COMMENT ON TABLE  public.broker_accounts IS 'חשבונות trading של המשתמש בברוקר';

-- ----------------------------------------------------------------------------
-- 3. broker_instrument_map (shared cache)
--   מיפוי בין tradableInstrumentId של TraderEvolution לסימול אוניברסלי.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_instrument_map (
  broker                 TEXT NOT NULL,
  tradable_instrument_id BIGINT NOT NULL,
  symbol                 TEXT NOT NULL,
  asset_type             TEXT,
  exchange               TEXT,
  market_data_exchange   TEXT,
  name                   TEXT,
  isin                   TEXT,
  sector                 TEXT,
  industry               TEXT,
  currency               TEXT,
  raw                    JSONB,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (broker, tradable_instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_instrument_symbol
  ON public.broker_instrument_map(broker, symbol);

COMMENT ON TABLE public.broker_instrument_map IS 'מיפוי tradableInstrumentId→symbol — cache משותף לכל המשתמשים';

-- ----------------------------------------------------------------------------
-- 4. broker_panel_config
--   cache ל-/config endpoint (שמות עמודות עבור arrays של orders/positions/...).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_panel_config (
  broker        TEXT NOT NULL,
  panel_id      TEXT NOT NULL,
  -- panel_id: 'positions' | 'orders' | 'ordersHistory' | 'filledOrders' | 'accountDetails' | 'statements'
  columns       JSONB NOT NULL,           -- [{ id, description }]
  customer_access JSONB,
  rate_limits   JSONB,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (broker, panel_id)
);

COMMENT ON TABLE public.broker_panel_config IS 'cache ל-/config response — שמות עמודות עבור response arrays';

-- ----------------------------------------------------------------------------
-- 5. broker_account_state
--   snapshot שוטף של חשבון (מחושב מ-/state).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_account_state (
  broker_account_id   UUID PRIMARY KEY REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance             NUMERIC(24,8),
  equity              NUMERIC(24,8),
  available_funds     NUMERIC(24,8),
  margin_used         NUMERIC(24,8),
  margin_available    NUMERIC(24,8),
  projected_balance   NUMERIC(24,8),
  unrealized_pnl      NUMERIC(24,8),
  realized_pnl_today  NUMERIC(24,8),
  blocked_funds       NUMERIC(24,8),
  currency            TEXT,
  raw                 JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_account_state_user
  ON public.broker_account_state(user_id);

COMMENT ON TABLE public.broker_account_state IS 'מצב חשבון shadow (balance/equity/margin) — מתעדכן בכל sync';

-- ----------------------------------------------------------------------------
-- 6. broker_positions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_positions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id       UUID NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  position_id             BIGINT NOT NULL,           -- מ-Colmex
  tradable_instrument_id  BIGINT,
  symbol                  TEXT,                       -- resolved
  side                    TEXT CHECK (side IN ('long','short')),
  quantity                NUMERIC(24,8),
  avg_open_price          NUMERIC(24,8),
  current_price           NUMERIC(24,8),
  unrealized_pnl          NUMERIC(24,8),
  realized_pnl            NUMERIC(24,8),
  swap                    NUMERIC(24,8),
  commission              NUMERIC(24,8),
  stop_loss               NUMERIC(24,8),
  take_profit             NUMERIC(24,8),
  trailing_offset         NUMERIC(24,8),
  opened_at               TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw                     JSONB,

  CONSTRAINT broker_positions_unique UNIQUE (broker_account_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_positions_account ON public.broker_positions(broker_account_id);
CREATE INDEX IF NOT EXISTS idx_broker_positions_user    ON public.broker_positions(user_id);

COMMENT ON TABLE public.broker_positions IS 'פוזיציות פתוחות בחשבון broker';

-- ----------------------------------------------------------------------------
-- 7. broker_open_orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_open_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id       UUID NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  order_id                BIGINT NOT NULL,
  position_id             BIGINT,
  tradable_instrument_id  BIGINT,
  symbol                  TEXT,
  side                    TEXT CHECK (side IN ('buy','sell')),
  order_type              TEXT,                       -- market/limit/stop/stoplimit/trailingstop/care
  status                  TEXT,                       -- working/filled/canceled/rejected/...
  quantity                NUMERIC(24,8),
  filled_quantity         NUMERIC(24,8),
  price                   NUMERIC(24,8),
  stop_price              NUMERIC(24,8),
  stop_loss               NUMERIC(24,8),
  take_profit             NUMERIC(24,8),
  trailing_offset         NUMERIC(24,8),
  validity                TEXT,                       -- DAY/GTC/IOC/FOK/GTD
  expire_at               TIMESTAMPTZ,
  user_comment            TEXT,
  placed_at               TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw                     JSONB,

  CONSTRAINT broker_open_orders_unique UNIQUE (broker_account_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_open_orders_account ON public.broker_open_orders(broker_account_id);
CREATE INDEX IF NOT EXISTS idx_broker_open_orders_user    ON public.broker_open_orders(user_id);

COMMENT ON TABLE public.broker_open_orders IS 'פקודות פתוחות (limit/stop/SL/TP) שמסונכרנות מהברוקר';

-- ----------------------------------------------------------------------------
-- 8. broker_executions
--   fills = trades בפועל. הם המקור לעסקאות ב-portfolio_transactions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_executions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id       UUID NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  execution_id            BIGINT NOT NULL,           -- event id ב-Colmex
  order_id                BIGINT,
  position_id             BIGINT,
  tradable_instrument_id  BIGINT,
  symbol                  TEXT,
  side                    TEXT CHECK (side IN ('buy','sell')),
  open_close              TEXT CHECK (open_close IS NULL OR open_close IN ('open','close')),
  quantity                NUMERIC(24,8),
  price                   NUMERIC(24,8),
  commission              NUMERIC(24,8),
  swap                    NUMERIC(24,8),
  realized_pnl            NUMERIC(24,8),
  currency                TEXT,
  executed_at             TIMESTAMPTZ,
  raw                     JSONB,

  -- האם כבר הוטמע ב-portfolio_transactions
  ingested_into_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  portfolio_transaction_id UUID REFERENCES public.portfolio_transactions(id) ON DELETE SET NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT broker_executions_unique UNIQUE (broker_account_id, execution_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_executions_account_time
  ON public.broker_executions(broker_account_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_broker_executions_user
  ON public.broker_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_broker_executions_pending_ingest
  ON public.broker_executions(broker_account_id) WHERE ingested_into_portfolio = FALSE;

COMMENT ON TABLE public.broker_executions IS 'Fills מהברוקר. ingested_into_portfolio=true לאחר העתקה ל-portfolio_transactions';

-- ----------------------------------------------------------------------------
-- 9. broker_statements
--   הפקדות / משיכות / עמלות / דיבידנדים / ריבית.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_statements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id       UUID NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  operation_id            BIGINT NOT NULL,
  operation_type          TEXT,                       -- DEPOSIT/WITHDRAWAL/COMMISSION/DIVIDEND/INTEREST/...
  normalized_type         TEXT CHECK (normalized_type IS NULL OR normalized_type IN
                              ('deposit','withdrawal','fee','dividend','interest','other')),
  amount                  NUMERIC(24,8),
  balance_after           NUMERIC(24,8),
  currency                TEXT,
  description             TEXT,
  symbol                  TEXT,                       -- כשרלוונטי (דיבידנד)
  occurred_at             TIMESTAMPTZ,
  raw                     JSONB,

  ingested_into_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  portfolio_transaction_id UUID REFERENCES public.portfolio_transactions(id) ON DELETE SET NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT broker_statements_unique UNIQUE (broker_account_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_statements_account_time
  ON public.broker_statements(broker_account_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_broker_statements_user
  ON public.broker_statements(user_id);

COMMENT ON TABLE public.broker_statements IS 'הפקדות/משיכות/עמלות/דיבידנדים — מסונכרן מ-/statements';

-- ----------------------------------------------------------------------------
-- 10. broker_sync_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_sync_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  broker_account_id   UUID REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT CHECK (status IN ('success','partial','failed','running')),
  scope               TEXT[],
  error_message       TEXT,
  metrics             JSONB
);

CREATE INDEX IF NOT EXISTS idx_broker_sync_log_user_time
  ON public.broker_sync_log(user_id, started_at DESC);

COMMENT ON TABLE public.broker_sync_log IS 'לוג סנכרון מ-broker — לדיבוג ולמעקב';

-- ============================================================================
-- portfolios: הוספת broker linkage
-- ============================================================================
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','colmex_pro')),
  ADD COLUMN IF NOT EXISTS broker_account_id UUID
    REFERENCES public.broker_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_portfolios_broker_account
  ON public.portfolios(broker_account_id) WHERE broker_account_id IS NOT NULL;

COMMENT ON COLUMN public.portfolios.source IS 'manual = הוזן ידנית, colmex_pro = מסונכרן מ-Colmex Pro';
COMMENT ON COLUMN public.portfolios.read_only IS 'תיקים מסונכרנים – אסור להוסיף transactions ידנית';

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_broker()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_broker_connections_updated_at ON public.broker_connections;
CREATE TRIGGER trg_broker_connections_updated_at
  BEFORE UPDATE ON public.broker_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_broker();

DROP TRIGGER IF EXISTS trg_broker_accounts_updated_at ON public.broker_accounts;
CREATE TRIGGER trg_broker_accounts_updated_at
  BEFORE UPDATE ON public.broker_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_broker();

DROP TRIGGER IF EXISTS trg_broker_account_state_updated_at ON public.broker_account_state;
CREATE TRIGGER trg_broker_account_state_updated_at
  BEFORE UPDATE ON public.broker_account_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_broker();

DROP TRIGGER IF EXISTS trg_broker_positions_updated_at ON public.broker_positions;
CREATE TRIGGER trg_broker_positions_updated_at
  BEFORE UPDATE ON public.broker_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_broker();

DROP TRIGGER IF EXISTS trg_broker_open_orders_updated_at ON public.broker_open_orders;
CREATE TRIGGER trg_broker_open_orders_updated_at
  BEFORE UPDATE ON public.broker_open_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_broker();

-- ============================================================================
-- VIEW: v_broker_portfolio_summary
--   ה-data שמופיע על כרטיס תיק מסונכרן ב-UI (balance/equity/sync status).
-- ============================================================================
CREATE OR REPLACE VIEW public.v_broker_portfolio_summary AS
SELECT
  p.id                          AS portfolio_id,
  p.user_id                     AS user_id,
  p.broker_account_id           AS broker_account_id,
  bc.broker                     AS broker,
  bc.environment                AS environment,
  bc.status                     AS connection_status,
  bc.last_sync_at               AS last_sync_at,
  bc.last_sync_status           AS last_sync_status,
  bc.last_sync_error            AS last_sync_error,
  ba.account_name               AS broker_account_name,
  ba.account_type               AS broker_account_type,
  ba.broker_account_id          AS broker_account_external_id,
  ba.currency                   AS broker_currency,
  bas.balance                   AS balance,
  bas.equity                    AS equity,
  bas.available_funds           AS available_funds,
  bas.margin_used               AS margin_used,
  bas.margin_available          AS margin_available,
  bas.projected_balance         AS projected_balance,
  bas.unrealized_pnl            AS unrealized_pnl,
  bas.realized_pnl_today        AS realized_pnl_today,
  bas.updated_at                AS state_updated_at,
  (SELECT COUNT(*) FROM public.broker_open_orders boo WHERE boo.broker_account_id = ba.id) AS open_orders_count,
  (SELECT COUNT(*) FROM public.broker_positions   bp  WHERE bp.broker_account_id  = ba.id) AS open_positions_count
FROM public.portfolios p
JOIN public.broker_accounts     ba  ON ba.id = p.broker_account_id
JOIN public.broker_connections  bc  ON bc.id = ba.connection_id
LEFT JOIN public.broker_account_state bas ON bas.broker_account_id = ba.id
WHERE p.broker_account_id IS NOT NULL;

COMMENT ON VIEW public.v_broker_portfolio_summary IS 'תיק מסונכרן + מצב חשבון broker אקטואלי';

-- ============================================================================
-- RPC: ingest_broker_executions_to_portfolio
--   מעתיק broker_executions שעדיין לא נטמעו → portfolio_transactions.
--   רץ אחרי כל sync של executions.
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
  v_inserted     INTEGER := 0;
BEGIN
  -- מוצא את התיק המקושר
  SELECT p.id, p.user_id INTO v_portfolio_id, v_user_id
  FROM public.broker_accounts ba
  JOIN public.portfolios p ON p.broker_account_id = ba.id
  WHERE ba.id = p_broker_account_id;

  IF v_portfolio_id IS NULL THEN
    RETURN 0;
  END IF;

  -- מעתיק executions שטרם נטמעו ל-portfolio_transactions (buy/sell)
  WITH new_tx AS (
    INSERT INTO public.portfolio_transactions (
      portfolio_id, user_id, type, symbol, asset_type, exchange,
      quantity, price, commission, currency, date, notes
    )
    SELECT
      v_portfolio_id,
      v_user_id,
      be.side,                                          -- 'buy' / 'sell'
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

COMMENT ON FUNCTION public.ingest_broker_executions_to_portfolio IS
  'מעתיק executions של broker לטבלת portfolio_transactions (idempotent)';

-- ============================================================================
-- RPC: ingest_broker_statements_to_portfolio
--   מעתיק deposits/withdrawals/fees/dividends → portfolio_transactions.
-- ============================================================================
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
  SELECT p.id, p.user_id INTO v_portfolio_id, v_user_id
  FROM public.broker_accounts ba
  JOIN public.portfolios p ON p.broker_account_id = ba.id
  WHERE ba.id = p_broker_account_id;

  IF v_portfolio_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH new_tx AS (
    INSERT INTO public.portfolio_transactions (
      portfolio_id, user_id, type, symbol, amount, currency, date, notes
    )
    SELECT
      v_portfolio_id,
      v_user_id,
      bs.normalized_type,
      CASE WHEN bs.normalized_type = 'dividend' THEN bs.symbol ELSE NULL END,
      ABS(COALESCE(bs.amount, 0)),
      COALESCE(bs.currency, 'USD'),
      COALESCE(bs.occurred_at, NOW()),
      'colmex:op:' || bs.operation_id::TEXT
    FROM public.broker_statements bs
    WHERE bs.broker_account_id = p_broker_account_id
      AND bs.ingested_into_portfolio = FALSE
      AND bs.normalized_type IN ('deposit','withdrawal','fee','dividend')
      AND bs.amount IS NOT NULL AND bs.amount <> 0
      AND (bs.normalized_type <> 'dividend' OR bs.symbol IS NOT NULL)
    RETURNING id, notes
  )
  UPDATE public.broker_statements bs
     SET ingested_into_portfolio = TRUE,
         portfolio_transaction_id = nt.id
    FROM new_tx nt
   WHERE nt.notes = 'colmex:op:' || bs.operation_id::TEXT
     AND bs.broker_account_id = p_broker_account_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.ingest_broker_statements_to_portfolio IS
  'מעתיק statement entries לטבלת portfolio_transactions (idempotent)';

-- ============================================================================
-- RLS - הפעלה והגנות
-- ============================================================================
ALTER TABLE public.broker_connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_instrument_map    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_panel_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_account_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_positions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_open_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_executions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_statements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_sync_log          ENABLE ROW LEVEL SECURITY;

-- broker_connections — owner SELECT/DELETE, INSERT/UPDATE רק ל-service_role
DROP POLICY IF EXISTS broker_connections_owner_select ON public.broker_connections;
CREATE POLICY broker_connections_owner_select ON public.broker_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS broker_connections_owner_delete ON public.broker_connections;
CREATE POLICY broker_connections_owner_delete ON public.broker_connections
  FOR DELETE USING (auth.uid() = user_id);

-- broker_accounts — owner SELECT, write רק service_role
DROP POLICY IF EXISTS broker_accounts_owner_select ON public.broker_accounts;
CREATE POLICY broker_accounts_owner_select ON public.broker_accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS broker_accounts_owner_update_portfolio ON public.broker_accounts;
CREATE POLICY broker_accounts_owner_update_portfolio ON public.broker_accounts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- broker_account_state — owner SELECT בלבד
DROP POLICY IF EXISTS broker_account_state_owner_select ON public.broker_account_state;
CREATE POLICY broker_account_state_owner_select ON public.broker_account_state
  FOR SELECT USING (auth.uid() = user_id);

-- broker_positions / open_orders / executions / statements — owner SELECT בלבד
DROP POLICY IF EXISTS broker_positions_owner_select ON public.broker_positions;
CREATE POLICY broker_positions_owner_select ON public.broker_positions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS broker_open_orders_owner_select ON public.broker_open_orders;
CREATE POLICY broker_open_orders_owner_select ON public.broker_open_orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS broker_executions_owner_select ON public.broker_executions;
CREATE POLICY broker_executions_owner_select ON public.broker_executions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS broker_statements_owner_select ON public.broker_statements;
CREATE POLICY broker_statements_owner_select ON public.broker_statements
  FOR SELECT USING (auth.uid() = user_id);

-- broker_sync_log — owner SELECT
DROP POLICY IF EXISTS broker_sync_log_owner_select ON public.broker_sync_log;
CREATE POLICY broker_sync_log_owner_select ON public.broker_sync_log
  FOR SELECT USING (auth.uid() = user_id);

-- broker_instrument_map / broker_panel_config — קריאה לכל מאומת
DROP POLICY IF EXISTS broker_instrument_map_public_select ON public.broker_instrument_map;
CREATE POLICY broker_instrument_map_public_select ON public.broker_instrument_map
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS broker_panel_config_public_select ON public.broker_panel_config;
CREATE POLICY broker_panel_config_public_select ON public.broker_panel_config
  FOR SELECT TO authenticated USING (TRUE);

-- ============================================================================
-- GRANTs
-- ============================================================================
GRANT SELECT ON public.v_broker_portfolio_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_broker_executions_to_portfolio(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ingest_broker_statements_to_portfolio(UUID) TO authenticated, service_role;

-- ============================================================================
-- realtime — אפשור עדכונים בזמן אמת לטבלאות broker (לקליינט)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_account_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_open_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_connections;

-- ============================================================================
-- Vault helpers
-- ----------------------------------------------------------------------------
-- ב-Edge Functions אנחנו לא יכולים לכתוב ישירות אל schema vault, אז אנחנו
-- מספקים שתי פונקציות SECURITY DEFINER:
--   broker_upsert_vault_secret  – שמירה/עדכון של secret מוצפן (service_role only)
--   broker_get_vault_secret     – קריאה של secret (service_role only)
-- שתיהן REVOKE לכלל המאומתים, אך GRANT EXECUTE ל-service_role כדי לאפשר
-- ל-Edge Functions להשתמש בהן.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.broker_upsert_vault_secret(
  p_name        TEXT,
  p_secret      TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN
    SELECT vault.create_secret(p_secret, p_name, COALESCE(p_description, ''))
      INTO v_id;
  ELSE
    PERFORM vault.update_secret(v_id, p_secret, p_name, COALESCE(p_description, ''));
  END IF;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broker_upsert_vault_secret(TEXT, TEXT, TEXT) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.broker_upsert_vault_secret(TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.broker_upsert_vault_secret IS
  'Edge Function helper: upsert secret ב-vault.secrets. service_role only.';

CREATE OR REPLACE FUNCTION public.broker_get_vault_secret(
  p_name TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = p_name
   LIMIT 1;
  RETURN v_secret;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broker_get_vault_secret(TEXT) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.broker_get_vault_secret(TEXT) TO service_role;

COMMENT ON FUNCTION public.broker_get_vault_secret IS
  'Edge Function helper: שליפה של secret ממוצפן מ-vault.secrets. service_role only.';

CREATE OR REPLACE FUNCTION public.broker_delete_vault_secret(
  p_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM vault.secrets WHERE id = v_id;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broker_delete_vault_secret(TEXT) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.broker_delete_vault_secret(TEXT) TO service_role;

COMMENT ON FUNCTION public.broker_delete_vault_secret IS
  'Edge Function helper: מחיקה של secret מ-vault.secrets. service_role only.';
