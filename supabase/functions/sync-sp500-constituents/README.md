# sync-sp500-constituents

Edge Function שמסנכרן את רכיבי **S&P 500** מ-EODHD לטבלה
`public.sp500_constituents`. הטריגר ב-`earnings_calendar` קורא לטבלה הזאת
ומסנן אוטומטית כל סנכרון של דיווחי רווח כך שיכנסו רק חברות SP500.

## פריסה ראשונית (one-time)

### 1. הרצת המיגרציה

```bash
supabase db push
# או, אם זה לוקלי:
psql "$DATABASE_URL" -f supabase/migrations/025_sp500_constituents.sql
```

### 2. וידוא שיש EODHD_API_KEY

```bash
supabase secrets list
# אם חסר:
supabase secrets set EODHD_API_KEY=<your-key>
```

### 3. פריסת הפונקציה

```bash
supabase functions deploy sync-sp500-constituents
```

### 4. הרצה ראשונה (seed)

```bash
curl -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/sync-sp500-constituents" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

התוצאה אמורה להיראות:
```json
{
  "success": true,
  "synced": 503,
  "stale_removed": 0,
  "earnings_cleanup_deleted": 12450,
  "timestamp": "2026-05-15T..."
}
```

`earnings_cleanup_deleted` הוא מספר השורות הלא-SP500 שנמחקו מ-`earnings_calendar`.

## תזמון שבועי (pg_cron)

אחרי ההרצה הראשונה, להפעיל cron שבועי. ב-SQL Editor של Supabase:

```sql
-- כל יום ראשון ב-03:00 UTC
SELECT cron.schedule(
  'sync_sp500_constituents_weekly',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-sp500-constituents',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

## איך זה עובד

1. **טבלה `sp500_constituents`** — מכילה את ~500 הסמלים העדכניים.
2. **טריגר `earnings_calendar_sp500_filter`** — רץ `BEFORE INSERT/UPDATE`
   על `earnings_calendar`. אם הסמל לא נמצא ב-`sp500_constituents`, הטריגר
   מחזיר `NULL` והשורה מתעלמת. בלי להיכשל, בלי שגיאה — פשוט לא נכנסת.
3. **ניקוי חד-פעמי** — `cleanup_non_sp500_earnings()` מנקה שורות שכבר
   ב-DB (מ-syncs קודמים). נקרא אוטומטית בסוף הפונקציה הזאת.

## פאיל-אופן

אם הטבלה `sp500_constituents` ריקה, הטריגר מאפשר הכל. זה מבטיח שאם
הסנכרון עוד לא רץ פעם ראשונה, סקריפטי ה-sync של הדיווחים לא ייכשלו.

## ביטול הסינון

```sql
DROP TRIGGER IF EXISTS earnings_calendar_sp500_filter ON public.earnings_calendar;
```
