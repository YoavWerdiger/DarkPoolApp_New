# Unusual Whales — מפת שימוש בפרויקט

מנוי UW (~$150/חודש API Basic) מנוצל ב-**שלוש שכבות**: סנכרון ל-DB (פרודקשן), Edge Functions, ו-MCP לפיתוח ב-Cursor.

תיעוד רשמי: [api.unusualwhales.com/docs](https://api.unusualwhales.com/docs)

---

## Quiver Quantitative (קונגרס — ברירת מחדל / Trader)

```bash
# אל תדביקו מפתח בצ'אט — רק ב-Supabase secrets:
npx supabase secrets set QUIVER_API_KEY=<מפתח>
npx supabase secrets set CONGRESS_TRADES_PROVIDER=quiverquant
```

### Cheat sheet — endpoint → תפקיד → שימוש אצלנו

| Endpoint | תפקיד | סטטוס |
|----------|--------|--------|
| `GET /beta/bulk/congress/politicians` | מטא־דאטה (BioGuideID, Name, Party, Chamber, TradeCount, LastTraded) | **טוב** — cache יומי `quiver_congress_politicians` + דירוג TradeCount |
| `GET /beta/bulk/congresstrading?bioguide_id=` | היסטוריית עסקאות מלאה לפוליטיקאי | **טוב** — מקור ראשי ל־deep history של מאוצרים (`bulkMaxPages` עד 20) |
| `GET /beta/live/congresstrading` | פיד עסקאות אחרונות | **טוב** — `sync-congress-trades` + `uw-explore` |
| `GET /beta/live/congress_stock_holdings?bioguide_id=` | אחזקות מוערכות לפרופיל | **טוב** — cache יומי לכל המאוצרים (מיזוג עם cache קיים) |
| `GET /beta/live/insiders` | רכישות בכירים | **טוב** — `sync-insider-buys` |
| `GET /beta/live/sec13f?owner=` | אחזקות 13F לפי קרן | **טוב** — `sync-fund-13f` (curated owners) |
| `GET /beta/live/sec13fchanges` | שינויי 13F | **טוב** — עם `owner=` לקרנות מאוצרות |
| `GET /beta/bulk/trumpstocktrades` | עסקאות טראמפ (Filed/Traded/Amount/ExcessReturn) | **טוב** — executive curated (`888dc73f-…`), לא STOCK Act / לא BioGuide |
| `GET /beta/live/offexchange` | Dark pool יומי (DPI) | **טוב** — כש־`DARK_POOL_PROVIDER=quiverquant` |
| `GET /beta/historical/offexchange/{ticker}` | היסטוריית off-exchange | **בשימוש** — העשרת טיקרים ב־sync-darkpool |
| `GET /beta/historical/congresstrading/{ticker}` | היסטוריה לפי טיקר | **אופציונלי** — `enrich_tickers:true` (טיקרים מ־bulk) |
| `GET /beta/historical/housetrading/{ticker}` | House לפי טיקר | **אופציונלי** — רק עם `include_chambers:true` |
| `GET /beta/historical/senatetrading/{ticker}` | Senate לפי טיקר | **אופציונלי** — רק עם `include_chambers:true` |

כלל ברזל לפרופיל מאוצר:
1. מטא־דאטה ← `politicians` (cache) — **לא חל על טראמפ**
2. היסטוריית עסקאות ← `bulk/congresstrading?bioguide_id=` — **טראמפ:** `bulk/trumpstocktrades`
3. אחזקות ← `congress_stock_holdings?bioguide_id=` — אין holdings endpoint ייעודי לטראמפ
4. historical לפי טיקר ← רק העשרה, לא תחליף ל־bulk

בפרופיל: רשימת «עסקאות אחרונות» מציגה **Filed** (תאריך דיווח), כמו בדוקס Quiver; שחזור תיק משתמש ב־**Traded**.

Cron: `sync-congress-trades` (~*/20m) מושך live קונגרס + (ב־deep) **קודם** trumpstocktrades ואז bulk לפי BioGuide.
`sync-quiver-congress-cache` יומי = politicians/holdings בלבד — **לא** מחליף trumpstocktrades.

פריסה אחרי שינוי Quiver:

```bash
npx supabase functions deploy sync-quiver-congress-cache sync-congress-trades uw-explore uw-investor-profile --no-verify-jwt
```

UI: שורת «עדכון נתונים» + קישור attribution «Data provided by the Quiver API»
בפיד קונגרס / בית / גילוי / פרופיל (`QuiverAttribution`) — כולל תדירות סנכרון ומקור.

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

מקור אמת מלא (כולל Quiver): [`DARK_POOL_DATA_SYNC.md`](./DARK_POOL_DATA_SYNC.md).

| Job | תדירות (UTC) | פונקציה |
|-----|--------------|---------|
| `sync-congress-trades-20m` | כל 20 דק׳ | Quiver → `dark_pool_congress_trades` |
| `sync-insider-buys-market-hours` | `13/17/21` ימי מסחר | Quiver + Form4/SEC → insider buys |
| `sync-insider-buys-weekend` | `16` UTC סופ״ש | catch-up |
| `sync-quiver-congress-cache-daily` | `06:15` | politicians + holdings |
| `sync-fund-13f-daily` | `06:00` | 13F קרנות |
| `sync-darkpool-5m` | כל 5 דק׳ | ספק → `dark_pool_trades` (כשמופעל) |

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
