# sync-darkpool — Dark Pool Intelligence Pipeline

ה-Edge Function הזה רץ כל 30 שניות וסונכרן הדפסות Dark Pool מהספק הפעיל אל
טבלת `dark_pool_trades`, מעדכן `dark_pool_daily_aggregates` ומריץ את מנוע
ה-Signals (`dark_pool_signals`).

## Secrets נדרשים (אחד מהם חובה)

```bash
# בחר ספק:
npx supabase secrets set DARK_POOL_PROVIDER=polygon    # default
# או
npx supabase secrets set DARK_POOL_PROVIDER=unusualwhales
# או
npx supabase secrets set DARK_POOL_PROVIDER=intrinio

# מפתחות API לפי הספק שנבחר:
npx supabase secrets set POLYGON_API_KEY=...           # ל-polygon
npx supabase secrets set UNUSUAL_WHALES_API_KEY=...    # ל-unusualwhales
npx supabase secrets set INTRINIO_API_KEY=...          # ל-intrinio
```

## פריסה

```bash
npx supabase functions deploy sync-darkpool --no-verify-jwt
npx supabase functions deploy dark-pool-alerts --no-verify-jwt
npx supabase functions deploy sync-insider-buys --no-verify-jwt
```

## תזמון (Cron)

הרצה כל 30 שניות (Supabase UI → Functions → Schedule):

| Function           | Cron expression       | Frequency          |
| ------------------ | --------------------- | ------------------ |
| `sync-darkpool`    | `*/30 * * * * *`*     | כל 30 שניות        |
| `dark-pool-alerts` | `* * * * *`           | כל דקה             |
| `sync-insider-buys`| `0 */6 * * *`         | כל 6 שעות          |

\* Supabase מקבלים גם cron syntax עם seconds. ב-Dashboard בחרו "Every 30 seconds".

## טבלאות שהפונקציות נוגעות בהן

- `dark_pool_trades` (insert)
- `dark_pool_daily_aggregates` (upsert)
- `dark_pool_signals` (upsert)
- `dark_pool_provider_state` (upsert)
- `dark_pool_alerts_log` (insert)
- `dark_pool_insider_buys` (insert)
- `device_tokens` (read)
- `user_subscriptions` (read)
- `dark_pool_watchlists` (read)

## בדיקות מקומיות

```bash
# Type-check
npm run typecheck

# Unit tests (54 בדיקות לליבה של Dark Pool)
npx jest __tests__/darkpool

# הרצה ידנית (לאחר deploy):
curl -X POST "https://<project>.functions.supabase.co/sync-darkpool" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## תגובות

`sync-darkpool` מחזיר:

```json
{ "inserted": 42, "signals": 5, "ms": 1840 }
```

`dark-pool-alerts` מחזיר:

```json
{ "sent": 12, "pending": 12 }
```
