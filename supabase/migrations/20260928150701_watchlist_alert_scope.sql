-- היקף התראות רשימת מעקב: הכול, או רק הטיקרים שברשימה החיה.
-- בלי עמודת סימולים כפולה — הבחירה היא stock_watchlist_items.
-- מי שהקטגוריה אצלו כבויה לא מקבל ברירת מחדל של «הכול».

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS watchlist_alert_scope text;

UPDATE public.user_notification_settings
SET watchlist_alert_scope = CASE
  WHEN watchlist_notifications IS FALSE THEN 'selected'
  ELSE 'all'
END
WHERE watchlist_alert_scope IS NULL;

ALTER TABLE public.user_notification_settings
  ALTER COLUMN watchlist_alert_scope SET DEFAULT 'all';

UPDATE public.user_notification_settings
SET watchlist_alert_scope = 'all'
WHERE watchlist_alert_scope IS NULL;

ALTER TABLE public.user_notification_settings
  ALTER COLUMN watchlist_alert_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_notification_settings_watchlist_alert_scope_chk'
  ) THEN
    ALTER TABLE public.user_notification_settings
      ADD CONSTRAINT user_notification_settings_watchlist_alert_scope_chk
      CHECK (watchlist_alert_scope IN ('all', 'selected'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_notification_settings.watchlist_alert_scope IS
  'הכול = כל התראות הרשימה. לפי הבחירה שלי = הטיקרים שהמתג שלהם דלוק.';
