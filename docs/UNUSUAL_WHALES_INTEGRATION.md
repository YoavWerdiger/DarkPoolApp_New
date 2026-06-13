# Unusual Whales — מפת שימוש בפרויקט

מנוי UW (~$150/חודש API Basic) מנוצל ב-**שלוש שכבות**: סנכרון ל-DB (פרודקשן), Edge Functions, ו-MCP לפיתוח ב-Cursor.

תיעוד רשמי: [api.unusualwhales.com/docs](https://api.unusualwhales.com/docs)

---

## Quiver Quantitative (קונגרס — ברירת מחדל)

```bash
npx supabase secrets set QUIVER_API_KEY=<מפתח>
npx supabase secrets set CONGRESS_TRADES_PROVIDER=quiverquant
```

Endpoints: `/beta/live/congresstrading`, `/beta/bulk/congress/politicians`

---

## 0. לקוח משותף (`supabase/functions/_shared/unusualWhales.ts`)

כל הקריאות ל-UW עוברות דרך `uwGet` + כותרות `Authorization` + `UW-CLIENT-API-ID`.

| נתיב רשמי | פונקציה | שימוש |
|-----------|---------|--------|
| `GET /api/congress/unusual-trades` | `fetchUwCongressUnusualTrades` | גילוי — עסקאות חריגות בקונגרס |
| `GET /api/congress/unusual-trades/by-tickers` | `fetchUwCongressUnusualByTickers` | סינון לפי טיקרים |
| `GET /api/congress/unusual-trades/chart-data` | `fetchUwCongressUnusualChartData` | גרף unusual trades |
| `GET /api/congress/unusual-trades/stats` | `fetchUwCongressUnusualStats` | סטטיסטיקות |
| `GET /api/congress/recent-trades` | `fetchUwCongressRecent` | גילוי, מעקב, סנכרון |
| `GET /api/politician-portfolios/recent_trades` | `fetchUwPoliticianTrades` | פרופיל פוליטיקאי לפי `politician_id` |
| `GET /api/congress/politicians` | `fetchUwPoliticians` | גילוי — רשימת פוליטיקאים |
| `GET /api/insider/transactions` | `fetchUwInsiderTransactions` | סנכרון insider + גילוי |
| `GET /api/insider/{ticker}` | `fetchUwInsidersForTicker` | רוסטר + לוגואים |
| `GET /api/insider/{ticker}/ticker-flow` | `fetchUwInsiderTickerFlow` | פרופיל בכיר, מסך טיקר |
| `GET /api/insider/{sector}/sector-flow` | `fetchUwInsiderSectorFlow` | זמין — סקטור (עתידי) |
| `GET /api/darkpool/recent` | `fetchUwDarkpoolRecent` | `sync-darkpool` |
| `GET /api/darkpool/{ticker}` | `fetchUwDarkpoolByTicker` | `uw-ticker-insights` |

---

## 1. פרודקשן (Supabase)

| יכולת | Endpoint UW | Edge Function | יעד |
|--------|-------------|---------------|------|
| רכישות בכירים | `insider/transactions` | `sync-insider-buys` | `dark_pool_insider_buys` |
| תמונות בכירים | `insider/{ticker}` | `sync-insider-buys` | `insider_logo_url` |
| Dark Pool | `darkpool/recent` | `sync-darkpool` | `dark_pool_trades` |
| גילוי | congress + unusual + insider + market-tide | `uw-explore` | JSON לאפליקציה |
| פרופיל | `politician-portfolios` + `insider/ticker-flow` | `uw-investor-profile` | holdings + sparkline |
| טיקר | news, GEX, flow, insider, **ticker-flow**, **darkpool/{ticker}** | `uw-ticker-insights` | cache 5 דק׳ |
| מעקב | congress + insider לפי follow | `uw-following-feed` | JSON |
| סיגנלים | flow-alerts, market-tide | `uw-signals` | JSON |

### Secrets

```bash
npx supabase secrets set UNUSUAL_WHALES_API_KEY=<מפתח>
npx supabase secrets set UW_CLIENT_API_ID=100001
npx supabase secrets set INSIDER_SYNC_SOURCES=form4api,unusualwhales
npx supabase secrets set DARK_POOL_PROVIDER=unusualwhales
```

### פריסה (אחרי שינוי `_shared`)

```bash
npx supabase functions deploy sync-congress-trades uw-congress-feed uw-explore sync-insider-buys sync-darkpool uw-investor-profile uw-following-feed uw-insider-feed uw-signals uw-ticker-insights --no-verify-jwt
```

### בדיקה

```bash
curl -X POST "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/sync-insider-buys" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'

curl -X POST "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/uw-explore" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{}'
```

---

## 2. Cron

| Job | תדירות | פונקציה |
|-----|---------|---------|
| `sync-insider-buys-hourly` | שעה | Form4 + UW → insider buys |
| `sync-darkpool-5m` | 5 דק׳ | UW → `dark_pool_trades` |

---

## 3. אפליקציה

| דגל | ערך נוכחי | משמעות |
|-----|-----------|---------|
| `DARK_POOL_FORM4_ONLY` | `false` | גם סיגנלים, whale, dark pool מה-DB |
| `DARK_POOL_INSIDER_UW_ONLY` | `false` | גם Form4 בפיד insider |

האפליקציה קוראת **רק** ל-Edge Functions — לא ל-UW ישירות.

---

## 4. MCP (פיתוח)

```json
{
  "mcpServers": {
    "unusual-whales": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://api.unusualwhales.com/api/mcp",
        "--header", "Authorization: Bearer YOUR_API_KEY",
        "--header", "UW-CLIENT-API-ID: 100001"
      ]
    }
  }
}
```

---

## 5. עדיין לא ב-UI (זמין ב-API)

| Endpoint | הערה |
|----------|------|
| `unusual-trades/by-tickers` | לסינון גילוי לפי watchlist |
| `unusual-trades/chart-data` | sparkline בגילוי |
| `unusual-trades/stats` | כרטיס סיכום |
| `insider/{sector}/sector-flow` | תצוגת סקטור |

---

## 6. מגבלות

- מכסת API: [usage dashboard](https://unusualwhales.com/information/how-to-check-your-api-usage)
- `uw-ticker-insights` — השהיות ~400ms בין קריאות (rate limit)
- לוגואים insider — לא לכל בכיר
