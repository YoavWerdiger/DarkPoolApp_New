# Dark Pool — מסלול realistic (בלי Enterprise)

מוצר: **עסקאות + פעילות + תשואה מוערכת** — לא «תיק אמיתי» מ-UW/Quiver Enterprise.

## ארכיטקטורה

```
Cron / Refresh
  sync-congress-trades  → dark_pool_congress_trades
  sync-insider-buys     → dark_pool_insider_buys

App
  פיד קונגרס     ← dark_pool_congress_trades
  פיד בכירים     ← dark_pool_insider_buys (sec-api + UW)
  פרופיל פוליטיקאי ← uw-politician-metrics (שחזור מ-DB + Yahoo)
  פרופיל בכיר    ← uw-investor-profile (DB sec-api, גיבוי UW)
  גילוי          ← uw-explore (פעילות / עוקבים — לא net worth)
```

## Secrets (Supabase)

```bash
# קונגרס — UW Basic מספיק ל-recent-trades
CONGRESS_TRADES_PROVIDER=unusualwhales
UNUSUAL_WHALES_API_KEY=...

# בכירים
INSIDER_SYNC_SOURCES=secapi,unusualwhales
SEC_API_KEY=...

# מחירים (כבר קיים)
FINNHUB_API_KEY=...
```

## Deploy Edge Functions

```bash
npx supabase functions deploy sync-congress-trades sync-insider-buys \
  uw-politician-metrics uw-investor-profile uw-explore uw-congress-feed \
  --no-verify-jwt --project-ref wpmrtczbfcijoocguime
```

## Cron (Supabase Dashboard → Integrations → Cron)

| Job | Schedule | Invoke |
|-----|----------|--------|
| קונגרס | `0 */2 * * *` | POST `/functions/v1/sync-congress-trades` |
| בכירים | `0 */6 * * *` | POST `/functions/v1/sync-insider-buys` |

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
| **פיד → קונגרס** | עסקאות STIR |
| **פיד → בכירים** | Form 4 (sec-api) |
| **גילוי** | מי לעקוב — עסקאות / עוקבים |
| **פרופיל פוליטיקאי** | תשואה מוערכת + טיקרים פעילים + timeline |
| **פרופיל בכיר** | היסטוריית רכישות מ-DB |

## לפני App Store

- וודא **commercial use** ב-ToS של sec-api.io ו-UW Basic (מומלץ מייל לתמיכה).
- הצג disclaimer: «מוערך מדיווחים ציבוריים — לא ייעוץ».

## שדרוג עתידי (אופציונלי)

- **מומלצים + 13F:** הרץ מיגרציה `044_featured_funds.sql` ב-SQL Editor (Dashboard → SQL).
- אחרי המיגרציה: `curl -X POST .../sync-fund-13f` לטעינת תיקי באפי/ARK.

אם תרצה תיק snapshot אמיתי: UW Enterprise **או** Quiver Commercial — בלי refactor גדול, רק להפעיל `politician-portfolios` שוב.
