# sync-insider-buys — רכישות בכירים (sec-api + Form4API + Unusual Whales)

מקורות ל-`dark_pool_insider_buys`:


| מקור               | מה נשמר                                                 | Secrets                  |
| ------------------ | ------------------------------------------------------- | ------------------------ |
| **sec-api.io**     | רכישות P (Form 4)                                       | `SEC_API_KEY`            |
| **Form4API**       | רכישות **P + מכירות S**, returns, 10b5, cluster signals | `FORM4_API_KEY`          |
| **Unusual Whales** | פיד P + תמונות בכירים                                   | `UNUSUAL_WHALES_API_KEY` |


Client משותף: `_shared/form4api.ts` — transactions, insiders, companies, filings, signals (402 = graceful skip).

## Secrets

```bash
npx supabase secrets set INSIDER_SYNC_SOURCES=secapi,form4api,unusualwhales

npx supabase secrets set SEC_API_KEY=<מפתח>
npx supabase secrets set FORM4_API_KEY=<מפתח>
npx supabase secrets set FORM4_PROVIDER=form4api
npx supabase secrets set FORM4_LOOKBACK_HOURS=168
npx supabase secrets set FORM4_MAX_PAGES=10
npx supabase secrets set FORM4_EXCLUDE_10B5=true

npx supabase secrets set UNUSUAL_WHALES_API_KEY=<מפתח>
npx supabase secrets set UW_CLIENT_API_ID=100001
```

## מיגרציה 046

עמודות חדשות ב-`dark_pool_insider_buys`: `is_10b5_plan`, `shares_owned_after`, `return_1d`…`return_6m`  
טבלה: `dark_pool_insider_signals` (cluster buy/sell מ-Form4API).

## פריסה

```bash
npx supabase functions deploy sync-insider-buys --no-verify-jwt
npx supabase functions deploy uw-investor-profile --no-verify-jwt
npx supabase functions deploy uw-investor-search --no-verify-jwt
npx supabase functions deploy uw-ticker-insights --no-verify-jwt
```

## Cron מומלץ

כל **שעה** בשעות מסחר: `0 * * * `*

## בדיקה ידנית

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-insider-buys" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

תשובה:

```json
{
  "inserted": N,
  "from_secapi": S,
  "from_form4": F,
  "from_uw": U,
  "avatars_enriched": M,
  "signals_synced": K,
  "sources": ["secapi","form4api","unusualwhales"]
}
```

דיבאג לטיקר: `{"debug":true,"ticker":"NVDA"}`

## Form4API — שימוש מלא בפרויקט


| Endpoint                                   | שימוש                                         |
| ------------------------------------------ | --------------------------------------------- |
| `GET /v1/transactions`                     | sync P+S, ticker insights                     |
| `GET /v1/insiders?name=`                   | `uw-investor-search`                          |
| `GET /v1/insiders/{cik}` + `/transactions` | `uw-investor-profile` — היסטוריה 5y + metrics |
| `GET /v1/companies/{ticker}`               | sector enrichment + ticker screen             |
| `GET /v1/companies/{ticker}/insiders`      | roster חברה                                   |
| `GET /v1/signals`                          | cluster → `dark_pool_insider_signals`         |
| `GET /v1/signals/sentiment/{ticker}`       | כרטיס סנטימנט במסך טיקר                       |
| `GET /v1/filings/recent`                   | זמין ב-client (לא מחובר עדיין ל-UI)           |


**Business plan בלבד (402):** form144, holdings — מדולגים ב-graceful.

- תיעוד: [https://form4api.com/docs](https://form4api.com/docs)
- אימות: כותרת `X-Api-Key`

`sync-darkpool` **לא נדרש** (`DARK_POOL_FORM4_ONLY=false`).