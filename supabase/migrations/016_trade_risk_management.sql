-- ============================================================================
-- 016_trade_risk_management.sql
-- הוספת שדות ניהול סיכון ואסטרטגיה לטבלת trades
-- stop_loss, target_price, strategy_name
-- ============================================================================

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS target_price NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS strategy_name TEXT;

COMMENT ON COLUMN public.trades.stop_loss IS 'מחיר סטופ לוס';
COMMENT ON COLUMN public.trades.target_price IS 'מחיר יעד (Target)';
COMMENT ON COLUMN public.trades.strategy_name IS 'שם האסטרטגיה (חופשי, לפי המשתמש)';
