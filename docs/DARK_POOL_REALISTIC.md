# Dark Pool — מסלול realistic (בלי Enterprise)

מוצר: **עסקאות + פעילות + תשואה מוערכת** — לא «תיק אמיתי» מ-UW/Quiver Enterprise.

> **עדכון נתונים / למה לא realtime:** מסמך מפורט — [`DARK_POOL_DATA_SYNC.md`](./DARK_POOL_DATA_SYNC.md)
> (pull מול webhook, טבלת cron, משיכה למטה = DB בלבד, השהיית STOCK Act).

## ארכיטקטורה

```
Cron / Refresh (אין webhooks מ-Quiver)
  sync-congress-trades (~*/20m)     → dark_pool_congress_trades  (Quiver live)
  sync-insider-buys (3× יום מסחר)   → dark_pool_insider_buys     (Quiver + Form4/SEC)
  sync-quiver-congress-cache (יומי) → politicians + holdings cache
  sync-fund-13f (יומי)              → אחזקות קרנות מאוצרות
  sync-darkpool (*/5m)              → עסקאות dark pool (כשמופעל)

App
  פיד קונגרס     ← dark_pool_congress_trades
  פיד בכירים     ← dark_pool_insider_buys
  פרופיל פוליטיקאי ← snapshots + Quiver holdings cache
  פרופיל בכיר    ← snapshots מ-DB
  גילוי          ← uw-explore / DB
  pull-to-refresh ← קריאה מחדש מה-DB (לא מפעיל Quiver sync ב־SEC production)
```

## Secrets (Supabase)

```bash
# קונגרס — Quiver Trader (מומלץ)
npx supabase secrets set QUIVER_API_KEY=<מפתח>   # אל תדביקו בצ'אט
npx supabase secrets set CONGRESS_TRADES_PROVIDER=quiverquant

# גיבוי / darkpool / insiders photos (אופציונלי)
UNUSUAL_WHALES_API_KEY=...

# בכירים — Quiver live/insiders כמקור ראשי (+ EDGAR/Form4 גיבוי)
INSIDER_SYNC_SOURCES=quiverquant,edgar,form4api
QUIVER_API_KEY=...   # אל תדביקו בצ'אט
SEC_API_KEY=...
FORM4_API_KEY=...

# מחירים (כבר קיים)
FINNHUB_API_KEY=...
```

## Deploy Edge Functions

```bash
npx supabase functions deploy sync-congress-trades sync-quiver-congress-cache \
  sync-insider-buys uw-politician-metrics uw-investor-profile uw-explore uw-congress-feed \
  --no-verify-jwt --project-ref wpmrtczbfcijoocguime
```

## Cron (pg_cron — מקור אמת במיגרציות)

פירוט מלא + הסבר «למה לא realtime»: [`DARK_POOL_DATA_SYNC.md`](./DARK_POOL_DATA_SYNC.md).

| Job | Schedule (UTC) | Invoke |
|-----|----------------|--------|
| קונגרס | `*/20 * * * *` | `sync-congress-trades` (Quiver live) |
| בכירים | `0 13,17,21 * * 1-5` + `0 16 * * 0,6` | `sync-insider-buys` |
| Quiver politicians/holdings | `15 6 * * *` | `sync-quiver-congress-cache` |
| 13F קרנות | `0 6 * * *` | `sync-fund-13f` |
| Dark pool | `*/5 * * * *` | `sync-darkpool` (כש־provider מוגדר) |

Header: `Authorization: Bearer <SERVICE_ROLE_KEY>`

## הרצה ידנית ראשונה

```bash
SERVICE_KEY=$(npx supabase projects api-keys --project-ref wpmrtczbfcijoocguime -o json | python3 -c "import sys,json; d=json.load(sys.stdin); print(next(x['api_key'] for x in d if x.get('name')=='service_role'))")

curl -X POST "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/sync-congress-trades" \
  -H "Authorization: Bearer $SERVICE_KEY"

curl -X POST "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/sync-insider-buys" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

## UX באפליקציה

| מסך | מה מציג |
|-----|---------|
| **בית / פיד → קונגרס** | עסקאות STOCK Act מ־Quiver (~כל 20 ד׳) + טראמפ מ־`trumpstocktrades` |
| **בית / פיד → בכירים** | רכישות מ־Quiver + Form 4 (3× ביום מסחר) |
| **גילוי** | אנשים — מטא־דאטה/אחזקות cache יומי |
| **פרופיל פוליטיקאי** | תשואה מוערכת + אחזקות Quiver (לא net worth) |
| **פרופיל בכיר** | היסטוריית רכישות מ-DB |

ב־UI: שורת «עדכון נתונים» (`QuiverAttribution`) מסבירה תדירות + מקור — לא realtime.
ראו גם [`DARK_POOL_DATA_SYNC.md`](./DARK_POOL_DATA_SYNC.md).

## לפני App Store

- וודא **commercial use** ב-ToS של sec-api.io ו-UW Basic (מומלץ מייל לתמיכה).
- הצג disclaimer: «מוערך מדיווחים ציבוריים — לא ייעוץ».

## שדרוג עתידי (אופציונלי)

- **מומלצים + 13F:** הרץ מיגרציה `044_featured_funds.sql` ב-SQL Editor (Dashboard → SQL).
- אחרי המיגרציה: `curl -X POST .../sync-fund-13f` לטעינת תיקי באפי/ARK.
- **היסטוריה לפוליטיקאים מאוצרים:** `sync-congress-trades` עם `{"deep":true}` מושך היסטוריה לפי BioGuide (UW/Quiver) לפלוסי וכו׳ — עדיין **שחזור מדיווחים**, לא net worth.

אם תרצה תיק snapshot אמיתי: UW Enterprise **או** Quiver Commercial — בלי refactor גדול, רק להפעיל `politician-portfolios` שוב.
