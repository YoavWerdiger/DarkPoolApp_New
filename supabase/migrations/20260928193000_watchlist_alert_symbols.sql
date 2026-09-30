-- מתגים ב«לפי הבחירה שלי» ברשימת מעקב.
-- NULL = כל הטיקרים דלוקים. מערך = רק הסימולים שהמתג שלהם דלוק.

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS watchlist_alert_symbols text[];

COMMENT ON COLUMN public.user_notification_settings.watchlist_alert_symbols IS
  'NULL = התראות על כל רשימת המעקב. מערך = הסימולים עם מתג דלוק.';
