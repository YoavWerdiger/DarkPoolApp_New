# sync-insider-buys — רכישות בכירים (sec-api + Form4API + Unusual Whales)

מקורות ל-`dark_pool_insider_buys`:


| מקור               | מה נשמר                                                 | Secrets                  |
| ------------------ | ------------------------------------------------------- | ------------------------ |
| **sec-api.io**     | רכישות P (Form 4)                                       | `SEC_API_KEY`            |
| **Form4API**       | רכישות **P + מכירות S**, returns, 10b5, cluster signals | `FORM4_API_KEY`          |
| **Unusual Whales** | פיד P + תמונות בכירים                                   | `UNUSUAL_WHALES_API_KEY` |


Client משותף: `_shared/form4api.ts` — transactions, insiders, companies, filings, signals (402 = graceful skip).

## Secrets (פרודקשן — תקציב Form4 << 500/יום)

```bash
npx supabase secrets set INSIDER_SYNC_SOURCES=edgar,form4api

npx supabase secrets set FORM4_API_KEY=<מפתח>
npx supabase secrets set FORM4_PROVIDER=form4api
# שוטף: lookback קצר + מעט עמודות — ~8–15 req לריצה × 3–4 ריצות/יום
npx supabase secrets set FORM4_LOOKBACK_HOURS=48
npx supabase secrets set FORM4_MAX_PAGES=5
npx supabase secrets set FORM4_EXCLUDE_10B5=true
# Backfill עמוק — ידני/שבועי בלבד (לא ב-cron):
# FORM4_LOOKBACK_HOURS=2160 FORM4_MAX_PAGES=12
# פרופיל: PROFILE_RECENT_TRADES_LIMIT=50 | PORTFOLIO_SNAPSHOT_FRESH_HOURS=24
```

## Cron (אחרי מיגרציית snapshots)

| Job | Schedule (UTC) | הערה |
|-----|----------------|------|
| `sync-insider-buys-market-hours` | `0 13,17,21 * * 1-5` | 3× בשעות מסחר US |
| `sync-insider-buys-weekend` | `0 16 * * 0,6` | catch-up סופ״ש |
| `materialize-darkpool-portfolios-hot` | `15 14-21 * * 1-5` | Yahoo batch → snapshots |
| `materialize-darkpool-portfolios-daily` | `30 2 * * *` | full curated |

**לא** לרוץ שעתי עם lookback 14 יום — שורף את מכסת Form4.

## פריסה

```bash
npx supabase functions deploy sync-insider-buys --no-verify-jwt
npx supabase functions deploy materialize-darkpool-portfolios --no-verify-jwt
npx supabase functions deploy uw-investor-profile --no-verify-jwt
npx supabase functions deploy uw-fund-profile --no-verify-jwt
```

## בדיקה ידנית

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-insider-buys" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/materialize-darkpool-portfolios" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'
```

## ארכיטקטורת פרופיל

- **Form4** רק ב-cron → `dark_pool_insider_buys`
- **Yahoo + שחזור גרף/תשואות** ב-`materialize-darkpool-portfolios` → `dark_pool_person_portfolio_snapshots`
- **פתיחת פרופיל** = קריאת snapshot (+ עסקאות אחרונות מ-DB). אין Form4 חי.

דיוק:
- קונגרס: אין מניות מזויפות; entry = Yahoo@first_added
- Form4: cost/qty כש-`basis_reliable`
- 13F: Yahoo@first_added
