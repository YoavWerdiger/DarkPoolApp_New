-- ============================================================
-- 020: Subscription security hardening
-- ============================================================

-- ============================================================
-- RLS on user_subscriptions
-- ============================================================
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions"   ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Service role full access"           ON public.user_subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role (Edge Functions / webhooks) may INSERT/UPDATE/DELETE
CREATE POLICY "Service role full access"
  ON public.user_subscriptions FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- Idempotency: add cardcom_transaction_id unique index
-- Prevents duplicate subscription grants from double webhooks
-- ============================================================
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS cardcom_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_cardcom_txn
  ON public.payment_transactions(cardcom_transaction_id)
  WHERE cardcom_transaction_id IS NOT NULL;

-- ============================================================
-- Prevent double subscription extension for same payment
-- ============================================================
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS source_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_source_txn
  ON public.user_subscriptions(source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;
