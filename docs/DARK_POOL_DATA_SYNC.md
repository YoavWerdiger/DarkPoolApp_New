# Dark Pool — עדכון נתונים (למה זה לא בזמן אמת)

מסמך מקור אמת ל־**«עדכון נתונים»** באפליקציה: מה מתעדכן, מתי, ולמה אין פיד חי מ־Quiver.

קשור: [`DARK_POOL_REALISTIC.md`](./DARK_POOL_REALISTIC.md) (ארכיטקטורה / secrets), [`UNUSUAL_WHALES_INTEGRATION.md`](./UNUSUAL_WHALES_INTEGRATION.md) (endpoints), UI: `QuiverAttribution`.

---

## מה אומר «עדכון נתונים»?

במסכי בית / פיד / גילוי / פרופיל מופיעה שורת **«עדכון נתונים»** (`screens/DarkPool/components/QuiverAttribution.tsx`).

משמעותה:

1. הנתונים באפליקציה מגיעים מ־**DB שלנו** (טבלאות + snapshots) אחרי **סנכרון מתוזמן** משרתי Edge.
2. הסנכרון הוא **pull** — השרת קורא ל־Quiver / SEC לפי לוח זמנים (`pg_cron`) — **לא** דחיפה חיה (webhook / WebSocket) מספק הנתונים.
3. **משיכה למטה (pull-to-refresh)** מרעננת את מה שכבר נשמר אצלנו ב־DB. היא **לא** מחליפה את ה־cron ולא מבטיחה נתונים «עכשיו מ־Quiver».

---

## למה לא Realtime?

| שכבה | מה קורה בפועל |
|------|----------------|
| **Quiver Trader** | REST endpoints (`/beta/live/...`, `/beta/bulk/...`). **אין webhooks** לפידי קונגרס / בכירים / 13F / politicians בתוכנית שאנחנו משתמשים בה — רק משיכות API. |
| **השרת שלנו** | `pg_cron` → `net.http_post` → Edge Function (`sync-*`) → upsert ל־Postgres. |
| **האפליקציה** | קוראת DB / Edge read (`uw-congress-feed`, queries ל־`dark_pool_*`). במצב `DARK_POOL_SEC_PRODUCTION=true` אין live vendor מהלקוח. |

אין טענה ל־«live tick stream» לקונגרס או לבכירים. גם כש־Quiver קוראים ל־endpoint בשם `live`, זה עדיין **snapshot ב־HTTP** שאנחנו שואבים במרווחים — לא ערוץ realtime.

```
Quiver / SEC (REST)
        ▲
        │  pull מתוזמן בלבד (אין webhook אלינו)
        │
pg_cron ──▶ Edge sync-* ──▶ Postgres (dark_pool_*, caches, snapshots)
                                    │
App pull-to-refresh / React Query ──┘  (קריאה מחדש מה-DB)
```

---

## תדירות לפי מקור (מקור אמת: מיגרציות)

| מקור באפליקציה | Job (`cron.job`) | Schedule (UTC) | Edge Function | הערות |
|----------------|------------------|----------------|---------------|--------|
| עסקאות קונגרס (STOCK Act) | `sync-congress-trades-20m` | `*/20 * * * *` | `sync-congress-trades` | Quiver `/beta/live/congresstrading` → `dark_pool_congress_trades`. מיגרציה: `043_sync_congress_explore_cron.sql` |
| עסקאות טראמפ (executive) | אותו job | עם `deep:true` (ברירת מחדל) | `sync-congress-trades` | Quiver **`/beta/bulk/trumpstocktrades`** → אותה טבלה עם `politician_id=888dc73f-…` (לא BioGuide, לא live/congresstrading). שדות: Ticker, Transaction, Amount, Filed, Traded, ExcessReturn |
| רכישות בכירים | `sync-insider-buys-market-hours` | `0 13,17,21 * * 1-5` | `sync-insider-buys` | 3× ביום מסחר US. Quiver + Form4/SEC. מיגרציה: `20260823230000_...` |
| בכירים — סופ״ש | `sync-insider-buys-weekend` | `0 16 * * 0,6` | `sync-insider-buys` | catch-up |
| Politicians + אחזקות | `sync-quiver-congress-cache-daily` | `15 6 * * *` (~06:15) | `sync-quiver-congress-cache` | cache יומי. `20260823202929_...` |
| קרנות 13F | `sync-fund-13f-daily` | `0 6 * * *` | `sync-fund-13f` | `045_sync_fund_13f_cron.sql` |
| Dark pool prints | `sync-darkpool-5m` | `*/5 * * * *` | `sync-darkpool` | רק כש־`DARK_POOL_PROVIDER` מוגדר; במצב SEC production הטאב לרוב כבוי |
| Explore (force) | `sync-uw-explore-30m` | `10,40 * * * *` | `uw-explore` | רענון גילוי מה-DB/caches |
| Snapshots פרופיל | `materialize-darkpool-portfolios-hot` / `-daily` | hot: `15 14-21 * * 1-5` · daily: `30 2 * * *` | `materialize-darkpool-portfolios` | גרף/תשואות מוערכות — לא «שווי נטו חי» |

> קבצי README ישנים (למשל `sync-darkpool/README.md` עם «כל 30 שניות») **אינם** מקור אמת אם סותרים את המיגרציה. ה־cron ב־SQL הוא הקנוני.

---

## משיכה למטה מול Cron

| פעולה | מה קורה | מה **לא** קורה |
|-------|---------|----------------|
| **pg_cron** | מפעיל `sync-*` שמושכים מ־Quiver/SEC וכותבים ל־DB | — |
| **Pull-to-refresh באפליקציה** | React Query refetch + קריאה מחדש מטבלאות / Edge read | **לא** מחליף את לוח הזמנים; במצב production לקונגרס **לא** מפעיל `sync-congress-trades` מהלקוח |
| פתיחת מסך / staleTime | עשוי לקרוא שוב מה-DB אם עבר `DARK_POOL_FEED_STALE_MS` (~10 ד׳) | לא מושך Quiver ישירות מהלקוח ב־SEC production |

מסקנה למשתמש: משיכה למטה = «תראה לי מה כבר סונכרן». אם ה־cron האחרון היה לפני 15 דקות — זה מה שתראה.

---

## ציפיות השהייה (Latency)

שתי שכבות נפרדות:

1. **השהיית דיווח חוקית / מקור**  
   עסקאות קונגרס הן דיווחי **STOCK Act** — לעיתים היסטוריית עסקה + דיווח מאוחר (ימים עד שבועות לפי הכללים). גם Form 4 / 13F הם דיווחים תקופתיים, לא ticks של בורסה.

2. **השהיית הסנכרון שלנו**  
   אחרי שהדיווח כבר ב־Quiver/SEC, אנחנו עלולים להמתין עד המרווח הבא של ה־cron (למשל עד ~20 ד׳ לקונגרס, עד כמה שעות לבכירים בשעות מסחר).

סה״כ: «חדש באפליקציה» ≠ «קרה בשוק עכשיו». זה **פיד דיווחים מסונכרן**, לא מסחר חי.

---

## מה אנחנו **לא** טוענים

- אין WebSocket / webhook מ־Quiver לפידים האלה.
- אין stream של מחירים/עסקאות חי לקונגרס או בכירים.
- פרופיל פוליטיקאי: **לא** net worth חי; אחזקות מ־cache יומי + תשואה מוערכת מדיווחים.
- 13F: אחזקות רבעוניות/דיווחי SEC — לא עסקאות יומיות של הקרן.
- Dark pool: כשמופעל — משיכות כל ~5 ד׳ לספק, לא «כל הדפסה בזמן אמת» למשתמש ב־SEC mode.

---

## UI — איפה זה מוסבר למשתמש

`QuiverAttribution` עם `scope`:

| scope | מסך טיפוסי | מסר קצר |
|-------|------------|---------|
| `all` | בית | לא בזמן אמת · קונגרס ~20 ד׳ · בכירים 3× · משיכה = DB |
| `congress` | פיד קונגרס | ~20 ד׳ · STOCK Act · לא webhook |
| `insiders` | פיד בכירים | 3× יום מסחר · + סופ״ש |
| `explore` | גילוי | עסקאות 20 ד׳ · מטא/אחזקות יומי · 13F יומי |
| `politician` / `fund` | פרופיל | לא שווי נטו חי / 13F יומי |

Attribution: «Data provided by the Quiver API» → quiverquant.com.

---

## תחזוקה

- שינוי תדירות: עדכון מיגרציית `cron.schedule` + שורה בטבלה למעלה + העתק ב־`QuiverAttribution` אם המסר למשתמש משתנה.
- הרצה ידנית (ops): ראו `DARK_POOL_REALISTIC.md` — `curl` עם service role ל־`sync-congress-trades` / `sync-insider-buys` וכו׳.
