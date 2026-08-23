-- CardCom Compliance Sprint 1
-- 1) Singleton CardCom config (RLS: no authenticated access)
-- 2) Extra payment_transactions columns + LowProfile index
-- 3) Token columns on user_subscriptions (required for renew)

-- ---------------------------------------------------------------------------
-- cardcom_config (singleton row id=1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cardcom_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  api_name text NOT NULL DEFAULT 'CardTest1994',
  api_password text NOT NULL DEFAULT '',
  terminal_number integer NOT NULL DEFAULT 1000,
  -- Compliance admin options. Recurring charge+token uses Operation "2" at Create time
  -- (documented in edge create-payment). See COMMENT below.
  operation text NOT NULL DEFAULT 'ChargeOnly'
    CHECK (operation IN ('ChargeOnly', 'CreateTokenOnly')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

COMMENT ON TABLE public.cardcom_config IS
  'CardCom gateway secrets — service_role / admin-api only. Never expose to clients.';
COMMENT ON COLUMN public.cardcom_config.operation IS
  'Admin UI value: ChargeOnly | CreateTokenOnly. For recurring subscriptions the edge Create path may send CardCom Operation "2" (ChargeAndCreateToken) so auto_renew tokens keep working until deferred-charge (Task 7) ships.';

ALTER TABLE public.cardcom_config ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → denied by default under RLS.
-- service_role bypasses RLS.
REVOKE ALL ON TABLE public.cardcom_config FROM PUBLIC;
REVOKE ALL ON TABLE public.cardcom_config FROM anon;
REVOKE ALL ON TABLE public.cardcom_config FROM authenticated;
GRANT ALL ON TABLE public.cardcom_config TO service_role;

-- ---------------------------------------------------------------------------
-- payment_transactions — CardCom order fields (all nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS cardcom_operation text,
  ADD COLUMN IF NOT EXISTS cardcom_response_code text,
  ADD COLUMN IF NOT EXISTS cardcom_description text,
  ADD COLUMN IF NOT EXISTS cardcom_document_type text,
  ADD COLUMN IF NOT EXISTS cardcom_document_number integer,
  ADD COLUMN IF NOT EXISTS cardcom_token text,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_year integer,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_month integer,
  ADD COLUMN IF NOT EXISTS cardcom_token_token_approval_number text,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_owner_identity_number text;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_low_profile_id
  ON public.payment_transactions (cardcom_low_profile_id);

COMMENT ON COLUMN public.payment_transactions.status IS
  'pending | success | failed | pending_charge | refunded | cancelled. Mapping: ChargeOnly/"2"+ResponseCode=0→success; CreateTokenOnly+ResponseCode=0→pending_charge; ResponseCode≠0→failed; refund (Task 6)→refunded.';
COMMENT ON COLUMN public.payment_transactions.cardcom_description IS
  'CardCom Description — admin/log only. Never show to buyers.';
COMMENT ON COLUMN public.payment_transactions.cardcom_low_profile_id IS
  'CardCom LowProfileId — sole key for webhook order matching (do not use ReturnValue).';

-- ---------------------------------------------------------------------------
-- user_subscriptions — token fields for auto_renew (were missing in prod)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS cardcom_token text,
  ADD COLUMN IF NOT EXISTS cardcom_token_exp_date timestamptz,
  ADD COLUMN IF NOT EXISTS card_last4_digits text,
  ADD COLUMN IF NOT EXISTS card_brand text;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_token
  ON public.user_subscriptions (cardcom_token)
  WHERE cardcom_token IS NOT NULL;

COMMENT ON COLUMN public.user_subscriptions.cardcom_token IS
  'CardCom Token for recurring charges (from GetLpResult TokenInfo).';
