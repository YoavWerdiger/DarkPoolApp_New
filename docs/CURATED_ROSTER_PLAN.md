# רשימת אנשים מאוצרת על בסיס `bioguide_id` — חקירה, אימות חי ותוכנית בנייה

> **סטטוס:** מסמך חקירה + תוכנית. **לא בוצע שינוי בקוד סנכרון, בסכימת DB או ב-UI.**
> **תאריך:** 2026-09-17
> **תוכנית Quiver:** Trader ($75/חודש). רישוי: **אושר מול Quiver לשימוש מלא בכל ה-datasets עד מחזור $1M/שנה — אינו חסם.**
> **מקורות אמת:** `https://api.quiverquant.com/docs/schema.json` (נמשך ונותח ישירות) + קריאות חיות אמיתיות ל-`/beta/live/congress_stock_holdings` עבור **107 פוליטיקאים** (כולל אימות נקודתי של כל ‎40 השמות המאוצרים) + השוואה מול `dark_pool_person_portfolio_snapshots` בפרודקשן.

קשור: [`QUIVER_API_AUDIT.md`](./QUIVER_API_AUDIT.md) · [`DARK_POOL_DATA_SYNC.md`](./DARK_POOL_DATA_SYNC.md) · [`DARK_POOL_REALISTIC.md`](./DARK_POOL_REALISTIC.md)

---

## 0. TL;DR

1. **ה-endpoint קיים, עובד, וה-client שלו כבר כתוב בריפו.** `fetchQuiverCongressStockHoldings()` ב-`supabase/functions/_shared/quiverQuant.ts:560` קורא ל-`GET /beta/live/congress_stock_holdings?bioguide_id=…&sort_by_holding=true`. אין צורך לכתוב שכבת API חדשה.
2. **התשובה היא snapshot של אחזקות נוכחיות בלבד — 5 שדות, בלי תאריך, בלי היסטוריה, בלי טווחים.** `CurrentHolding` הוא **דולר ממשי מוערך** (float), לא bound של טווח STOCK Act. זה בדיוק מה שחסר היום.
3. **כן — זה מתקן את בעיית התיקים המופרכים, אבל רק חלקית.** מדד ה-«שווי תיק» וה-«אחזקות» עוברים מהערכה שבורה לנתון סביר. **הגרף לאורך זמן והתשואות (`period_returns`, `total_return_pct`) לא מתוקנים בכלל** — אין להם מקור ב-endpoint הזה. פירוט מדיד בסעיף 3.
4. **פער מדיד:** ב-17 פוליטיקאים שיש להם גם שחזור וגם bioguide-holdings, **חציון הפער הוא ×5.05**, ו-**8 מתוך 17 חורגים ביותר מ-×10**. המקרה הגרוע: Kevin Hern — שחזור $28,804 מול Quiver $29,531,482 (**×1,025**).
5. **כיסוי: 74/89 = 83.1% כללי · 71/80 = 88.8% למי שיש לו `TradeCount > 0` · 56/64 = 87.5% למי שיש לו `TradeCount ≥ 100`.**
6. **🔴 החסם הכי חמור:** **שני הסוחרים הפעילים ביותר בקונגרס — Ro Khanna (`K000389`, 39,622 עסקאות) ו-Michael McCaul (`M001157`, 29,367 עסקאות) — מחזירים מערך ריק.** שניהם ‎#4 ו-#8 ברשימת המשתמש. **ההמלצה: `trades_only`** — פיד עסקאות בלי תיק, בלי שווי ובלי תשואה. השחזור נדחה במפורש כי הוא נותן להם $3.03M/$4.49M מול `TradeVolume` של $650M/$1.48B. סעיף 5.6.
7. **🟢 מצאנו pre-filter חינמי:** בכל **6** המקרים שבהם `NetWorth` הוא `null` ב-`/beta/bulk/congress/politicians` — ה-holdings חזרו ריקים, מול **0/54 מקרים נגדיים** בקרב `TradeCount ≥ 200`. כשיש `NetWorth` — 74/84 (88.1%) מחזירים holdings. אפשר לסנן מועמדים **בלי שום קריאת API נוספת**, מה-cache שכבר יש לנו.
8. **הצד ההפוך של הכיסוי:** ל-**12 מתוך 45 המועמדים** בטבלה יש `db_trades = 0` ב-`dark_pool_congress_trades` (Wyden, Sherrill, Wittman, Dingell, Buchanan, Reed ועוד) — כי `sync-congress-trades` עושה deep-sync רק ל-16 המאוצרים. **לאנשים האלה bioguide-holdings הוא הדרך היחידה להציג תיק בכלל**, בלי לשלם 20 עמודי `bulk/congresstrading` לכל אדם.
9. **Trump הוא מסלול נפרד לחלוטין** — `/beta/bulk/trumpstocktrades`, אין `BioGuideID`, **ואין לו endpoint אחזקות בשום גרסה.** אבל התיק שלו **הוא מהמעטים שכבר תקינים** (`Amount` = דולר ממשי), ולכן הוא נכנס ל-Wave 1 כפי שהוא. סעיף 5.5.
10. **‎40 השמות של המשתמש נפתרו:** ‎23 ✅ viable · ‎4 ⚠️ thin · ‎5 ❌ empty (כולם `NetWorth=null`) · ‎7 ❓ לא ב-roster (חברי קונגרס לשעבר) · ‎1 🟠 Trump. **Wave 1 = ‎24 שמות.** סעיף 5.
11. **🔴 מלכודת קריטית שנתפסה באימות:** ניחוש `bioguide_id` **לא מחזיר שגיאה — הוא מחזיר את התיק של אדם אחר.** `S001215` (ניחוש ל-Victoria Spartz) החזיר את האחזקות של `Haley M. Stevens`. כל פתרון שם חייב להצליב `Name` מול `quiver_congress_politicians`. סעיף 5.3.
12. **`is_active` של Quiver מיושן** — Mark Green ו-Marjorie Taylor Greene מסומנים `true` למרות שאינם מכהנים. הסיגנל האמין הוא `MAX(transaction_date)` מ-`dark_pool_congress_trades`. סעיף 5.4.
13. **`Allocation` הוא שבר 0–1, לא אחוז** — בניגוד למה שכתוב בדוקס. אומת חי: סכום `Allocation` לכל אדם = **1.00 בדיוק** (19/19). סעיף 1.4.

---

## 1. מכניקת ה-endpoint (`bioguide_id`)

### 1.1 הנתיב המדויק

מ-`schema.json` (`operationId: live_congress_stock_holdings_retrieve`):

```
GET https://api.quiverquant.com/beta/live/congress_stock_holdings
Authorization: Bearer <QUIVER_API_KEY>      (securityScheme: WebPlatformTokenAuth, type=http, scheme=bearer)
tags: ["Tier 1", "public"]                  → זמין ב-Hobbyist ומעלה, כלומר גם ב-Trader
```

**התיאור המלא בדוקס:**
> «Returns estimate of current stock holdings of members of U.S. Congress. Use the bioguide_id, ticker, and sort_by_holding parameters to filter and sort the results.»

**⚠️ אל תבלבלו** בין `/beta/live/congress_stock_holdings` (Tier 1 + `public` — **זמין לנו**) לבין `/beta/live/congressholdings` (Tier 1 + `enterprise`, `x-internal: true` — **לא זמין**, ומחזיר סכימה אחרת לגמרי: `Politician` / `Holdings` / `Type` כולם `string`).

### 1.2 כל הפרמטרים — רשימה מלאה מ-`schema.json`

ה-endpoint מקבל **בדיוק שלושה** query params. אין אחרים.

| שם הפרמטר (casing מדויק) | `type` | `default` בדוקס | תיאור מהדוקס |
|---|---|---|---|
| **`bioguide_id`** | `string` | — | «Congressperson's BioGuide id» |
| `sort_by_holding` | `boolean` | `"False"` | «Sort portfolio holdings by current holding amount (descending). Accepted values: true (sort by current holding), false (sort by allocation).» |
| `ticker` | `string` | — | «Ticker for any given stock» |

**אישור ה-casing:** `bioguide_id` — **snake_case, lowercase, יחיד**. זה מאומת מול ה-spec וגם מול קריאות חיות שעבדו. שדה התשובה, לעומת זאת, נקרא `BioGuideID` (PascalCase עם `ID` באותיות גדולות). שני הכתיבים שונים — זו תקלה נפוצה.

**🔴 אין `page` ואין `page_size`.** בניגוד ל-`/beta/bulk/congresstrading` ול-`/beta/bulk/congress/politicians`, ה-endpoint הזה **לא מתעד שום פרמטר pagination**. בקריאה חיה קיבלנו 464 שורות בתשובה אחת ל-`C001123`, כלומר אין cap נמוך — אבל **האם קיים cap גבוה כלשהו: לא מאומת.**

### 1.3 סכימת התשובה המדויקת

```
LiveCongressStockHoldingsResponse = array of CongressStockHolding
```

`components.schemas.CongressStockHolding` — «Represents a stock holding as represented by the live congress stock holdings endpoint.»

| שדה | `type` | REQUIRED? | תיאור מהדוקס |
|---|---|---|---|
| `BioGuideID` | `string` | ✅ **required** | «BioGuide ID of the congressperson holding the stock» |
| `Name` | `string` | — | «Name of the congressperson who made the transaction» |
| `Ticker` | `string` | — | «Ticker symbol of the stock held by the congressperson» |
| `CurrentHolding` | `number` | — | «Estimated current holding of the stock by the congressperson (USD)» |
| `Allocation` | `number` | — | «Estimtated allocation of the stock in the congressperson's portfolio (percentage)» *(שגיאת כתיב במקור)* |

**חמישה שדות. זה הכל.** אין `Date`, אין `as_of`, אין `Shares`, אין `Price`, אין `CostBasis`, אין `AssetType`, אין `ReportPeriod`, אין `Range`.

### 1.4 מה שהקריאה החיה חשפה — וסותר את הדוקס

**`all_keys` שנמדד על התשובות האמיתיות** (aggregation על כל השורות של `P000197`, `M000355`, `C001123`):

```
["Allocation", "BioGuideID", "CurrentHolding", "Name", "Ticker"]
```

התשובה החיה תואמת את הסכימה **בדיוק** — חמישה שדות, ללא תוספות. זה חריג משמח באודיט הזה; רוב ה-endpoints האחרים (סעיף 8.4 ב-`QUIVER_API_AUDIT.md`) לא מתועדים.

**🔴 סתירה אחת ומהותית — `Allocation` הוא שבר, לא אחוז:**

הדוקס אומרים «(percentage)». המציאות:

```json
{"Name":"Mitch McConnell","Ticker":"VOO","Allocation":0.763947357483033,"BioGuideID":"M000355","CurrentHolding":38866455.1780598}
```

`0.7639` = 76.39% מהתיק. ובדיקה על כל 19 האנשים ב-cache: **`SUM(Allocation)` = 1.00 בדיוק אצל כל אחד ואחד.** כלומר `Allocation` הוא **שבר מנורמל בטווח 0–1**.

*השפעה על הריפו:* `parseQuiverAllocationPct()` (`quiverQuant.ts:1096`) מפעיל heuristic — `raw > 0 && raw <= 1 ? raw * 100 : raw`. על הנתונים האמיתיים זה **מחזיר את התוצאה הנכונה**, אבל מהסיבה הלא-נכונה: זה עובד במקרה כי הערכים תמיד ≤1. ברגע שמישהו מחזיק נייר בודד (`Allocation = 1.0`) זה עדיין נכון (→100%), אז אין באג פעיל. עדיין: **ההסתמכות על heuristic במקום על ידיעה מאומתת היא חוב טכני** — עכשיו שזה מאומת, הנכון הוא `raw * 100` ללא תנאי, עם הערה `// verified live 2026-09-17: fraction 0..1, sums to 1.0 per person`.

### 1.5 CURRENT מול HISTORICAL — תשובה חד-משמעית

**`/beta/live/congress_stock_holdings` מחזיר CURRENT SNAPSHOT בלבד.**

ראיות:
- שם ה-endpoint (`live`) והתיאור («**current** stock holdings»).
- **אין שדה תאריך בסכימה ולא בתשובה החיה.**
- אין פרמטר `date` / `period` / `date_from` (בניגוד ל-`/beta/live/insiders` שיש לו `date`, ו-`/beta/live/sec13f` שיש לו `period`).
- אין וריאנט `/beta/historical/congress_stock_holdings/{…}` באף אחד מ-53 ה-paths.

**המשמעות התכנונית — זו הנקודה הקריטית של כל הפיבוט:**

> אי-אפשר לבנות **גרף שווי-תיק לאורך זמן** מ-bioguide holdings. אפשר לבנות רק **את המצב של היום**. סדרת הזמן היא היסטוריה שרק *אנחנו* יכולים לצבור, על ידי שמירת snapshot יומי עם `as_of_date` שאנחנו מחתימים בעצמנו.

### 1.6 דולרים ממשיים מול טווחי דיווח

| | `bulk/congresstrading` (המקור הנוכחי) | `live/congress_stock_holdings` (המקור המוצע) |
|---|---|---|
| שדה הסכום | `Range` (`"$1,000,001 - $5,000,000"`) + `Amount` (מתועד: «**Lower bound** of transaction size ($)») | `CurrentHolding` |
| טיפוס | `string` | `number` (float) |
| סמנטיקה | טווח דיווח STOCK Act — **חייב ניחוש** | **דולר יחיד מוערך** |
| דוגמה אמיתית | `Amount: "1000001"` → `STOCK_ACT_FLOOR_MID` → `$3,000,000` (ניחוש שלנו) | `38866455.1780598` (ההערכה של Quiver) |

`CurrentHolding` הוא **הערכה של Quiver** (הדוקס אומרים «Estimated»), לא דיווח רשמי. אבל זו הערכה שמבוססת על המודל הפנימי שלהם ועל מחירי שוק עדכניים — לא על `STOCK_ACT_FLOOR_MID` שאנחנו קידדנו קשיח ב-`congressPortfolio.ts:116`. **הדיוק המוחלט לא ידוע; הסבירות משתפרת דרמטית** (סעיף 3).

### 1.7 Pagination, defaults ומגבלות

| שאלה | תשובה |
|---|---|
| פרמטרי pagination | **אין** — לא `page`, לא `page_size`, לא `limit`, לא `offset` |
| `page_size` ברירת מחדל | לא רלוונטי (אין פרמטר) |
| cap על מספר שורות | **לא מאומת.** בפועל קיבלנו 464 שורות בקריאה אחת → אין cap מתחת ל-464 |
| Rate limits / quotas | **לא מאומת** — לא ב-OpenAPI spec ולא בעמוד התמחור. ה-`delay(150)` ב-`sync-quiver-congress-cache/index.ts:127` הוא הגנה שלנו, לא מגבלה מתועדת |
| תדירות רענון בצד Quiver | **לא מאומת** — הדוקס אומרים רק «live». אין SLA, ואין שדה תאריך שמאפשר למדוד |
| התנהגות על `bioguide_id` לא קיים | **לא מאומת** מהדוקס. בפועל: `200 OK` עם `[]` (זה מה שקיבלנו ל-`K000389` ו-`M001157`) — כלומר **תשובה ריקה ושגיאה נראות זהות** |

### 1.8 איך פותרים `bioguide_id` לאדם — שלושה מסלולים, כולם קיימים

**מסלול A (מומלץ) — מה-cache שכבר יש לנו.** `dark_pool_uw_snapshots` עם `cache_key = 'quiver_congress_politicians'`, מקור: `GET /beta/bulk/congress/politicians`. אומת חי:

```
545 רשומות · 545/545 עם BioGuideID תקין (^[A-Z]\d{6}$) · 254 עם TradeCount > 0
494/545 עם NetWorth · 542/545 עם ImageURL
```

השדות הזמינים (aggregation על התשובה האמיתית): `BioGuideID`, `CandidateID`, `Chamber`, `ImageURL`, `Name`, `NetWorth`, `Party`, `State`, `TradeCount`, `TradeVolume`.

**🔴 סתירה בין הריפו לדוקס ולמציאות:** `QuiverPolitician` ב-`quiverQuant.ts:65-79` מגדיר `LastTraded`, `House` ו-`'Net Worth'`. **אף אחד מהשלושה לא קיים** — לא ב-`schema.json` (ששם `Chamber` ו-`NetWorth`), ולא בתשובה החיה (10 שדות, ללא `LastTraded`). האודיט סימן את זה כ-«לא מאומת» (סעיף 8.4); **עכשיו זה מאומת כלא-קיים.** בפועל `sync-quiver-congress-cache/index.ts:85` כותב `LastTraded: p.LastTraded` שהוא תמיד `undefined`, וגם `docs/UNUSUAL_WHALES_INTEGRATION.md:21` עדיין מציין אותו כשדה קיים — **שתי נקודות לתיקון תיעוד.**

**מסלול B** — `BioGuideID` חוזר בכל שורת עסקה מ-`/beta/live/congresstrading` ומ-`/beta/bulk/congresstrading`, ונשמר אצלנו ב-`dark_pool_congress_trades.politician_id`.

**מסלול C** — הרשימה הקשיחה `CURATED_CONGRESS_BIOGUIDES` (`quiverQuant.ts:997`, 16 מזהים).

**⚠️ איכות הנתונים ב-roster:** הקריאה החזירה `A000383 · "Alan Armstrong" · Senate · Republican · Oklahoma · TradeCount 703` — **אין סנאטור בשם הזה מאוקלהומה.** הקריאה נעשתה עם `include_candidates=false` ו-`is_active=true`, כלומר זה לא אמור להיות candidate. זו **תקלה בצד Quiver**, ו-`A000383` גם החזיר holdings ריקים. **מסקנה: אסור להזרים את ה-roster ל-UI אוטומטית — צריך שלב אישור ידני.** זה עוד נימוק לרשימה מאוצרת סגורה.

---

## 2. אימות חי — מה חזר בפועל

### 2.1 מנגנון האימות (בלי לגעת במפתח)

`.env` המקומי מכיל רק `EXPO_PUBLIC_SUPABASE_URL` ו-`EXPO_PUBLIC_SUPABASE_ANON_KEY`. **`QUIVER_API_KEY` קיים אך ורק כ-Supabase Edge secret** (אומת ב-`supabase secrets list`, שמציג digests בלבד ולא ערכים). אין דרך — ולא צריך דרך — לקרוא אותו מקומית.

**הפתרון:** קריאה ל-edge function הפרודקשן `sync-quiver-congress-cache` עם `body.bioguides`, פרמטר שהפונקציה **כבר חושפת בכוונה** (`index.ts:41-45`) בדיוק לשימוש הזה. היא:
- מריצה `GET /beta/live/congress_stock_holdings?bioguide_id=…` פעם אחת לכל מזהה,
- **ממזגת** ל-cache הקיים ולא מוחקת (`index.ts:104-120`: `{...priorByBioguide}`),
- נקראה עם `politicians: false` כדי לא לגעת ב-roster.

**המפתח לא נקרא, לא הודפס ולא עבר דרך הסביבה המקומית.** שתי ריצות, 36 מזהים כל אחת. הכתיבה היחידה היא ל-`dark_pool_uw_snapshots`/`quiver_congress_holdings` — **אותה טבלת cache שה-cron (`sync-quiver-congress-cache-daily`, `15 6 * * *`) דורס מדי יום.** אין שינוי סכימה, קוד או UI.

### 2.2 מה חזר — 19 האנשים המקוריים

| `BioGuideID` | `Name` (מ-Quiver) | מספר holdings | `SUM(CurrentHolding)` | `SUM(Allocation)` |
|---|---|---|---|---|
| `C001123` | Gilbert Ray Cisneros, Jr. | **464** | $37,791,237 | 1.00 |
| `G000583` | Josh Gottheimer | 199 | $28,443,418 | 1.00 |
| `M001217` | Jared Moskowitz | 105 | $4,616,823 | 1.00 |
| `H001082` | Kevin Hern | 101 | $29,531,482 | 1.00 |
| `B001236` | John Boozman | 98 | $2,773,132 | 1.00 |
| `W000802` | Sheldon Whitehouse | 90 | $24,362,114 | 1.00 |
| `M001190` | Markwayne Mullin | 87 | $26,354,115 | 1.00 |
| `G000596` | Marjorie Taylor Greene | 85 | $4,465,082 | 1.00 |
| `M001234` | Kelly Morrison | 67 | $14,328,513 | 1.00 |
| `S000168` | Maria Elvira Salazar | 45 | $2,318,768 | 1.00 |
| `T000278` | Tommy Tuberville | 37 | $3,243,099 | 1.00 |
| `M001218` | Richard McCormick | 26 | $293,722 | 1.00 |
| `D000032` | Byron Donalds | 26 | $463,537 | 1.00 |
| `P000197` | Nancy Pelosi | 26 | **$155,527,784** | 1.00 |
| `C001114` | John R. Curtis | 13 | $3,850,039 | 1.00 |
| `M000355` | Mitch McConnell | 8 | $50,875,829 | 1.00 |
| `C001098` | Ted Cruz | 8 | $5,319,913 | 1.00 |
| **`M001157`** | *(null)* | **0** | — | — |
| **`K000389`** | *(null)* | **0** | — | — |

### 2.3 שלוש דוגמאות מפורטות — התשובה הגולמית

**Nancy Pelosi (`P000197`)** — 26 holdings, $155.5M:
```json
[
  {"Name":"Nancy Pelosi","Ticker":"AAPL", "Allocation":0.118698678134969,"BioGuideID":"P000197","CurrentHolding":18460942.4006494},
  {"Name":"Nancy Pelosi","Ticker":"NVDA", "Allocation":0.112940322216916,"BioGuideID":"P000197","CurrentHolding":17565358.0639414},
  {"Name":"Nancy Pelosi","Ticker":"GOOGL","Allocation":0.11070619167506, "BioGuideID":"P000197","CurrentHolding":17217888.6910995},
  {"Name":"Nancy Pelosi","Ticker":"AMZN", "Allocation":0.110512863901483,"BioGuideID":"P000197","CurrentHolding":17187820.850846}
]
```
**סבירות:** ✅ `NetWorth` מ-Quiver = $263,190,269. תיק מניות של $155M בתוך הון של $263M הוא הגיוני לחלוטין. ההרכב (AAPL/NVDA/GOOGL/AMZN בפיזור ~11% כל אחד) תואם את מה שמדווח בעיתונות על Pelosi.

**Mitch McConnell (`M000355`)** — 8 holdings, $50.9M:
```json
[
  {"Name":"Mitch McConnell","Ticker":"VOO","Allocation":0.763947357483033, "BioGuideID":"M000355","CurrentHolding":38866455.1780598},
  {"Name":"Mitch McConnell","Ticker":"VO", "Allocation":0.0754352859533542,"BioGuideID":"M000355","CurrentHolding":3837832.71403655},
  {"Name":"Mitch McConnell","Ticker":"VB", "Allocation":0.0753869076428583,"BioGuideID":"M000355","CurrentHolding":3835371.42738105},
  {"Name":"Mitch McConnell","Ticker":"WFC","Allocation":0.0740266765325289,"BioGuideID":"M000355","CurrentHolding":3766168.54191575}
]
```
**סבירות:** ✅ `NetWorth` = $69,814,761; תיק $50.9M מתוכו. תיק ריכוזי של 76% ב-VOO (S&P 500 ETF) — פרופיל שמרני שתואם סנאטור שדיווח על 45 עסקאות בלבד.
**🟢 תובנה מוצרית:** התשובה **כוללת ETFs** (`VOO`, `VO`, `VB`, `IGM`, `IJH`) — לא רק מניות בודדות. זה **רחב יותר** ממה שהפייפליין הנוכחי מציג, כי `isQuiverEquityTrade()` (`quiverQuant.ts:1061`) מסנן לפי `TickerType` ל-`stock`/`st`/`cs`.

**Gilbert Ray Cisneros (`C001123`)** — 464 holdings, $37.8M. התיק הארוך ביותר שראינו. מוכיח שאין truncation מתחת ל-464 שורות.

### 2.4 טריות — התשובה הלא-נוחה

| שאלה | תשובה |
|---|---|
| מה ה-`as_of` של הנתון? | **אי-אפשר לדעת מתוך ה-payload.** אין שדה תאריך. |
| מתי הנתון נמשך? | `payload.synced_at = "2026-09-17T06:16:06.562Z"` — אבל זה חתימה **שלנו** (`saveSnapshot`), לא של Quiver. |
| כמה הנתון עצמו טרי? | **לא מאומת.** |

**עקיפה עקיפה:** `CurrentHolding` הוא דולרי, כלומר מוכפל במחיר שוק. אם נשמור snapshot יומי ונראה ש-`CurrentHolding` של טיקר משתנה בין ימים ללא עסקה חדשה — סימן שהוא ממותג לשוק. אם הוא קפוא — הוא מחושב מחדש רק בדיווח חדש. **אפשר לקבוע את זה אמפירית אחרי 3–5 ימי snapshots. עד אז: לא מאומת, ואסור להבטיח «מחירי שוק חיים» ב-UI.**

---

## 3. השוואת איכות — הקראנץ' של כל המסמך

### 3.1 מה האפליקציה מציגה היום

השרשרת: `dark_pool_congress_trades` → `congressPortfolio.ts:parseCongressAmount()` (mid-range מ-`STOCK_ACT_FLOOR_MID`) → `normalizeCongressTrades()` (`qty = amountUsd / marketPx`, `qtyEstimated = true`) → `buildDailySeries()` (Yahoo יומי) → `dark_pool_person_portfolio_snapshots`.

`profilePortfolioEngine.ts` הוא מימוש client-side מקביל של אותו אלגוריתם.

### 3.2 הפער המדיד — 17 אנשים עם שני המקורות

| `BioGuideID` | שם | שחזור (`portfolio_value`) | Quiver (`SUM CurrentHolding`) | יחס |
|---|---|---|---|---|
| `H001082` | Kevin Hern | **$28,804** | $29,531,482 | **×1,025** |
| `A000372` | Rick W. Allen | $14,484 | $6,116,368 | ×422 |
| `M000355` | Mitch McConnell | $264,576 | $50,875,829 | **×192** |
| `M001236` | Tim Moore | $8,211 | $1,074,346 | ×131 |
| `G000583` | Josh Gottheimer | $306,724 | $28,443,418 | ×92.7 |
| `W000802` | Sheldon Whitehouse | $272,558 | $24,362,114 | ×89.4 |
| `C001123` | Gilbert Cisneros | $782,328 | $37,791,237 | ×48.3 |
| `C001114` | John Curtis | $108,782 | $3,850,039 | ×35.4 |
| `M001190` | Markwayne Mullin | $5,222,213 | $26,354,115 | ×5.05 |
| `P000197` | **Nancy Pelosi** | **$41,776,608** | **$155,527,784** | **×3.72** |
| `B001236` | John Boozman | $964,699 | $2,773,132 | ×2.87 |
| `M001217` | Jared Moskowitz | $1,823,594 | $4,616,823 | ×2.53 |
| `S000168` | Maria Salazar | $1,140,592 | $2,318,768 | ×2.03 |
| `T000278` | Tommy Tuberville | $2,530,519 | $3,243,099 | ×1.28 |
| `M001218` | Richard McCormick | $293,863 | $293,722 | **×1.00** ✅ |
| `G000596` | Marjorie Taylor Greene | $5,674,062 | $4,465,082 | ×0.79 |
| `D000032` | Byron Donalds | $4,432,271 | $463,537 | **×0.105** |
| `C001098` | Ted Cruz | **$0** | $5,319,913 | ∞ |
| `M001234` | Kelly Morrison | **$0** | $14,328,513 | ∞ |
| `M001157` | Michael McCaul | $4,491,222 | **ריק** | — |
| `K000389` | Ro Khanna | $3,025,482 | **ריק** | — |

**חציון הפער: ×5.05. 8 מתוך 17 חורגים ביותר מ-×10. רק אחד (`M001218`) מתלכד.**

**כיוון הפער אינו עקבי** — `H001082` שחזור נמוך פי 1,025; `D000032` שחזור **גבוה** פי 9.5. כלומר זו לא סטייה שאפשר לכייל בקבוע; **המודל שבור באופן לא-מכויל.**

**הסבר השורש** (`congressPortfolio.ts:487-489`): `replayPositions()` מפחית מכירות מהפוזיציה. כשהעסקאות בטבלה חלקיות — deep-sync מכסה רק את 16 המאוצרים, והפיד הגלובלי דליל — פוזיציות נסגרות בטעות (`cur.qty = 0`) ואחזקות נעלמות מהתיק. לכן `C001098` (Ted Cruz, 2 עסקאות ב-DB) מקבל `portfolio_value = 0` בעוד ש-Quiver רואה $5.3M.

### 3.3 ולא רק השווי — התשואות בעצמן מופרכות

מתוך **32** רשומות `dark_pool_person_portfolio_snapshots` (`kind='politician'`):

- **`chart_reliable = true` רק ב-6 מתוך 32 (19%).** ב-26 הנותרות ה-UI לא אמור להציג גרף בכלל.
- `period_returns.ALL` מעל 100% ב-**8** רשומות, מעל 250% ב-**2**.
- הקיצוניות: `C001055` → `ALL = 1186.32%` · `C001123` → `ALL = 462.79%` · `T000490` → `170.59%` · `K000398` → `161.36%` · `M001236` → `−89.05%`.

**🔴 באג שנחשף אגב אורחא:** `MAX_DISPLAYABLE_PERIOD_RETURN_PCT = 250` (`congressPortfolio.ts:130`) אמור לחסום את אלה — `twrPeriodReturnPct()` מחזיר `null` כש-`|pct| > 250`. אבל מסלול ה-**notional fallback** ב-`metricsFromCongressTrades()` (`congressPortfolio.ts:968`) כותב `ALL: Math.round(allRet * 100) / 100` **בלי לעבור דרך `sanitizePeriodReturnPct()`**. זה מסביר בדיוק איך `1186.32%` הגיע ל-DB. מאשר גם הדיוק המלא ללא עיגול בכמה רשומות (`"-9.485271301626023"`) — כלומר חלק מהן נכתבו בנתיב שגם לא מעגל.

זהו בדיוק ה-«חריגים ולא הגיוניים» שהמשתמש דיווח עליו, בערכים מדידים.

### 3.4 האם bioguide holdings מתקן את זה? — **חלקית. בכוונה מדויקת.**

| מה שהמשתמש רואה | מה קורה עם bioguide holdings | מתוקן? |
|---|---|---|
| **שווי תיק** (כותרת) | `SUM(CurrentHolding)` ישירות מ-Quiver | ✅ **כן** |
| **רשימת אחזקות** + `allocation_pct` | `Ticker` + `CurrentHolding` + `Allocation` | ✅ **כן** — וכולל ETFs שהיום מסוננים |
| **דיוק ה-allocation** | `Allocation` מנורמל ל-1.00 בדיוק לכל אדם | ✅ **כן** |
| **פוזיציות רפאים / נעלמות** | Quiver מחזיר את התיק, לא משחזר אותו מ-replay | ✅ **כן** |
| **גרף שווי לאורך זמן** | **אין נתון היסטורי ב-endpoint** | ❌ **לא** |
| `period_returns` (`1M`/`YTD`/`1Y`/`ALL`) | **אין מקור** | ❌ **לא** |
| `total_return_pct` | **אין cost basis ב-endpoint** | ❌ **לא** |
| `entry_price` / `first_added_date` לאחזקה | **אין** | ❌ **לא** |
| `win_rate`, `sharpe`, `max_drawdown` | **אין** — כולם נגזרים מסדרת הזמן | ❌ **לא** |
| `avg_delay_days` | לא מ-endpoint הזה (מ-`ReportDate`/`TransactionDate`) | ➖ ללא שינוי |

**🟢 והחדשות הטובות:** הריפו **כבר מודע לזה ומטפל בזה נכון.** `uw-investor-profile/index.ts:330-347` — כשהמסלול `preferQuiverHoldings` פעיל, הקוד מחליף את `portfolio_value` ב-`quiverTotal` **ובמפורש מרוקן את הגרף**:

```ts
metrics = {
  ...metrics,
  portfolio_value: Math.round(quiverTotal * 100) / 100,
  holdings: [],
  series: [],              // ← הגרף מוסתר בכוונה
  chart_reliable: false,
  total_return_pct: 0,
  …
};
```

ההערה שם מסבירה בדיוק למה: «שווי כותרת = סכום Quiver holdings; גרף השחזור נגמר בערך אחר (mid STOCK Act). מסתירים את הסדרה כדי לא להציג עקומה שלא תואמת את השווי».

**המשמעות:** הפיבוט **לא כותב את הלוגיקה הזו מאפס — הוא הופך אותה מ-fallback ל-ברירת מחדל.** וזה גם אומר שבמצבו הנוכחי, פרופיל שמשתמש ב-Quiver holdings **מציג תיק ללא גרף בכלל.** אם המוצר רוצה גרף, צריך לצבור סדרת snapshots בעצמנו (סעיף 6.2) — או להשאיר את השחזור כמסלול הגרף בלבד.

### 3.5 פערים שיש ל-bioguide holdings — הצד ההוגן

1. **🔴 שני המרקיים חסרים.** Khanna ו-McCaul — סעיף 4.2.
2. **🟡 אין תאריך → אין freshness מדיד.** אם Quiver יקפיא את הטבלה, נציג נתון בן חודשים ולא נדע.
3. **🟡 תיקים דקים.** 11 מ-74 מחזירים <5 holdings. `W000797` (Wasserman Schultz): 4 אחזקות בסך **$7,383**. `M001184` (Massie): אחזקה אחת, $27,152. **לא מאומת** אם זה מדויק או קיצוץ.
4. **🟡 מכסה מניות/ETFs בלבד.** אין קרנות נאמנות לא-נסחרות, אגרות חוב, נדל״ן, קריפטו, אופציות. `Rick Scott` (`S001217`): 7 אחזקות/$58.8M מול `NetWorth` $509.9M — הפער כנראה בנכסים לא-מניתיים. **להימנע מ-framing «שווי נטו» או «כל התיק»; הניסוח הנכון הוא «אחזקות מניות מוערכות».**
5. **🟡 «Estimated» מוצהר.** צריך `QuiverAttribution` על המסך.
6. **🟡 אין shares.** אין כמות מניות, אז אין מחיר כניסה ואין P&L לפוזיציה — לנצח, לא רק בגרסה הראשונה.

---

## 4. כיסוי

### 4.1 מה שנמדד

89 מזהים נבדקו בקריאות חיות: 16 המאוצרים + 3 שהיו ב-cache + 70 מהרשימה לפי `TradeCount` ולפי בולטות ציבורית.

| קבוצה | נבדקו | עם holdings | **שיעור כיסוי** |
|---|---|---|---|
| כל מי שנבדק | 89 | 74 | **83.1%** |
| `TradeCount > 0` | 80 | 71 | **88.8%** |
| `TradeCount ≥ 100` | 64 | 56 | **87.5%** |
| `NetWorth` **קיים** ב-roster | 84 | 74 | **88.1%** |
| `NetWorth` = `null` ב-roster | 5 | **0** | **0.0%** |

מתוך 74 שהחזירו holdings, **11 החזירו פחות מ-5 אחזקות** → «כיסוי שמיש» (≥5 אחזקות) = **63/89 = 70.8%**.

### 4.2 🔴 מי חסר — והמצב חמור יותר ממה שהאחוזים מספרים

**חסרים עם `TradeCount > 0` (9) — לפי סדר החומרה:**

| `BioGuideID` | שם | `TradeCount` | `NetWorth` | למה זה כואב |
|---|---|---|---|---|
| **`K000389`** | **Ro Khanna** | **39,622** | `null` | **הסוחר הפעיל ביותר בקונגרס. כבר ברשימה המאוצרת. `TradeVolume` = $650M.** |
| **`M001157`** | **Michael T. McCaul** | **29,367** | `null` | **#2. כבר ברשימה המאוצרת. `TradeVolume` = $1.48B.** |
| `H001086` | Diana Harshbarger | 1,181 | `null` | #10 בפעילות |
| `A000383` | «Alan Armstrong» | 703 | `null` | רשומה חשודה בצד Quiver (סעיף 1.8) |
| `G000590` | Mark E. Green | 671 | `null` | `TradeVolume` $99M |
| `H001094` | Val T. Hoyle | 390 | $1,010,500 | — |
| `H001061` | John Hoeven | 225 | $48,480,000 | סנאטור אמיד — מפתיע |
| `C001075` | Bill Cassidy | 216 | $431,500 | סנאטור מוכר |
| `K000377` | Mark Kelly | 1 | $20,447,500 | בולט ציבורית |

**חסרים עם `TradeCount = 0` (6):** AOC (`O000172`), Elizabeth Warren (`W000817`), Chuck Schumer (`S000148`), Bernie Sanders (`S000033`), Maxine Waters (`W000187`), Amy Klobuchar (`K000367`).

> **הבהרה חשובה:** אלה **לא כשלי כיסוי.** ל-AOC יש `NetWorth = $57,000` ואפס עסקאות — היא באמת לא מחזיקה מניות. מערך ריק הוא **התשובה הנכונה**. אבל: משתמשים **כן יחפשו** אותם, ולכן צריך מצב UI מכובד («לא מחזיק/ה מניות בודדות») ולא «שגיאה» או פרופיל ריק.

**🔴 המסקנה החדה:** אחוז הכיסוי (88.8%) **מטעה כלפי מעלה**, כי 2 מה-9 החסרים הם בדיוק #1 ו-#2 בפעילות ובבולטות, ושניהם כבר ברשימה המאוצרת הקיימת. **רשימה מאוצרת שלא כוללת את Ro Khanna ואת Michael McCaul תראה למשתמש שבור** — ושחזור הוא המסלול היחיד שנותר לשניהם (יש להם $3.0M ו-$4.5M בשחזור, כלומר יש שם נתונים).

**למה הם ריקים: לא מאומת.** מה שכן מאומת: ב-**6/6** המקרים שבהם `NetWorth` הוא `null`, גם ה-holdings ריקים (מול **0/54** מקרים נגדיים ב-`TradeCount ≥ 200`) — כלומר **שתי הטבלאות הנגזרות של Quiver נכשלות באותם אנשים בדיוק.** ההשערה הסבירה (**לא מאומת**) היא שהמודל שלהם לא מסוגל לעבד 30–40 אלף שורות עסקאות (חשבונות בניהול חיצוני / blind trust). זו שאלה טובה לפנייה ל-Quiver.

### 4.3 הרחבה לכל ה-roster (הערכה)

| | ספירה |
|---|---|
| ב-roster (`quiver_congress_politicians`) | **545** |
| עם `TradeCount > 0` | **254** |
| עם `TradeCount ≥ 100` | **94** |
| מתוכם עם `NetWorth` (סינון בלי API) | **88** |
| **כיסוי צפוי ל-`TradeCount ≥ 100`** | ≈ 88 × 88.1% ≈ **78 אנשים** |

**רשימה של 40 היא בטוחה בהחלט** (מדידה מעודכנת בסעיף 6). עד ~75 עדיין בריא. `NetWorth` כ-pre-filter חוסך בזבוז מוחלט.

---

## 5. הרשימה המאוצרת — 40 השמות של המשתמש

> **סטטוס:** הרשימה הזו **מחליפה** את הצעת המועמדים הספקולטיבית מהגרסה הקודמת של המסמך. כל 40 השמות נפתרו ואומתו בקריאות חיות (אותה שיטה: edge function פרודקשן, המפתח לא נקרא ולא הודפס). סדר השמות הוא סדר המשתמש.

### 5.0 סיכום לפי verdict

| Verdict | ספירה | פירוש |
|---|---|---|
| ✅ **viable** | **23** | `qv_n ≥ 5` **וגם** `qv_usd ≥ $200K` — תיק אמיתי, שמיש ל-UI |
| ⚠️ **thin** | **4** | holdings חזרו אבל 1–4 אחזקות או שווי זניח |
| ❌ **empty** | **5** | חבר מכהן, `bioguide_id` מאומת, `[]` חזר |
| ❓ **not found** | **7** | לא ב-roster של Quiver (active-only) · `bioguide_id` **לא מאומת** |
| 🟠 **מסלול נפרד** | **1** | Trump — אין `bioguide_id`, אין endpoint אחזקות |
| **סה״כ** | **40** | |

**כל 5 ה-❌ הם `NetWorth = null`.** כלל ה-pre-filter מסעיף 4.1 עומד עכשיו על **6/6 חיזוי מושלם** (Khanna, McCaul, Harshbarger, Mark Green, Fleischmann, «Armstrong»), מול **0/54 מקרים נגדיים** בקרב מי ש-`TradeCount ≥ 200` ו-`NetWorth` קיים.

### 5.1 הקריטריונים לסיווג

1. `qv_n` = מספר שורות שחזרו בפועל מ-`/beta/live/congress_stock_holdings?bioguide_id=…` — **קריאה חיה, לא ניחוש**.
2. `qv_usd` = `SUM(CurrentHolding)`.
3. `in_active_roster` = האם ה-`bioguide_id` נמצא ב-545 שב-`quiver_congress_politicians`. **זה גם האימות היחיד של ה-`bioguide_id`.**
4. `last_tx` = `MAX(transaction_date)` ב-`dark_pool_congress_trades` — סיגנל הזרימה **האמיתי** (סעיף 5.4).

### 5.2 טבלת הפתרון — 40 השמות, בסדר המשתמש

עמודות: `qv_n` = מספר holdings שחזרו בקריאה חיה · `qv_usd` = `SUM(CurrentHolding)` · `TC` = `TradeCount` מה-roster · `NW` = `NetWorth` · `db_trades` = שורות ב-`dark_pool_congress_trades` · `last_tx` = עסקה אחרונה שיש לנו · `recon_usd` = מה שהאפליקציה מציגה **היום** (שחזור).

| # | שם המשתמש | `bioguide_id` | `Name` המדויק ב-Quiver | Chamber/Party/State | `NW` | `TC` | `qv_n` | `qv_usd` | `db_trades` | `last_tx` | `recon_usd` | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Nancy Pelosi | `P000197` | `Nancy Pelosi` | House · D · California | $263.2M | 227 | 26 | **$155,527,784** | 126 | 2026-07-28 | $41.8M | ✅ viable |
| 2 | Donald Trump | — | — (אין `bioguide_id`) | Executive | — | — | n/a | n/a | 84 | — | $5.7M | 🟠 מסלול נפרד (5.5) |
| 3 | Tommy Tuberville | `T000278` | `Tommy Tuberville` | Senate · R · Alabama | $6.2M | 1,455 | 37 | $3,243,099 | 1,010 | 2026-06-09 | $2.5M | ✅ viable |
| 4 | Ro Khanna | `K000389` | `Ro Khanna` | House · D · California | **null** | 39,622 | **0** | — | 2,167 | 2026-09-01 | $3.03M | ❌ empty (5.6) |
| 5 | Mark Green | `G000590` | `Mark E. Green` | House · R · Tennessee | **null** | 671 | **0** | — | 578 | 2025-02-28 | — | ❌ empty |
| 6 | Josh Gottheimer | `G000583` | `Josh Gottheimer` | House · D · New Jersey | $38.4M | 3,603 | **199** | $28,443,418 | 1,898 | 2026-08-06 | $307K | ✅ viable |
| 7 | Dan Crenshaw | `C001120` | `Dan Crenshaw` | House · R · Texas | $1.3M | 41 | 7 | **$68,874** | 0 | — | — | ⚠️ thin (שווי זניח) |
| 8 | Michael McCaul | `M001157` | `Michael T. McCaul` | House · R · Texas | **null** | 29,367 | **0** | — | 1,407 | 2026-05-29 | $4.49M | ❌ empty (5.6) |
| 9 | Rick Scott | `S001217` | `Rick Scott` | Senate · R · Florida | **$509.9M** | 409 | 7 | $58,842,816 | 2 | 2023-12-20 | — | ✅ viable |
| 10 | Kevin Hern | `H001082` | `Kevin Hern` | House · R · Oklahoma | $113.4M | 934 | 101 | $29,531,482 | 692 | 2026-08-24 | **$28.8K** | ✅ viable |
| 11 | Suzan DelBene | `D000617` | `Suzan K. DelBene` | House · D · Washington | $129.4M | 833 | 8 | $16,492,655 | 190 | 2024-08-31 | — | ✅ viable |
| 12 | John Curtis | `C001114` | `John R. Curtis` | **Senate** · R · Utah | $18.4M | 363 | 13 | $3,850,039 | 285 | 2023-12-04 | $109K | ✅ viable |
| 13 | Sheldon Whitehouse | `W000802` | `Sheldon Whitehouse` | Senate · D · Rhode Island | $28.0M | 1,032 | 90 | $24,362,114 | 659 | 2026-08-13 | $273K | ✅ viable |
| 14 | Greg Gianforte | `G000584`? | — לא ב-roster | — (מושל Montana) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 15 | Jared Polis | `P000598`? | — לא ב-roster | — (מושל Colorado) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 16 | Pete Sessions | `S000250` | `Pete Sessions` | House · R · Texas | $16.6M | 463 | 39 | $3,817,125 | 378 | 2026-07-24 | — | ✅ viable |
| 17 | Virginia Foxx | `F000450` | `Virginia Foxx` | House · R · North Carolina | $4.7M | 1,009 | 21 | $1,511,664 | 966 | 2026-06-30 | — | ✅ viable |
| 18 | Tom Suozzi | `S001201` | `Thomas R. Suozzi` | House · D · New York | $12.2M | 759 | 6 | $8,773,219 | 621 | 2026-02-18 | — | ✅ viable |
| 19 | Mitch McConnell | `M000355` | `Mitch McConnell` | Senate · R · Kentucky | $69.8M | 45 | 8 | $50,875,829 | 40 | 2026-06-01 | $265K | ✅ viable |
| 20 | Marjorie Taylor Greene | `G000596` | `Marjorie Taylor Greene` | House · R · Georgia | $26.0M | 557 | 85 | $4,465,082 | 479 | 2025-11-21 | $5.7M | ✅ viable |
| 21 | Mark Warner | `W000805` | `Mark R. Warner` | Senate · D · Virginia | $210.9M | 118 | 7 | **$111,993,670** | 0 | — | — | ✅ viable |
| 22 | Pat Fallon | `F000246` | `Pat Fallon` | House · R · Texas | $14.1M | 321 | 37 | $2,718,889 | 0 | — | — | ✅ viable |
| 23 | Diana Harshbarger | `H001086` | `Diana Harshbarger` | House · R · Tennessee | **null** | 1,181 | **0** | — | 484 | 2026-04-16 | — | ❌ empty |
| 24 | Blake Moore | `M001213` | `Blake D. Moore` | House · R · Utah | $9.5M | 151 | **2** | $529,438 | 0 | — | — | ⚠️ thin (2 אחזקות) |
| 25 | John Rutherford | `R000609` | `John H. Rutherford` | House · R · Florida | $1.1M | 348 | 14 | $233,939 | 323 | 2022-03-23 | — | ✅ viable (שווי נמוך) |
| 26 | Lois Frankel | `F000462` | `Lois Frankel` | House · D · Florida | $2.7M | 1,543 | **4** | $254,168 | 1,191 | 2023-09-08 | — | ⚠️ thin (4 מ-1,543 עסקאות) |
| 27 | Earl Blumenauer | `B000574`? | — לא ב-roster | — (פרש 2025) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 28 | Gary Peters | `P000595` | `Gary C. Peters` | Senate · D · Michigan | $7.5M | 208 | **96** | $3,725,825 | 2 | 2026-07-23 | — | ✅ viable |
| 29 | Ron Wyden | `W000779` | `Ron Wyden` | Senate · D · Oregon | $25.2M | 322 | 42 | $12,919,276 | **0** | — | — | ✅ viable |
| 30 | John Boozman | `B001236` | `John Boozman` | Senate · R · Arkansas | $3.4M | 427 | 98 | $2,773,132 | 390 | 2026-08-27 | $965K | ✅ viable |
| 31 | Steve Cohen | `C001068` | `Steve Cohen` | House · D · **Tennessee** | $10.5M | 163 | 32 | $3,715,648 | 0 | — | — | ✅ viable ⚠️ (5.3) |
| 32 | William Keating | `K000375` | `William R. Keating` | House · D · Massachusetts | $3.4M | 201 | 43 | $862,572 | 0 | — | — | ✅ viable |
| 33 | Marie Newman | `N000192`? | — לא ב-roster | — (הפסידה 2022) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 34 | Dean Phillips | `P000616`? | — לא ב-roster | — (סיים 2025) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 35 | Scott Franklin | `F000472` | `Scott Franklin` | House · R · Florida | $11.4M | 279 | 25 | $3,838,508 | 0 | — | — | ✅ viable |
| 36 | Victoria Spartz | `S000929` | `Victoria Spartz` | House · R · Indiana | $25.5M | 29 | **1** | $909,804 | 0 | — | — | ⚠️ thin (אחזקה אחת: `SPG`) |
| 37 | Bill Hagerty | `H000601` | `Bill Hagerty` | Senate · R · Tennessee | $55.3M | 65 | 64 | $19,488,821 | 0 | — | — | ✅ viable |
| 38 | Bob Gibbs | `G000563`? | — לא ב-roster | — (התפטר 2022) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 39 | Tom Carper | `C000174`? | — לא ב-roster | — (פרש 2025) | — | — | 0 | — | 0 | — | — | ❓ not found (5.4) |
| 40 | Chuck Fleischmann | `F000459` | `Charles J. "Chuck" Fleischmann` | House · R · Tennessee | **null** | 208 | **0** | — | 0 | — | — | ❌ empty |

> `db_trades = 0` ב-11 שורות הוא **לא** חוסר בנתוני Quiver — זו תוצאה של כך ש-deep sync רץ היום רק על 16 המאוצרים (סעיף 3). הוא ייפתר אוטומטית כשה-roster יגדל ל-40.

### 5.3 אי-בהירות שמות — מלכודות שאומתו

| מלכודת | הסיכון | הפתרון המאומת |
|---|---|---|
| **Steve Cohen** | 🔴 **החמור ביותר.** `C001068` `Steve Cohen` הוא **חבר הקונגרס מטנסי (D-TN-9)**, `NetWorth` $10.5M. **הוא לא** Steven A. Cohen מ-Point72 שנמצא ברשימת ה-whales הנפרדת של המשתמש (מזהה 13F/CIK, שווי ~$20B+). | שני ה-namespace חייבים להישאר **מופרדים פיזית**: הפוליטיקאי נפתר דרך `bioguide_id` בלבד; ה-whale דרך `cik`. **אסור** לאחד אותם בטבלת `roster` אחת עם מפתח שם. סעיף 6 מגדיר `source` + `external_id` כמפתח מורכב בדיוק בשביל זה. |
| **Mark Green** | ב-roster יש `G000590` `Mark E. Green` (House·R·TN) וגם `G000553` `Al Green` (House·D·TX) וגם `G000596` `Marjorie Taylor **Greene**`. חיפוש `~* 'green'` מחזיר את שלושתם. | `G000590` הוא הנכון. שים לב ש-`Greene`/`Green` נבדלים באות אחת. |
| **John Curtis** | עבר **House → Senate** (נבחר לסנאט 2024). ה-roster מציג `Chamber = Senate`, אבל 285 העסקאות שלנו הן מתקופת ה-House, ו-`last_tx = 2023-12-04`. | ה-`bioguide_id` **לא משתנה** במעבר בין הבתים — `C001114` תקף לשתי התקופות. לא צריך מיזוג. |
| **Blake Moore** | ב-roster: `Barry Moore` (AL), `Gwen Moore` (WI), `Riley Moore` (WV), `Tim Moore` (NC), `Shelley **Moore** Capito` (WV). | `M001213` `Blake D. Moore` (UT). |
| **Rick Scott** | «Scott» הוא גם שם פרטי וגם שם משפחה: `Austin Scott`, `David Scott`, `Bobby Scott`, `Tim Scott`, `Scott Perry`, `Scott Fitzgerald`, `Scott DesJarlais`, **`Scott Franklin`** (#35 ברשימה!), `Scott H. Peters`. | `S001217` = הסנאטור מפלורידה. `F000472` = Scott Franklin. |
| **Gary Peters** | `P000595` `Gary C. Peters` (Senate·D·MI) מול `P000608` `Scott H. Peters` (House·D·CA) — **שני אנשים שונים לגמרי**, שניהם עם `TradeCount` גבוה. | `P000595` הוא מה שהמשתמש ביקש (#28). |
| **Victoria Spartz** | 🔴 Quiver מחזיק אותה תחת `S000929`. ניסיתי גם את מה שנראה כמו ה-BioGuide הרשמי, `S001215` — **והוא החזיר `Haley M. Stevens`** (2 אחזקות, $132,105). | **מוסר ההשכל הכללי: לעולם לא לנחש `bioguide_id`.** ID שגוי לא מחזיר שגיאה — הוא מחזיר **את התיק של אדם אחר**, ובלי הצלבת שם זה היה מוצג בשקט תחת השם הלא נכון. כל פתרון חייב לעבור דרך `quiver_congress_politicians` **ולהצליב את `Name`**. |

### 5.4 סטטוס כהונה — מי כבר לא מכהן

**7 שמות אינם ב-roster של 545.** הסיבה מבנית: `sync-quiver-congress-cache` קורא ל-`/beta/live/congresspoliticians` עם `is_active = true` (מקובע בקוד, לא נגיש מה-body), כך שחברים לשעבר מסוננים לפני שהם מגיעים אלינו.

| שם | `bioguide_id` משוער | סטטוס אמיתי | `last_tx` אצלנו | `qv_n` |
|---|---|---|---|---|
| Greg Gianforte | `G000584` | מושל Montana מ-2021 (היה House 2017–2021) | **אין — 0 שורות** | 0 |
| Jared Polis | `P000598` | מושל Colorado מ-2019 (היה House 2009–2019) | **אין — 0 שורות** | 0 |
| Earl Blumenauer | `B000574` | פרש בסוף ה-118 (ינואר 2025) | **אין — 0 שורות** | 0 |
| Marie Newman | `N000192` | הפסידה בפריימריז 2022 | **אין — 0 שורות** | 0 |
| Dean Phillips | `P000616` | לא התמודד לבחירה חוזרת, סיים ינואר 2025 | **אין — 0 שורות** | 0 |
| Bob Gibbs | `G000563` | התפטר באמצע כהונה (2022) | **אין — 0 שורות** | 0 |
| Tom Carper | `C000174` | פרש מהסנאט (ינואר 2025) | **אין — 0 שורות** | 0 |

**⚠️ הסתייגות מתודולוגית חשובה — ה-`bioguide_id` של השבעה הוא «לא מאומת».** הם לא ב-roster, ואין להם אף שורה ב-`dark_pool_congress_trades` (נבדק גם לפי ID וגם לפי `politician_name ~*`), כך שאין לי שני מקורות להצליב. כשקראתי להם ב-endpoint האחזקות חזר `[]` — אבל **`[]` לא מבדיל בין «ID שגוי» ל-«ID נכון בלי אחזקות»**.

**למה זה לא משנה את ההחלטה:** `S001215` הוכיח שה-endpoint **כן** מחזיר נתונים ל-ID תקף שאינו ברשימה שלי. בנוסף, ה-endpoint מתועד כמחזיר את האחזקות של «members of U.S. Congress» — כלומר **מכהנים בהגדרה**. לכן חבר לשעבר יחזיר `[]` גם אם ה-ID מושלם. **שבעתם ❌ בפועל, בלי קשר לשאלת ה-ID.**

**🔴 ממצא נפרד: `is_active` של Quiver מתעכב אחרי המציאות.** שניים שה-roster מסמן כפעילים כבר אינם מכהנים בפועל:

| שם | `is_active` ב-Quiver | המציאות | `last_tx` |
|---|---|---|---|
| **Mark Green** (`G000590`) | `true` | התפטר מהקונגרס ב-2025 | 2025-02-28 (‎1.6 שנים) |
| **Marjorie Taylor Greene** (`G000596`) | `true` | הודיעה על התפטרות מ-ינואר 2026 | 2025-11-21 (‎10 חודשים) |

**מסקנה תכנונית:** אין להסתמך על `is_active` כסיגנל «חי». הסיגנל האמין הוא **`last_tx` מ-`dark_pool_congress_trades`**, ולכן סעיף 6 מוסיף `last_trade_at` לטבלת ה-roster וממליץ על תג UI «אין זרימה חדשה מאז X» מעל ‎12 חודשים.

**זרימה מיושנת בקרב המכהנים** (יש אחזקות, אבל הפיד מת): Rutherford 2022-03 (‎4.5 שנים) · Frankel 2023-09 · Rick Scott 2023-12 · Curtis 2023-12 · DelBene 2024-08.

### 5.5 Trump — ייצוג בתוך מודל ה-roster
| | |
|---|---|
| Endpoint | `GET /beta/bulk/trumpstocktrades` · `Tier 1` + `public` · «Default page size is 200» |
| פרמטרים | `page`, `page_size` **בלבד** |
| שדות | `Ticker`, `Company`, `Transaction`, `Amount` (string, «Value of the stock transaction (USD)»), `Filed`, `Traded`, `ExcessReturn` (number) |
| `BioGuideID` | **אין.** המזהה אצלנו הוא UUID פנימי `TRUMP_DARKPOOL_PERSON_ID = 888dc73f-f1eb-485a-a241-80657aaaaff9` |
| **endpoint אחזקות** | **🔴 לא קיים.** אין `trumpstockholdings`, ולא ניתן לפנות אליו ב-`congress_stock_holdings` (הפרמטר הוא `bioguide_id` ולטראמפ אין אחד) |

**המצב הנוכחי שלו** (`dark_pool_person_portfolio_snapshots`): `portfolio_value` $5,717,152 · `total_return_pct` 12.87% · 25 אחזקות · 22 נקודות בסדרה · `chart_reliable = true` · 84 עסקאות · `ALL = 14.92%`.

**🟢 חדשות טובות:** התיק של טראמפ הוא **מהמעטים שנראים סבירים היום** — `chart_reliable = true`, תשואה 12.9%, בלי חריגות. הסיבה: `Amount` ב-`trumpstocktrades` מתועד כ-«Value of the stock transaction (USD)» — **דולר ממשי, לא טווח STOCK Act.** אין שם `STOCK_ACT_FLOOR_MID`.

**המלצה:** **לא לגעת בטראמפ.** להשאיר אותו על השחזור מ-`trumpstocktrades`, ולנצל ש-`ExcessReturn` חוזר בכל שורה ונזרק היום (H1 באודיט).

#### איך הוא יושב ב-roster כ-entry ממדרגה ראשונה

העיקרון: **ה-roster מפתח לפי `(source, external_id)`, לא לפי `bioguide_id`.** זה מה שמאפשר לטראמפ להיות שורה רגילה לגמרי, ובאותה הזדמנות גם מונע את התנגשות Steve Cohen מסעיף 5.3.

| שדה ב-`dark_pool_curated_roster` | Trump | פוליטיקאי רגיל (Pelosi) |
|---|---|---|
| `person_id` | `888dc73f-f1eb-485a-a241-80657aaaaff9` | `P000197` |
| `source` | `'quiver_trump'` | `'quiver_congress'` |
| `external_id` | `'TRUMP'` | `'P000197'` |
| `bioguide_id` | `NULL` ← **חייב להיות nullable** | `'P000197'` |
| `kind` | `'executive'` | `'politician'` |
| `holdings_source` | `'reconstruction_actual_usd'` | `'quiver_live_holdings'` |
| `chamber` / `party` / `state` | `NULL` | `House` / `Democratic` / `California` |
| `last_trade_at` | מ-`trumpstocktrades.Traded` | מ-`dark_pool_congress_trades` |

שלוש נגזרות מעשיות:

1. **`bioguide_id` nullable + `holdings_source` כעמודה מפורשת.** אלה שתי הדרישות הסכמתיות היחידות שטראמפ מוסיף. בלי `holdings_source` ה-UI לא יוכל להחליט אם להציג גרף (טראמפ: כן) או להסתיר אותו (מאוצר עם `quiver_live_holdings`: לא, לפי ההיגיון הקיים ב-`uw-investor-profile`).
2. **`holdings_source = 'reconstruction_actual_usd'` הוא ערך שלישי ומובחן** — לא `'quiver_live_holdings'` ולא `'reconstruction_stock_act_range'`. ההבדל מהותי: `Amount` ב-`trumpstocktrades` הוא דולר ממשי, ולכן טראמפ הוא **היחיד** שמותר להציג לו גם תיק **וגם** גרף היסטורי **וגם** תשואה, בלי תג «הערכה». שלושת הערכים ממפים ישירות למה שה-UI מותר להראות.
3. **ה-sync שלו לא נכנס למכסת ה-40 קריאות.** `trumpstocktrades` הוא bulk אחד ל-*כל* העסקאות שלו — קריאה אחת, לא קריאה-לאדם. עלות ה-sync של הרשימה נשארת כפי שחושב בסעיף 6.

### 5.6 בעיית Khanna / McCaul — חקירה והמלצה

שני השמות הפעילים ביותר ברשימה (#4 ו-#8) מחזירים `[]`. זו הבעיה הכי יקרה ברשימה, כי היא בדיוק במקום שבו הביקוש הכי גבוה.

**מה אומתה:**

| | Ro Khanna | Michael McCaul | להשוואה: Gottheimer (עובד) |
|---|---|---|---|
| `TradeCount` | **39,622** | **29,367** | 3,603 |
| `TradeVolume` | $650M | $1.48B | $349M |
| `NetWorth` | **null** | **null** | $38.4M |
| `qv_n` | **0** | **0** | 199 |
| עסקאות אצלנו | 2,167 | 1,407 | 1,898 |
| tickers ייחודיים (במדגם) | 480 | 261 | 362 |
| `$ / עסקה` | $16.4K | $50.4K | $96.9K |

**מה שנשלל בבדיקה:**

- **לא שגיאת parsing.** בדקתי את השורות שלהם בפועל: `amount_label` תקני (`1001.0`, `15001.0`, `50001.0`…), טיקרים נורמליים (`UBER`, `MU`, `MSFT`), חלוקת buy/sell מאוזנת. הדאטה שלהם נראית **זהה במבנה** לזו של Gottheimer שכן עובד.
- **לא «יותר מדי עסקאות» כשלעצמו.** Gottheimer עם 3,603 ו-Cisneros עם 2,728 מקבלים אחזקות (199 ו-464 בהתאמה). מצד שני `Mark Kelly` עם `TradeCount = 1` גם מחזיר `[]`. `TradeCount` **אינו** המשתנה המסביר.
- **לא גודל עסקה חריג.** השוויתי את חתימת גודל-העסקה בין הקוהורטות (`TradeCount ≥ 200`): `$/trade` ממוצע $66K בקבוצה הריקה מול $89K בקבוצה עם אחזקות — **הפרש לא מובהק**. השערת «חשבון מנוהל עם churn קטן» לא נתמכת מספרית.

**מה שכן מתואם, ומושלם:**

> `NetWorth = null` → `[]` ב-**6/6** מהמקרים, מול **0/54** מקרים נגדיים בקבוצת `TradeCount ≥ 200` עם `NetWorth` קיים.

זה מצביע על **כשל בשכבת ה-modeling של Quiver, לא על חוסר בגילויים**. `NetWorth` ו-`CurrentHolding` שניהם תוצרים **מחושבים** של Quiver מתוך אותם דוחות STOCK Act. כששני הפלטים נופלים יחד ובאופן מושלם, ההסבר הפשוט הוא שהם יוצאים מאותו pipeline הערכה, וש-Khanna ו-McCaul מפילים אותו.

**למה דווקא הם:** שניהם מדווחים עשרות אלפי טרנזקציות מחשבונות שאינם בשליטתם הישירה — אצל Khanna חשבונות מנוהלים של בני המשפחה, אצל McCaul נכסי אשתו והנאמנויות המשפחתיות. **⚠️ זה הסבר סביר ולא אימות:** ל-schema של Quiver **אין שדה owner/spouse/filer בכלל** (בדקתי את כל 20 סכמות ה-congress ב-`schema.json` — אין `Owner`, אין `Spouse`, אין `FilerType`). כלומר אנחנו **לא יכולים** להבדיל self מ-spouse מ-trust דרך Quiver, ולכן ההשערה הזו לא ניתנת להוכחה או להפרכה מהדאטה שיש לנו. זה עצמו פער מתועד.

#### ההמלצה: פיד עסקאות בלבד, בלי תיק ובלי גרף

| אופציה | הערכה |
|---|---|
| A. להסיר | ❌ Khanna הוא #1 בפעילות בכל הקונגרס ו-`last_tx` שלו הוא לפני שבועיים. להסיר אותו זה להסיר את השם שהמשתמשים הכי מחפשים. |
| B. שחזור עם תג «הערכה» | ❌ **זו האופציה שנראית הגיונית וצריך לדחות אותה.** השחזור נותן ל-Khanna $3.03M ול-McCaul $4.49M — מול `TradeVolume` של $650M ו-$1.48B. סעיף 4 מדד סטייה חציונית ×5 והגיע עד ×1,025; דווקא אצל שני אלה השחזור הוא הכי לא אמין, כי הוא נבנה מ-5% מהעסקאות (2,167 מ-39,622). **תג «הערכה» לא מציל מספר שגוי בשני סדרי גודל** — הוא רק מעביר את האשמה למשתמש. |
| **C. פיד עסקאות בלבד** | ✅ **מומלץ.** `holdings_source = 'trades_only'`: מציגים פיד עסקאות עשיר וטרי, ולא מציגים תיק, לא שווי ולא תשואה. |

הנימוק: העסקאות שלהם הן **דאטה גולמית מדווחת** ולכן נכונות; התיק הוא **הסקה** ולכן שגוי. אופציה C מציגה בדיוק את החלק שנכון. בנוסף Khanna ו-McCaul הם הסוחרים הפעילים ביותר — פיד העסקאות שלהם הוא *ממילא* התוכן המעניין יותר מתיק סטטי.

**הכללה — הכלל שצריך להיכנס ל-pipeline:**

```
if NetWorth is null      -> holdings_source = 'trades_only'   (דלג על קריאת האחזקות, חוסך API calls)
elif qv_n == 0           -> holdings_source = 'trades_only'
elif qv_n < 5            -> holdings_source = 'quiver_thin'    (הצג אחזקות, בלי טענת «תיק מלא»)
else                     -> holdings_source = 'quiver_live_holdings'
```

זה מכסה אוטומטית את כל 5 ה-❌ (Khanna, McCaul, Harshbarger, Mark Green, Fleischmann) ואת 4 ה-⚠️ (Crenshaw, Blake Moore, Frankel, Spartz), ומונע את המצב שבו אנחנו מציגים בשקט מספר מומצא.

### 5.7 המלצת roster סופית

#### Wave 1 — ‎24 שמות, לשילוח מיידי

אחזקות אמיתיות מאומתות בקריאה חיה (`qv_n ≥ 5`, `qv_usd ≥ $200K`), ‎+‎ טראמפ שכבר תקין:

`P000197` Pelosi · `TRUMP` Trump · `T000278` Tuberville · `G000583` Gottheimer · `S001217` Rick Scott · `H001082` Hern · `D000617` DelBene · `C001114` Curtis · `W000802` Whitehouse · `S000250` Sessions · `F000450` Foxx · `S001201` Suozzi · `M000355` McConnell · `G000596` MTG · `W000805` Warner · `F000246` Fallon · `R000609` Rutherford · `P000595` Gary Peters · `W000779` Wyden · `B001236` Boozman · `C001068` Steve Cohen (TN) · `K000375` Keating · `F000472` Scott Franklin · `H000601` Hagerty

מתוכם **הגרעין החזק** (‎≥‎40 אחזקות או ‎≥‎$20M, הכי טובים ל-hero/explore): Pelosi, Gottheimer, Hern, Whitehouse, MTG, Warner, Gary Peters, Wyden, Boozman, Hagerty, McConnell, Rick Scott.

שתי הסתייגויות לתייג ב-UI, לא לחסום עליהן: **MTG** — אחזקות טובות אבל הזרימה מתה מ-2025-11 (מתפטרת). **Rutherford** — ‎14 אחזקות אבל רק $234K, ו-`last_tx` מ-2022.

#### Wave 2 — ‎9 שמות, אחרי שה-`holdings_source` מסעיף 5.6 קיים

| שם | `holdings_source` | מה מוצג |
|---|---|---|
| `K000389` Ro Khanna | `trades_only` | פיד עסקאות (‎#1 בפעילות, `last_tx` לפני שבועיים) |
| `M001157` Michael McCaul | `trades_only` | פיד עסקאות |
| `H001086` Diana Harshbarger | `trades_only` | פיד עסקאות (‎484 עסקאות, פעילה עד 2026-04) |
| `C001120` Dan Crenshaw | `quiver_thin` | ‎7 אחזקות, $68.9K — בולטות גבוהה, תיק זעיר |
| `M001213` Blake Moore | `quiver_thin` | ‎2 אחזקות |
| `F000462` Lois Frankel | `quiver_thin` | ‎4 אחזקות |
| `S000929` Victoria Spartz | `quiver_thin` | אחזקה אחת (`SPG`) |
| `F000459` Chuck Fleischmann | `trades_only` | `NetWorth` null · ‎208 עסקאות ב-Quiver |
| `G000590` Mark Green | `trades_only` | ‎578 עסקאות אצלנו, אבל התפטר — ארכיון |

#### לשקול הסרה — ‎7 שמות

שבעת חברי-הקונגרס-לשעבר מסעיף 5.4: **Gianforte, Polis, Blumenauer, Marie Newman, Dean Phillips, Bob Gibbs, Tom Carper**. לכולם: `bioguide_id` **לא מאומת**, `qv_n = 0`, **ואפס עסקאות אצלנו** — כלומר לא תיק, לא פיד, ואף לא ארכיון. במצב הנוכחי הם ייצרו ‎7 פרופילים ריקים לחלוטין. Gianforte ו-Polis גם אינם פוליטיקאים פדרליים יותר אלא מושלים, כך שהם מטעים קטגורית.

**מה שצריך לקרות לפני שהם חוזרים לדיון:** משיכת היסטוריה שלהם דורשת `/beta/bulk/congresstrading?bioguide_id=…` — שגם יאמת את ה-ID וגם ימלא את הפיד. זו קריאה שלא ביצעתי כי היא **כותבת** ל-`dark_pool_congress_trades` בפרודקשן, מחוץ להרשאות הסבב הזה. זו בדיקה של ‎15 דקות, והיא התנאי היחיד להחזרתם.

#### ‎5 תוספות מוצעות — **לא מרשימת המשתמש**

מופרד בכוונה. אלה השמות שבלטו מעבר ל-545 שנסרקו, ושהיו נכנסים ל-Wave 1 ללא סייג:

| שם | `bioguide_id` | `qv_n` / `qv_usd` | הראיה |
|---|---|---|---|
| **Gilbert Ray Cisneros, Jr.** | `C001123` | **464** / $37.8M | **התיק המפורט ביותר מבין כל 545.** `TradeCount` 2,728 · מוכיח ש-«פעילות גבוהה» *לא* שוללת אחזקות טובות — ההיפך מ-Khanna |
| **Shelley Moore Capito** | `C001047` | 81 / $2.5M | **הזרימה הטריה ביותר בכל הבדיקה:** ‎548 עסקאות אצלנו, `last_tx = 2026-07-21`. סנאטורית מכהנת |
| **Robert Bresnahan** | `B001327` | **376** / $14.2M | חבר חדש עם ‎376 אחזקות מדווחות — צפיפות דאטה נדירה, וזווית «הטרי שסוחר הכי הרבה» |
| **Susan M. Collins** | `C001035` | 45 / $4.3M | זיהוי שם גבוה מאוד (הסנאטורית הסווינגית), `TradeCount` 637, דאטה נקייה |
| **Markwayne Mullin** | `M001190` | 87 / $26.4M | סנאטור · `chart_reliable = true` **כבר היום** — אחד המעטים שבהם השחזור וה-Quiver לא מתנגשים |

---

## 6. מודל נתונים ותוכנית בנייה

### 6.1 טבלאות חדשות

**(א) `dark_pool_curated_roster`** — מקור אמת יחיד לרשימה, במקום 3 רשימות קשיחות שצריך לסנכרן ידנית (`curatedExploreProfiles.ts`, `CURATED_CONGRESS_BIOGUIDES`, `CURATED_MATERIALIZE_TARGETS`).

```
person_id            text PRIMARY KEY     -- bioguide_id, או UUID ל-executive
kind                 text NOT NULL        -- 'politician' | 'executive' | 'fund_manager'
display_name         text NOT NULL
display_name_he      text
bioguide_id          text                 -- NULL לטראמפ
chamber              text                 -- 'House' | 'Senate'  (Quiver: Chamber)
party                text                 -- Quiver: Party
state                text                 -- Quiver: State
image_url            text                 -- Quiver: ImageURL (542/545 קיים)
holdings_source      text NOT NULL        -- 'quiver_live_holdings' | 'quiver_thin' | 'trades_only'
                                          -- | 'reconstruction_actual_usd' (Trump) | 'sec13f' (whales)
rank                 int                  -- סדר תצוגה
is_active            boolean DEFAULT true
trade_count          int                  -- Quiver: TradeCount (מטמון תצוגה)
trade_volume_usd     numeric              -- Quiver: TradeVolume
net_worth_usd        numeric              -- Quiver: NetWorth (גם pre-filter לכיסוי)
notes                text
UNIQUE (bioguide_id) WHERE bioguide_id IS NOT NULL
```

`holdings_source` הוא הלב: הוא מאפשר ל-Khanna ול-McCaul לשבת באותה רשימה עם `'trades_only'`, ולטראמפ עם `'reconstruction_actual_usd'`, בלי לזלזל באיכות של ה-88%. הערכים נקבעים אוטומטית לפי עץ ההחלטה בסעיף 5.6.

**(ב) `dark_pool_person_holdings_snapshots`** — התיק, בגרנולריות של אחזקה, עם `as_of_date` שאנחנו מחתימים.

```
id                   bigserial PRIMARY KEY
person_id            text NOT NULL REFERENCES dark_pool_curated_roster(person_id)
as_of_date           date NOT NULL        -- ← אנחנו מייצרים; Quiver לא מספק
ticker               text NOT NULL
current_holding_usd  numeric              -- Quiver: CurrentHolding (as-is, ללא עיגול)
allocation_pct       numeric              -- Quiver: Allocation * 100  (מאומת: שבר 0..1)
holder_name          text                 -- Quiver: Name
source               text NOT NULL        -- 'quiver_bioguide'
fetched_at           timestamptz NOT NULL DEFAULT now()
UNIQUE (person_id, as_of_date, ticker)
```

**למה `as_of_date`, ובנפרד מ-`fetched_at`:** אין תאריך מ-Quiver. `fetched_at` הוא זמן הקריאה; `as_of_date` הוא היום הלוגי. הפרדה מאפשרת גם re-fetch באותו יום וגם backfill.

**למה שורה-לאחזקה ולא JSONB:** (1) הצטברות snapshots יומיים = **סדרת הזמן שחסרה** — `SUM(current_holding_usd) GROUP BY as_of_date` היא בדיוק גרף שווי התיק, **מנתון אמיתי במקום משחזור Yahoo**; (2) `GROUP BY ticker` נותן «מי מחזיק את AAPL» בלי endpoint חדש; (3) מאפשר לקבוע אמפירית אם Quiver עושה mark-to-market (סעיף 2.4).

**(ג) *(אופציונלי, סבב 3)* `dark_pool_person_value_series`** — טבלת עזר מוצמצמת `(person_id, as_of_date, total_value_usd, holdings_count)`, אם ה-`GROUP BY` על (ב) יהיה כבד.

### 6.2 תכנון הסנכרון

| | |
|---|---|
| Endpoint | `GET /beta/live/congress_stock_holdings?bioguide_id=<bg>&sort_by_holding=true` |
| קריאות לריצה | **קריאה אחת לכל אדם** (אין pagination) |
| בגודל הרשימה בפועל | **32 קריאות** — ‎40 שמות פחות Trump (bulk נפרד), פחות ‎5 `NetWorth=null` שנחסכים ב-pre-filter, פחות ‎2 מה-❓ |
| בגודל 75 (גבול בטוח) | 75 קריאות |
| Cadence מוצע | **יומי** — מתלבש על `sync-quiver-congress-cache-daily` (`15 6 * * *`) הקיים |
| שימוש חודשי | 32 × 30 ≈ **960 קריאות/חודש** (75 → 2,250) |
| Throttle | `delay(150)` כמו היום → 32 מזהים ≈ 5 שניות wall-clock. אומת: ‎18 מזהים סיימו ב-**8.4 שניות** end-to-end בריצת האימות של ‎40 השמות |
| Rate limits | **לא מאומת** — אין תיעוד. להשאיר את ה-delay |
| אימות טרם ריצה | `net_worth_usd IS NOT NULL` — חוסך קריאות מבוזבזות (0/5 כיסוי כשהוא `null`) |

**עלות זניחה.** להשוואה: `sync-congress-trades-20m` רץ **72×/יום** ועושה עד 20 עמודי `bulk/congresstrading` × 16 מאוצרים.

**נקודת עלות אמיתית:** 365 snapshots/שנה × 32 אנשים × ~50 אחזקות ≈ **620K שורות/שנה** ב-(ב). זה בסדר גמור, אבל צריך `PARTITION BY RANGE (as_of_date)` או retention (למשל: יומי ל-90 יום, ואז שבועי).

**נקודת כישלון שדורשת טיפול מפורש:** תשובה ריקה וכשל API **נראות זהות** (`200 OK` + `[]`). חובה: **לא לכתוב snapshot ריק שדורס תיק תקין מאתמול.** הכלל — אם `rows.length === 0` **ובאתמול היו** `> 0`, לדלג ולהתריע. הפייפליין הקיים כבר עושה משהו דומה (`index.ts:130`: `if (!byBioguide[bg]) byBioguide[bg] = []` — שומר על הקיים), אבל **לא ברמת ההחלטה הזו.**

### 6.3 יחסי גומלין עם הפייפליין הקיים — **שומרים על שניהם. חובה.**

| רכיב | תפקיד היום | תפקיד אחרי הפיבוט |
|---|---|---|
| `sync-congress-trades` (`*/20`) | פיד + deep history | **בלי שינוי.** הפיד הוא מוצר נפרד |
| `dark_pool_congress_trades` | עסקאות | **בלי שינוי.** מקור ל-«עסקאות אחרונות» ול-`avg_delay_days` |
| `sync-quiver-congress-cache` (`15 6`) | roster + holdings ל-cache JSON | **מורחב** — כותב גם ל-(ב) עם `as_of_date` |
| **`congressPortfolio.ts` שחזור** | שווי + אחזקות + גרף + תשואות | **מצטמק לתפקיד אחד:** **גרף/תשואות בלבד**, עד שנצבור 60–90 snapshots. הוא **לא** משמש יותר לשווי תיק לאף פוליטיקאי (Khanna/McCaul עוברים ל-`trades_only`, לא לשחזור) |
| `materialize-darkpool-portfolios` | snapshots של תיק | **בלי שינוי בסבב 1.** בסבב 3 — לקרוא holdings מ-(ב) |
| `uw-investor-profile` `preferQuiverHoldings` | fallback ל-holdings | **הופך לברירת מחדל** לפי `holdings_source` |

**🔴 השחזור נחוץ. לא ניתן להסיר אותו.** שלוש סיבות:

1. **אין היסטוריה ב-bioguide holdings.** הגרף ו-`period_returns` הם ההצדקה הבלעדית לשחזור.
2. **Khanna ו-McCaul.** שני הסוחרים הפעילים ביותר. לשניהם השחזור הוא הנתון היחיד.
3. **צבירת snapshots לוקחת זמן.** 60–90 ימי snapshots כדי שגרף שנבנה מ-(ב) יהיה בעל משמעות. עד אז השחזור הוא הגרף היחיד.

**המדרג המוצע (הכי חשוב במסמך):**

```
שווי תיק + רשימת אחזקות + allocation:
    dark_pool_person_holdings_snapshots (AS OF latest)      ← Quiver, 88%
  → congressPortfolio reconstruction                        ← Khanna/McCaul + ה-12%
  → trumpstocktrades notional                               ← executive
  → אין

גרף שווי לאורך זמן + period_returns:
    GROUP BY as_of_date על snapshots  (כשיש ≥60 נקודות)     ← עתידי, נתון אמיתי
  → congressPortfolio series  (רק כש-chart_reliable = true) ← 6/32 היום
  → אין גרף  (זה מה שקורה כבר היום ב-uw-investor-profile:336)
```

זה **לא מפיל** את תשתית השחזור — הוא מוריד אותה מ-«המקור לכל דבר» ל-«המקור לגרף», בדיוק במקום שבו היא יחסית שמישה.

### 6.4 סדר גלילה ומאמץ

| # | שלב | מה | מאמץ | תלוי ב- |
|---|---|---|---|---|
| **R0** | **אישור הרשימה** | ‎40 השמות נפתרו בסעיף 5. נותרו ‎2 החלטות: (1) ‎7 חברי-הקונגרס-לשעבר — להסיר או לאמת `bioguide_id` דרך `bulk/congresstrading`; (2) לאשר `trades_only` ל-Khanna/McCaul. | **XS** — החלטה בלבד | — |
| **R1** | **מיגרציה + backfill** | יצירת (א) ו-(ב). seed של (א) מ-`quiver_congress_politicians` (`ImageURL`/`Chamber`/`Party`/`State`/`TradeCount`/`TradeVolume`/`NetWorth` — **הכל כבר ב-DB, אפס קריאות**). backfill ראשון ל-(ב) = 32 קריאות. | **S** — מיגרציה + סקריפט seed | R0 |
| **R2** | **הרחבת הסנכרון** | `sync-quiver-congress-cache` קורא לפי (א) במקום `CURATED_CONGRESS_BIOGUIDES`; כותב ל-(ב) עם `as_of_date`. **חובה:** הגנת «אל תדרוס תיק תקין עם `[]`». לתקן `parseQuiverAllocationPct` ל-`* 100` ללא heuristic. | **S** | R1 |
| **R3** | **קריאה בפרופיל** | `uw-investor-profile` קורא holdings מ-(ב) לפי `as_of_date` העדכני; `holdings_source` נקבע לפי (א) ולא לפי `CURATED_ID_SET`. | **M** | R2 |
| **R4** | **כנות ב-UI** | `holdings_source` גלוי. «אחזקות מניות מוערכות · Quiver» (**לא** «שווי נטו»). מצב «לא מחזיק/ה מניות» ל-AOC/Warren/Schumer. `QuiverAttribution` (הקומפוננטה כבר קיימת, untracked). | **S** | R3 |
| **R5** | **תיקון באגים שנחשפו** | `MAX_DISPLAYABLE_PERIOD_RETURN_PCT` לא חל על notional fallback (`congressPortfolio.ts:968`) — `ALL=1186%` ב-DB. + הסרת `LastTraded`/`House`/`'Net Worth'` מ-`QuiverPolitician` (מאומת כלא-קיימים). + תיקון `UNUSUAL_WHALES_INTEGRATION.md:21`. | **S** — **אפשר במקביל, לא תלוי בכלום** | — |
| **R6** | **איחוד הרשימות** | `curatedExploreProfiles.ts` + `CURATED_CONGRESS_BIOGUIDES` + `CURATED_MATERIALIZE_TARGETS` → קריאה מ-(א). מבטל את הצורך בסנכרון ידני שההערה ב-`curatedExploreProfiles.ts:14` מזהירה ממנו. | **M** | R3 |
| **R7** | **סדרת זמן מ-snapshots** | אחרי 60–90 ימי (ב): לבנות `period_returns` מ-`GROUP BY as_of_date`. גרף מנתון אמיתי במקום משחזור Yahoo. | **M** | R2 + **זמן קלנדרי** |
| **R8** | **צמצום השחזור** | לצמצם את `congressPortfolio.ts` ל-גרף בלבד (ול-Trump). **אין** מסלול שחזור-תיק יותר — סעיף 5.6 דוחה אותו במפורש. **לא להסיר.** | **M** | R7 |

**נתיב קריטי ל-«התיקים לא נראים מופרכים»: R0 → R1 → R2 → R3 → R4.** מאמץ מצטבר: **XS + S + S + M + S**.
**R5 אורתוגונלי לחלוטין ונותן ROI מיידי — כדאי להתחיל בו במקביל.**

---

## 7. סתירות ותיקוני תיעוד

| # | מה | ראיה | פעולה |
|---|---|---|---|
| 1 | **`Allocation` = שבר 0–1, לא «percentage»** | `SUM(Allocation) = 1.00` בדיוק אצל 19/19. `M000355`/`VOO` = `0.7639` | לתעד. `parseQuiverAllocationPct` → `* 100` ללא heuristic + `// verified live` |
| 2 | **`LastTraded` לא קיים** | לא ב-`PoliticianDetailEntry` ולא ב-10 המפתחות בתשובה החיה | להסיר מ-`QuiverPolitician`. `sync-quiver-congress-cache/index.ts:85` כותב `undefined` |
| 3 | **`House` / `'Net Worth'` ב-`QuiverPolitician` לא קיימים** | הסכימה והתשובה אומרות `Chamber` ו-`NetWorth` | להסיר את ה-aliases |
| 4 | **`UNUSUAL_WHALES_INTEGRATION.md:21` מציין `LastTraded`** | כנ״ל | לתקן ל-`State`/`ImageURL`/`TradeVolume`/`NetWorth` |
| 5 | **`MAX_DISPLAYABLE_PERIOD_RETURN_PCT` לא חל ב-notional fallback** | `C001055` → `ALL = 1186.32` ב-DB | `sanitizePeriodReturnPct` ב-`congressPortfolio.ts:968` |
| 6 | **`ImageURL` זמין ל-542/545 ולא בשימוש** | aggregation על ה-cache | מייתר את הניחוש מ-`unitedstates.github.io` (`curatedExploreProfiles.ts:24`) ומצמצם את `dark_pool_person_portraits` + `sync-person-portraits-daily` |
| 7 | **רשומת roster שגויה בצד Quiver** | `A000383` «Alan Armstrong» · Senate · OK · `TradeCount` 703 · `NetWorth` null · holdings ריקים. נקרא עם `include_candidates=false`+`is_active=true` | **אסור להזרים roster אוטומטית ל-UI.** לשאול את Quiver |
| 8 | **`NetWorth=null` ⇒ holdings ריקים** | 0/5 מול 74/84 (88.1%) | pre-filter חינמי, סעיף 6.2 |
| 9 | **תשובה ריקה = שגיאה (שתיהן `200 OK` + `[]`)** | `K000389`/`M001157` | הגנת «אל תדרוס תיק תקין» ב-R2 |
| 10 | האודיט צדק על `congress_stock_holdings` | כל 5 השדות תואמים | ✅ אין תיקון — האודיט מדויק כאן |

---

## 8. מה לא מאומת — רשימה מסודרת

| שאלה | מדוע |
|---|---|
| **מה ה-`as_of` האמיתי של `CurrentHolding`** | אין שדה תאריך בסכימה ולא בתשובה החיה |
| **באיזו תדירות Quiver מחשב מחדש** | הדוקס אומרים רק «live». אין SLA |
| **האם `CurrentHolding` ממותג לשוק (mark-to-market)** | ניתן לקבוע אחרי 3–5 ימי snapshots. כרגע לא |
| **למה `K000389`/`M001157` ריקים** | הקורלציה עם `NetWorth=null` מאומתת; הסיבה לא |
| **האם קיים cap על מספר השורות** | 464 שורות עברו בקריאה אחת → אין cap מתחת לזה. מעל: לא מאומת |
| **Rate limits / quotas** | אין ב-spec ולא בעמוד התמחור |
| **האם תיקים דקים (`W000797` = $7,383) מדויקים או מקוצצים** | אין דרך לאמת מול Quiver |
| **מה בדיוק כלול / לא כלול ב-`CurrentHolding`** | מניות ו-ETFs אומתו. אג״ח / קרנות לא-נסחרות / קריפטו / נדל״ן / אופציות — לא נצפו ולא מוכחשים |
| **מדוע ל-`A000383` יש רשומת roster כסנאטור** | תקלה בצד Quiver |
| **`include_candidates` default** | ה-spec אומר `"True"`; אנחנו שולחים `false` במפורש (`quiverQuant.ts:1041`) — לא קונפליקט, רק לציין |

---

## 9. תחזוקה

- **מקור אמת ל-endpoint:** `curl -sS https://api.quiverquant.com/docs/schema.json` → `paths["/beta/live/congress_stock_holdings"]` + `components.schemas.CongressStockHolding`.
- **שינוי הרשימה** אחרי R6: `dark_pool_curated_roster` בלבד. עד אז — שלושת המקומות שההערה ב-`curatedExploreProfiles.ts:14-17` מונה.
- **בדיקת כיסוי לאדם חדש (בלי לגעת במפתח):**
  1. `net_worth_usd IS NULL` ב-roster? → אין holdings (‎6/6, אפס מקרים נגדיים ב-54). לתייג `holdings_source='trades_only'` **בלי לבזבז קריאה.**
  2. אחרת: `POST /functions/v1/sync-quiver-congress-cache` עם `{"politicians": false, "bioguides": ["<bg>"]}`, ואז לבדוק `by_bioguide.<bg>.length`. **מיזוג, לא דריסה.**
- **לסמן `// observed, not in schema.json`** על שדות מתצפית runtime. במקרה הזה **`CongressStockHolding` מאומת מלא** מול הדוקס — חריג טוב.
