# Quiver API — אודיט תשתיתי מלא מול מה שהאפליקציה צורכת

> **סטטוס:** מסמך חקירה בלבד. לא בוצע שינוי בקוד סנכרון.
> **תאריך:** 2026-09-17
> **תוכנית:** Quiver **Trader** ($75/חודש, או $62.50 שנתי)
> **מקורות אמת:** OpenAPI schema רשמי + עמוד תמחור רשמי + מיגרציות ה-cron בריפו.

קשור: [`DARK_POOL_DATA_SYNC.md`](./DARK_POOL_DATA_SYNC.md) · [`DARK_POOL_REALISTIC.md`](./DARK_POOL_REALISTIC.md) · [`UNUSUAL_WHALES_INTEGRATION.md`](./UNUSUAL_WHALES_INTEGRATION.md)

---

## 0. TL;DR — שמונה המסקנות המרכזיות

1. ה-API מכיל **53 paths**. אנחנו קוראים ל-**13** מהם. מתוך ה-endpoints שהתוכנית שלנו כבר משלמת עליהם (33 `public`), **20 endpoints נוספים** לא נוגעים בהם בכלל.
2. **`ExcessReturn` / `PriceChange` / `SPYChange`** חוזרים **בכל קריאה** שאנחנו כבר עושים ל-`/beta/live/congresstrading` ול-`/beta/historical/congresstrading/{ticker}` — ואנחנו **זורקים אותם** (חוץ מחישוב בזיכרון ב-`uw-explore`). זו תשואה אמיתית מ-Quiver מול שחזור Yahoo/TWR שאנחנו בונים ידנית.
3. **`Tier 1` = Hobbyist · `Tier 2` = Trader** — מיפוי מאומת מול עמוד התמחור. כל ה-`Tier 1` וה-`Tier 2` המתויגים `public` פתוחים לנו.
4. **`enterprise` = Commercial בלבד** (6 endpoints) · **`internal` = לא לקוחות** (11 endpoints, כולל היחיד שמכיל WSB/Twitter/Wiki sentiment).
5. **אין WSB / retail sentiment בתוכנית Trader.** השדות `wsbMentionsWeekly` / `twitter_change` / `wiki_change` קיימים רק ב-`/beta/tickerdata` שמתויג `internal`.
6. **רישוי — נסגר מול Quiver (2026-09-17):** עמוד התמחור מסמן `* No Commercial Use Rights` על Hobbyist ועל Trader, אבל בפנייה ישירה ל-Quiver התקבל אישור לשימוש מלא בכל הנתונים עד מחזור של **$1M לשנה**. **אין חסם רישויי על אף פיצ׳ר בתוכנית הנוכחית.**
7. **חלק מה-endpoints שאנחנו תלויים בהם חסרים response schema** — בראשם `/beta/live/sec13fchanges`, כך ששמות השדות של צינור שינויי ה-13F **לא מאומתים**. ⚠️ **תוקן 2026-09-17:** ל-`/beta/bulk/congresstrading` דווקא **יש** סכימה (`CongressionalTradeV2`), ושדות V2 — כולל `Traded` מול `Filed` — **מאומתים**. ראה 4.3.
8. **שלושה באגים אמיתיים** שהאודיט חשף: פרמטר `date_from` שלא קיים ב-`/beta/live/insiders`, פרמטר `most_recent` שלא קיים ב-`/beta/live/sec13f`, ומיפוי שבור של `Senator` / `Date` בהיסטוריית House+Senate. פירוט בסעיף 8.

---

## 1. מתודולוגיה — איך אומתו הנתונים

`https://api.quiverquant.com/docs/` הוא SPA של Stoplight Elements שנטען דינמית. ה-HTML חושף את מקור האמת:

```js
const json_docs = await fetch("/docs/schema.json").then(res => res.json());
```

לכן כל שמות ה-endpoints, הפרמטרים, שמות השדות והטיפוסים במסמך הזה נלקחו ישירות מ-**`https://api.quiverquant.com/docs/schema.json`** (OpenAPI 3, `info.title = "Quiver API"`, `info.version = "v1"`, `servers = [https://api.quiverquant.com]`).

מיפוי התוכניות נלקח מ-`https://api.quiverquant.com/pricing/` (HTML סטטי, נגיש ללא אימות).

**אימות:** `components.securitySchemes` מכיל אובייקט אחד — `WebPlatformTokenAuth: { type: "http", scheme: "bearer" }`. זה תואם למה שאנחנו עושים ב-`quiverHeaders()` (`Authorization: Bearer <key>`).

**מה שלא נמצא בדוקס (לא מאומת):**
- **Rate limits / quotas** — אין שום אזכור ב-OpenAPI spec ולא בעמוד התמחור. הערכים בקוד (delay של 80–150ms, `maxPages`) הם הגנה שלנו, לא מגבלה מתועדת.
- **מגבלת `page_size` מקסימלית** — `page_size` מתועד כ-`integer` בלי `maximum`. ה-caps בקוד (100/200/500/1000) הם שרירותיים שלנו.
- `/beta/tutorial/` מחזיר 404. אין עמוד דוקומנטציה נוסף מעבר ל-schema.

---

## 2. תוכניות — מה Trader מקבל בפועל

### 2.1 מיפוי tag → תוכנית (מאומת)

ה-spec מתייג כל endpoint בשני צירים: **tier** (`Tier 1` / `Tier 2` / `Tier New Constructs Ratings`) ו-**audience** (`public` / `internal` / `enterprise` / `mobile`).

הצלבה מול עמוד התמחור נותנת התאמה מושלמת:

| Tag ב-spec | תוכנית | ראיה |
|---|---|---|
| `Tier 1` + `public` | **Hobbyist** ($30) ומעלה | **22 endpoints** — מכסים בדיוק את רשימת ה-datasets של Hobbyist בעמוד התמחור: Congress Trading, Congress Stock Holdings, Politician Net Worth, Corporate Donors, Government Contracts, Corporate Lobbying, Off-Exchange Trading, Donald Trump Stock Trades, Polymarket Trades (כל dataset = כמה וריאנטים live/bulk/historical) |
| `Tier 2` + `public` | **Trader** ($75) ומעלה | **11 endpoints** — בדיוק תוספות Trader: Insider Trading, Hedge Fund Activity, Top Shareholders, Corporate Patents, Executive Compensation, App Ratings, Quiver Newsfeed |
| `enterprise` | **Commercial** בלבד | **6 endpoints** שאין להם מקבילה באף רשימת datasets של Hobbyist/Trader |
| `internal` | **לא ללקוחות** | **11 endpoints** (`/beta/tickerdata`, `/beta/coins`, `/beta/live/cnbc`, `/beta/live/flights`…) |
| `Tier New Constructs Ratings` | **מנוי נפרד** | עמוד התמחור מציג את New Constructs כבלוק תמחור עצמאי מתחת ל-Hobbyist/Trader/Commercial |

> **`mobile`** מופיע ב-`tags` הגלובלי של ה-spec אבל **לא מוצמד לאף endpoint** ב-53 ה-paths. מטא-תג שאינו בשימוש.

### 2.2 מה שהכי חשוב מהתמחור

```
Hobbyist  $30/mo  · 10 of 18 Quiver MCP Tools · * No Commercial Use Rights
Trader    $75/mo  · All 18 Quiver MCP Tools   · * No Commercial Use Rights
Commercial  contact  · Commercial Use Rights
```

**הכוכבית הזו לא חלה עלינו.** בפנייה ישירה ל-Quiver (2026-09-17) התקבל אישור לשימוש מלא בכל ה-datasets של התוכנית, ללא הגבלת פיצ׳רים, **עד מחזור של $1M לשנה**. מעבר לסף הזה יש לחזור אליהם. כלומר: הסעיף הזה **אינו חוסם** שום שדרוג במסמך, ויש לתעדף לפי ערך מוצרי בלבד.

---

## 3. קטלוג מלא — 53 endpoints

כל ה-endpoints הם `GET` פרט ל-`/beta/token/login/` ו-`/beta/token/logout/` שהם `POST`. אין endpoint אחד עם יותר מ-method אחד — 53 paths = 53 operations.

**התפלגות:** `Tier 1`+`public` = 22 · `Tier 2`+`public` = 11 · `enterprise` = 6 · `internal` = 11 · New Constructs = 1 · token = 2.

עמודת **«אצלנו»**: ✅ בשימוש (13) · ⬜ זמין ולא בשימוש (20) · 🔒 לא זמין ב-Trader (18)

### 3.1 `Tier 1` + `public` — זמין לנו (Hobbyist ומעלה)

| # | Path | וריאנט | Query params | אצלנו |
|---|---|---|---|---|
| 1 | `/beta/live/congresstrading` | live | `normalized`, `representative` | ✅ |
| 2 | `/beta/bulk/congresstrading` | bulk | `bioguide_id`, `date`, `nonstock`, `normalized`, `page`, `page_size`, `representative`, `ticker`, `version` (V1/V2, default V1) | ✅ |
| 3 | `/beta/historical/congresstrading/{ticker}` | historical | — (רק `ticker` ב-path) | ✅ |
| 4 | `/beta/live/housetrading` | live | `name`, `options` | ⬜ |
| 5 | `/beta/historical/housetrading/{ticker}` | historical | — | ✅ |
| 6 | `/beta/live/senatetrading` | live | `name`, `options` | ⬜ |
| 7 | `/beta/historical/senatetrading/{ticker}` | historical | — | ✅ |
| 8 | `/beta/bulk/congress/politicians` | bulk | `chamber`, `include_candidates`, `is_active`, `page`, `page_size`, `party`, `sort_by`, `state`, `volume_method` | ✅ |
| 9 | `/beta/live/congress/politicians` | live | `chamber`, `is_active`, `party`, `state`, `volume_method` | ⬜ |
| 10 | `/beta/live/congress_stock_holdings` | live | `bioguide_id`, `sort_by_holding`, `ticker` | ✅ |
| 11 | `/beta/bulk/trumpstocktrades` | bulk | `page`, `page_size` | ✅ |
| 12 | `/beta/live/offexchange` | live | `page`, `page_size` | ✅ |
| 13 | `/beta/historical/offexchange/{ticker}` | historical | `date` | ✅ |
| 14 | `/beta/bulk/corporatedonors` | bulk | `bioguide_id`, `cycle`, `page`, `page_size`, `ticker`, `transaction_tp` | ⬜ |
| 15 | `/beta/historical/corporatedonors/{ticker}` | historical | `bioguide_id`, `cycle`, `page`, `page_size` | ⬜ |
| 16 | `/beta/live/govcontracts` | live | — | ⬜ |
| 17 | `/beta/historical/govcontracts/{ticker}` | historical | — | ⬜ |
| 18 | `/beta/live/govcontractsall` | live | `date`, `page`, `page_size` | ⬜ |
| 19 | `/beta/historical/govcontractsall/{ticker}` | historical | — | ⬜ |
| 20 | `/beta/live/lobbying` | live | `all`, `date_from`, `date_to`, `page`, `page_size` | ⬜ |
| 21 | `/beta/historical/lobbying/{ticker}` | historical | `page`, `page_size`, `query`, `queryTicker` | ⬜ |
| 22 | `/beta/live/polymarkettrades` | live | `date`, `include_sports_markets`, `page`, `page_size`, `proxy_wallet`, `slug`, `sort_by`, `sort_order` | ⬜ |

### 3.2 `Tier 2` + `public` — זמין לנו (Trader)

| # | Path | וריאנט | Query params | אצלנו |
|---|---|---|---|---|
| 23 | `/beta/live/insiders` | live | `date`, `limit_codes`, `page`, `page_size`, `ticker`, `uploaded` | ✅ |
| 24 | `/beta/live/sec13f` | live | `date`, `owner`, `page`, `page_size`, `period`, `ticker`, `today` | ✅ |
| 25 | `/beta/live/sec13fchanges` | live | `date`, `mobile`, `most_recent`, `owner`, `page`, `page_size`, `period`, `show_new_funds`, `ticker`, `today` | ✅ |
| 26 | `/beta/live/topshareholders/{ticker}` | live | — | ⬜ |
| 27 | `/beta/live/quivernews` | live | `page`, `page_size`, `ticker` | ⬜ |
| 28 | `/beta/live/appratings` | live | — | ⬜ |
| 29 | `/beta/live/allpatents` | live | `date_from`, `date_to` (טווח מקס׳ 30 יום) | ⬜ |
| 30 | `/beta/historical/allpatents/{ticker}` | historical | `date_from`, `date_to`, `page`, `page_size` | ⬜ |
| 31 | `/beta/live/patentdrift` | live | `date_from`, `date_to`, `latest`, `ticker` | ⬜ |
| 32 | `/beta/live/patentmomentum` | live | `date_from`, `date_to`, `latest`, `ticker` | ⬜ |
| 33 | `/beta/historical/executivecompensation/{ticker}` | historical | `page`, `page_size` | ⬜ |

### 3.3 `enterprise` — Commercial בלבד 🔒

| # | Path | תיאור מהדוקס |
|---|---|---|
| 34 | `/beta/live/legislation` | «Return recent legislation data.» — כולל `lobbyists`, `lobbyingAmounts`, `politicianTrades`, `politicianStocks` |
| 35 | `/beta/live/bill_summaries` | «Return recent bill summaries.» — `title`, `congress`, `summary`, `lastAction` |
| 36 | `/beta/live/congressholdings` | «Returns live congress holdings data.» — `Politician`, `Holdings`, `Type` |
| 37 | `/beta/live/rss` | «Get live RSS data» — `Dataset`, `Ticker`, `Text`, `URL`, `Time` |
| 38 | `/beta/strategies/holdings` | «Get strategies holdings data» — `strategy` param |
| 39 | `/beta/strategies/holdings_infrequent` | אסטרטגיות עם rebalance נדיר |

> **הבהרה:** תיוג `enterprise` ב-spec + היעדרות מרשימות ה-datasets של Hobbyist/Trader בעמוד התמחור. עמוד התמחור **לא מונה אותם שמית** תחת Commercial, אלא אומר «All Hobbyist & Trader Plan Datasets + Commercial Use Rights». כלומר: **האם Commercial פותח את ה-6 האלה — לא מאומת.** מה שכן מאומת: הם לא בתוך Trader.

### 3.4 `internal` — לא ללקוחות 🔒

| # | Path | שדות בולטים |
|---|---|---|
| 40 | `/beta/tickerdata` | **`wsbMentionsWeekly`, `wiki_change`, `twitter_change`, `congressBought`, `congressSold`** |
| 41 | `/beta/live/cnbc` | `Ticker`, `Notes`, `Direction`, `Traders` (+`analyst`, `bulk`, `date`, `ticker` params) |
| 42 | `/beta/personalities` | `Name` (CNBC personalities) |
| 43 | `/beta/live/flights` | `Ticker`, `Date`, `DepartureCity`, `ArrivalCity` |
| 44 | `/beta/today/eventsbeta` | `FirstEventBeta`, `FirstEventOdds`, `SecondEventBeta` |
| 45 | `/beta/historical/eventsbeta/{ticker}` | כנ״ל + `Date` |
| 46 | `/beta/companies` | `Name`, `Ticker` |
| 47 | `/beta/funds` | `Fund` |
| 48 | `/beta/coins` | `Coin` |
| 49 | `/beta/ignoredtickers` | `Ticker` |
| 50 | `/beta/auth/premium` | `data.status`, `data.current_period_end` |

### 3.5 New Constructs — מנוי נפרד 🔒

| # | Path | הערה |
|---|---|---|
| 51 | `/beta/live/earningsdistortionscores/{ticker}` | 30+ שדות: `rating_overall`, `rating_roic`, `rating_fcf_yield`, `rating_price_to_ebv_ratio`, `rating_gap`, `figi`, `lei`, `cik_current`… מתויג `Tier New Constructs Ratings` + `public` |

### 3.6 Auth

| # | Path | Method |
|---|---|---|
| 52 | `/beta/token/login/` | `POST` — `username`, `password` |
| 53 | `/beta/token/logout/` | `POST` — 204 |

---

## 4. פירוט שדות + example shapes

כל שמות השדות למטה **מצוטטים מדויק** מ-`schema.json`, כולל התיאורים.

### 4.1 Congress trading — `live/congresstrading`, `historical/congresstrading/{ticker}`

שני ה-endpoints חולקים סכימה **זהה**:

| שדה | טיפוס | תיאור מהדוקס | נשמר אצלנו? |
|---|---|---|---|
| `Representative` | `string` **REQ** | Name of Congressperson who made the transaction | ✅ `politician_name` |
| `BioGuideID` | `string` | BioGuide ID of the congressperson who made the transaction | ✅ `politician_id` |
| `ReportDate` | `string/date-time` | Date the transaction was reported | ✅ `filed_at` |
| `TransactionDate` | `string/date-time` | Date the transaction took place | ✅ `transaction_date` |
| `Ticker` | `string` | Ticker of shares transacted | ✅ `ticker` |
| `Transaction` | `string` | Purchase or Sale | ⚠️ נורמל ל-`buy`/`sell` — הטקסט המקורי נזרק |
| `Range` | `string` | *(אין תיאור בדוקס)* | ✅ `amount_label` |
| `District` | `string` | District of the congressperson | ❌ **נזרק** |
| `House` | `string` | Representatives or Senate | ❌ **נזרק** |
| `Amount` | `string` | **Lower bound of transaction size ($).** Congressional trades are reported as a range of values, this variable is the lower bound of that range | ❌ נזרק (מועדף `Range`) |
| `Party` | `string` **REQ** | Political party of the congressperson who made the trade | ❌ **נזרק** |
| `last_modified` | `string/date-time` | Date that Quiver last updated the details of this transaction | ⚠️ fallback ל-`filed_at` בלבד |
| `TickerType` | `string` | Reported type of asset traded. Note: CS and ST are commonly used as abbreviated for common stock | ⚠️ לסינון בלבד (`isQuiverEquityTrade`), לא נשמר |
| `Description` | `string` | Transaction description | ✅ `company_name` |
| `ExcessReturn` | `number` | **Estimated return of stock compared to return of S&P 500 since the transaction date** | ❌ **נזרק** |
| `PriceChange` | `number` | **Percentage change in stock price since the transaction date** | ❌ **נזרק** |
| `SPYChange` | `number` | **Percentage change in S&P 500 since the transaction date** | ❌ **נזרק** |

**Example shape** (מורכב משמות השדות והטיפוסים בדוקס):

```json
[
  {
    "Representative": "Nancy Pelosi",
    "BioGuideID": "P000197",
    "ReportDate": "2026-08-14T00:00:00Z",
    "TransactionDate": "2026-07-28T00:00:00Z",
    "Ticker": "NVDA",
    "Transaction": "Purchase",
    "Range": "$1,000,001 - $5,000,000",
    "District": "CA11",
    "House": "Representatives",
    "Amount": "1000001",
    "Party": "Democratic",
    "last_modified": "2026-08-15T03:12:00Z",
    "TickerType": "ST",
    "Description": "NVIDIA Corporation",
    "ExcessReturn": 18.42,
    "PriceChange": 24.11,
    "SPYChange": 5.69
  }
]
```

**שימושיות לצרכן קצה:** `ExcessReturn` הוא בדיוק המטריקה ש«פיד עסקאות פוליטיקאים» מוכר עליה — «כמה הרוויח מאז». `PriceChange` + `SPYChange` נותנים את הפירוק (מניה מול benchmark) בלי שום חישוב מצידנו.

### 4.2 House / Senate historical — סכימה **שונה**

`/beta/historical/housetrading/{ticker}` ו-`/beta/historical/senatetrading/{ticker}` **לא** זהים ל-`congresstrading`:

| שינוי | `congresstrading` | `housetrading` | `senatetrading` |
|---|---|---|---|
| שם האדם | `Representative` | `Representative` | **`Senator`** |
| תאריך עסקה | `TransactionDate` | **`Date`** | **`Date`** |

שאר השדות זהים (`BioGuideID`, `ReportDate`, `Ticker`, `Transaction`, `Range`, `District`, `House`, `Amount`, `Party`, `last_modified`, `TickerType`, `Description`, `ExcessReturn`, `PriceChange`, `SPYChange`).

⚠️ זה מקור באג אמיתי אצלנו — סעיף 8.3.

### 4.3 `bulk/congresstrading` — ✅ **יש response schema** (תוקן 2026-09-17)

> **תיקון לגרסה הראשונה של האודיט.** נכתב כאן במקור «אין response schema» ושכל שדות V2 «לא מאומתים». **זה שגוי.** בדיקה חוזרת מול `schema.json` מצאה `AllCongressViewResponse` = `anyOf: [CongressionalTradeV2, CongressionalTrade]`, כאשר `CongressionalTradeV2` מתועד במלואו.

שדות `CongressionalTradeV2` **מאומתים מהסכימה**:

| שדה | תיאור בדוקס |
|---|---|
| `Name` | שם הפוליטיקאי |
| `Traded` | **«Transaction date»** — תאריך ביצוע העסקה |
| `Filed` | **«Disclosure date»** — תאריך הדיווח |
| `Trade_Size_USD` | גודל העסקה |
| `Chamber` | House / Senate |
| `Company` | שם החברה |

**המשמעות המעשית:** ההבחנה בין `Traded` ל-`Filed` — שעליה נשען גם תיקון הבאג בסעיף 8.3 וגם פיצ׳ר «נחשף לפני X · בוצע לפני Y» — **מאומתת ולא תצפית runtime.**

**שדות V2 נוספים בסכימה שאינם בטיפוס `QuiverCongressTrade` שלנו:** `Status`, `Subholding`, `Comments`, `Quiver_Upload_Time`, `excess_return`, `State`. שים לב ש-`excess_return` ו-`State` זמינים כאן ישירות — רלוונטי ל-H1 ול-H3.

- `version=V1` — עדיין נשען על `CongressionalTrade`; ההנחה שהתשובה זהה ל-`historical/congresstrading` סבירה אך **לא מאומתת** במפורש.

### 4.4 `bulk/congress/politicians` + `live/congress/politicians`

סכימה זהה בשניהם:

| שדה | טיפוס | נשמר אצלנו? |
|---|---|---|
| `BioGuideID` | `string` | ✅ cache |
| `CandidateID` | `string` | ⚠️ ב-type, לא בשימוש |
| `Name` | `string` | ✅ cache |
| `Party` | `string` | ✅ cache |
| `Chamber` | `string` | ✅ cache |
| `State` | `string` | ❌ **נזרק** |
| `ImageURL` | `string` | ❌ **נזרק** (אנחנו בונים URL ידנית מ-`unitedstates.github.io`) |
| `TradeCount` | `integer` | ✅ דירוג + cache |
| `TradeVolume` | `number` | ❌ **נזרק** |
| `NetWorth` | `number` | ✅ `uw-explore` בלבד |

**הבדל בין השניים (מצוטט):**
- `bulk`: «Returns a paginated list of all congress members **and FEC-registered candidates** with trading stats and net worth.»
- `live`: «Returns currently active congress members with their trading stats (trade count, estimated trade volume) and **live net worth**.»

**`volume_method`** (קיים בשניהם): «Method to estimate trade volume from disclosed amount ranges (e.g. '$1,001 - $15,000'). Accepted values: `range_start` (lower bound), `average` (midpoint, default), `range_end` (upper bound).»

> **זה הפרמטר הקריטי לסעיף 7.3** — Quiver עושה בעצמו את בדיוק אותה הערכת mid-range שאנחנו מממשים ידנית ב-`STOCK_ACT_FLOOR_MID`.

```json
[
  {
    "BioGuideID": "P000197",
    "CandidateID": "H8CA05035",
    "Name": "Nancy Pelosi",
    "Party": "Democratic",
    "Chamber": "House",
    "State": "California",
    "ImageURL": "https://…",
    "TradeCount": 312,
    "TradeVolume": 128500000,
    "NetWorth": 240000000
  }
]
```

### 4.5 `live/congress_stock_holdings`

«Returns estimate of current stock holdings of members of U.S. Congress.»

| שדה | טיפוס | תיאור מהדוקס | נשמר? |
|---|---|---|---|
| `BioGuideID` | `string` **REQ** | BioGuide ID of the congressperson holding the stock | ✅ |
| `Name` | `string` | Name of the congressperson who made the transaction | ✅ |
| `Ticker` | `string` | Ticker symbol of the stock held by the congressperson | ✅ |
| `CurrentHolding` | `number` | Estimated current holding of the stock by the congressperson (USD) | ✅ `mid_usd_k` |
| `Allocation` | `number` | Estimtated allocation of the stock in the congressperson's portfolio (percentage) *(שגיאת כתיב במקור)* | ✅ `allocation_pct` |

`sort_by_holding`: «Sort portfolio holdings by current holding amount (descending). Accepted values: `true` (sort by current holding), `false` (sort by allocation).» — **ברירת המחדל בדוקס היא `false`**; אנחנו שולחים `true` במפורש.

### 4.6 `bulk/trumpstocktrades`

«Returns recent stock transactions made by Donald Trump. **Default page size is 200.**»

| שדה | טיפוס | תיאור מהדוקס | נשמר? |
|---|---|---|---|
| `Ticker` | `string` | Ticker symbol of the stock involved in the transaction | ✅ |
| `Company` | `string` | Name of the company for the stock involved in the transaction | ✅ `company_name` |
| `Transaction` | `string` | Type of transaction (e.g., Purchase, Sale) | ⚠️ נורמל |
| `Amount` | `string` | Value of the stock transaction (USD) | ✅ `amount_label` |
| `Filed` | `string/date-time` | Date when the stock transaction was filed | ✅ `filed_at` |
| `Traded` | `string` | Date when the stock was actually traded | ✅ `transaction_date` |
| `ExcessReturn` | `number` | Estimated return of stock compared to return of S&P 500 since the transaction date | ❌ **נזרק** |

> הערה: הטיפוס של `ExcessReturn` בדוקס הוא `number`. ה-type בריפו הוא `string | number | null` עם הערה «Quiver docs: string כמו "224.73%"». **הדוקס לא מראים פורמט string** — כנראה תצפית runtime. סבלנות לשני הפורמטים היא בכל מקרה נכונה.

### 4.7 `live/offexchange` + `historical/offexchange/{ticker}`

סכימה זהה:

| שדה | טיפוס | תיאור מהדוקס | נשמר? |
|---|---|---|---|
| `Ticker` | `string` **REQ** | Company ticker | ✅ |
| `Date` | `string/date-time` **REQ** | Date | ✅ |
| `OTC_Short` | `integer` **REQ** | **Number of shares short on the given day** | ⚠️ ממופה ל-`dark_pool_trades` |
| `OTC_Total` | `integer` **REQ** | Total number of shares on the given day | ⚠️ ממופה ל-`size` |
| `DPI` | `number` **REQ** | **% of shares short** | ⚠️ |

`live`: «Returns **yesterday's** off-exchange activity across all companies.» — כלומר T-1 יומי, לא prints.

⚠️ **הדוקס מגדירים `DPI` כ-«% of shares short»** — לא כ-Dark Pool Index / «עוצמת דארק-פול». התיאור של `OTC_Short` הוא «shares short», לא «shares traded off-exchange». זה משפיע על איך נכון להציג את זה ב-UI. סעיף 8.5.

### 4.8 `live/insiders`

«Returns recent insider transactions.»

| שדה | טיפוס | תיאור מהדוקס | נשמר? |
|---|---|---|---|
| `Ticker` | `string` | Company ticker | ✅ |
| `Date` | `string/date-time` **REQ** | Transaction date | ✅ `transaction_date` |
| `Name` | `string` **REQ** | Name of transactor | ✅ `insider_name` |
| `AcquiredDisposedCode` | `string` **REQ** | Indicates whether transaction was share acquisition or disposal | ⚠️ סינון בלבד |
| `TransactionCode` | `string` **REQ** | Indicates type of transaction (see more: sec.gov/files/forms-3-4-5.pdf) | ⚠️ סינון ל-`P` בלבד |
| `Shares` | `number` | Number of shares transacted | ✅ |
| `PricePerShare` | `number` | Reported price per share transacted | ✅ `price` |
| `SharesOwnedFollowing` | `number` | Number of shares owned by insider following transaction | ✅ `shares_owned_after` |
| `fileDate` | `string/date-time` **REQ** | Time that the transaction was filed (and became publicly available) | ✅ `filed_at` |
| `officerTitle` | `string` | Corporate title of the transactor | ✅ `insider_role` |
| `isDirector` | `boolean` | Whether the transactor is a director of the company | ❌ **נזרק** |
| `isOfficer` | `boolean` | Whether the transactor is an officer of the company | ❌ **נזרק** |
| `isTenPercentOwner` | `boolean` | Whether the transactor is a 10% owner of the company | ❌ **נזרק** (גם לא ב-type) |
| `isOther` | `boolean` | The transactor is not a director, officer, or 10% owner | ❌ **נזרק** (גם לא ב-type) |
| `directOrIndirectOwnership` | `string` | Ownership type ('D' or 'I') | ❌ **נזרק** |
| `uploaded` | `string/date-time` | Time that the transaction was uploaded by Quiver | ❌ **נזרק** |

**`limit_codes`**: «Limit codes for form4 search» — boolean. סינון TransactionCode בצד השרת. אנחנו מסננים ל-`P` בצד הלקוח.

### 4.9 `live/sec13f`

«Returns static portfolio holdings at specific filing periods.»

| שדה | טיפוס | תיאור מהדוקס | נשמר? |
|---|---|---|---|
| `Date` | `string/date-time` **REQ** | **Filing date (expressed in ms since Epoch CST)** | ✅ `filing_date` |
| `ReportPeriod` | `string/date-time` | **Reporting period end date (expressed in ms since Epoch CST)** | ❌ **נזרק** |
| `Name` | `string` **REQ** | *(אין תיאור)* | ⚠️ |
| `Ticker` | `string` | Company ticker | ✅ |
| `CUSIP` | `string` | Company CUSIP | ✅ `cusip` |
| `Fund` | `string` **REQ** | Name of the institution | ✅ `manager_name` |
| `Class` | `string` | Text description of the holdings | ❌ **נזרק** |
| `Value` | `integer` **REQ** | Value (USD) of fund's position | ✅ `value_usd` |
| `Shares` | `integer` **REQ** | Number of shares held by fund | ✅ `shares` |
| `SH/PRN` | `string` **REQ** | Indicates whether holdings are principal amount on debt securities | ❌ **נזרק** |
| `Put/Call` | `string` **REQ** | Indicates whether holdings are puts or calls | ❌ **נזרק** |
| `Direction` | `string` | Investment discretion held by manager | ❌ **נזרק** |

⚠️ **שמות שדות מדויקים:** הדוקס אומרים **`SH/PRN`** ו-**`Put/Call`** (עם סלאש). ה-type בריפו מגדיר `PutCall` ו-`Class` — `PutCall` **לא** תואם את שם השדה בדוקס.

⚠️ **תזמון:** «expressed in ms since Epoch CST» — הדוקס מצהירים שזה **מילישניות מאז Epoch**, לא ISO. `normalizeQuiverIsoDate()` מטפל ב-ISO וב-`MM/DD/YYYY` ובסוף נופל ל-`Date.parse()` — שיכשל על מספר גולמי במילישניות.

⚠️ **שדות שאין להם קיום בדוקס** אבל מוגדרים ב-`QuiverSec13fHolding`: `Company`, `Weight`, `Owner`, `Held`, `Held_Normalized`, `Close`, `FilingDate`. **לא מאומת.**

### 4.10 `live/sec13fchanges` — **אין response schema**

```
RESP 200: content: application/json  →  schema: {} (ריק)
```

10 פרמטרים מתועדים (`date`, `mobile`, `most_recent`, `owner`, `page`, `page_size`, `period`, `show_new_funds`, `ticker`, `today`) אבל **אף שדה תשובה.**

כל שמות השדות שכל צינור ה-13F changes שלנו בנוי עליהם — `Change`, `Change_Share`, `Change_Pct`, `Held`, `Held_Normalized`, `Close` — **לא מאומתים.** ההערה בקוד (`quiverQuant.ts`) אומרת «Live SEC 13F changes — docs fields: …» אבל **הדוקס לא מכילים את הרשימה הזו.** סעיף 8.6.

**שני פרמטרים שאנחנו לא מנצלים:**
- `show_new_funds`: «Include funds filing for the first time in results»
- `mobile`: «Mobile response» — ייתכן payload רזה יותר. תוכן לא מתועד → **לא מאומת**.

### 4.11 `live/topshareholders/{ticker}` — Trader, לא בשימוש

«Returns the top shareholders for a specific ticker, including both direct and derivative holdings.»

```json
{
  "ownership": [
    { "owner_name": "string", "owner_title": "string", "shares": 0 }
  ],
  "ownership_options": [
    { "owner_name": "string", "owner_title": "string", "option_type": "string", "underlying_shares": 0 }
  ]
}
```

**שימושיות:** «מי מחזיק את המניה הזו» — מוסדיים + בכירים, כולל אופציות. Endpoint אחד, response קטן, `ticker` בודד. זה תוכן שאין לנו כלל היום במסכי טיקר.

### 4.12 שאר ה-Tier 1/2 הלא-מנוצלים (שדות מלאים)

**`live/lobbying` · `historical/lobbying/{ticker}`** — סכימה זהה:
`Date` (REQ, «Date that the lobbying spend was reported») · `Amount` («Size of spending instance (USD)») · `Client` («Full name of the lobbying client») · `Issue` («Category of legislation that is being lobbied for») · `Specific_Issue` («Specific piece of legislation being lobbied for») · `Registrant` (REQ, «Full name of the disclosure registrant») · `Ticker` (REQ)

**`live/govcontracts` · `historical/govcontracts/{ticker}`** — אגרגט רבעוני:
`Ticker` (REQ) · `Amount` (REQ, string, «Total dollars obligated under the given contract») · `Qtr` (REQ, integer, «Calendar quarter») · `Year` (REQ, integer)

**`live/govcontractsall` · `historical/govcontractsall/{ticker}`** — חוזה בודד:
`Ticker` (REQ) · `Date` (REQ, «Announcement date») · `Description` («Contract description») · `Agency` («Awarding Agency Name») · `Amount` (**number**, «Total dollars obligated») · `action_date` (REQ, «Contract action date»)

**`bulk/corporatedonors` · `historical/corporatedonors/{ticker}`** — סכימה זהה:
`BioGuideID` · `CandidateName` · `CompanyCMTENM` · `TransactionDate` · `TransactionAmount` (integer) · `Ticker` · `CommitteeName` · `Cycle` (integer) · `TransactionType` · `CompanyCMTEID` · `Uploaded`

`transaction_tp`: «Filter by FEC transaction type code (e.g. `24K` = contribution to candidate, `24E` = independent expenditure).»

**`live/polymarkettrades`** — 20 שדות, כולל פרופיל הסוחר:
`proxy_wallet` · `side` («BUY or SELL») · `asset` · `condition_id` · `size` · `price` · `title` («Market title») · `slug` · `event_slug` · `outcome` · `outcome_index` · `name` («Trader's display name») · `transaction_hash` · `estimated_amount` («Estimated USD value of the trade») · `trade_time` · `uploaded` · `user_first_activity` · `user_position_rank` («Trader's rank by current position value») · `user_position_current_val` · `user_positions_value` · `user_markets_traded` · `sports_market_type` · `slug_volume`

«Returns Polymarket trades flagged as large or unusual bets. Sports-market trades are excluded by default.» — **זהו ה-endpoint היחיד ב-Trader שמתנהג באמת כמו «whale feed»** (עסקה בודדת, timestamp מדויק, גודל $, דירוג הסוחר).

**`live/quivernews`** — «Paginated with a default of 30 results per page. Can be filtered by ticker.»
`url` · `datetime` (REQ) · `headline` · `summary` · `category` · `image`

**`historical/executivecompensation/{ticker}`** — «default of 200 results per page»:
`CIK` · `Name` · `Role` · `Year` (integer) · `Salary` · `Bonus` · `StockAndOptionAwards` · `TotalCompensation` · `filerName` · `fileDate` · `uploaded`

**`live/allpatents` · `historical/allpatents/{ticker}`**:
`Date` (REQ, «Publication date») · `IPC` («The patent's IPC (International Patent Classification) code») · `Title` · `Claims` (number, «The number of claims listed in the given patent») · `Abstract` («The full-text of the patent's abstract») · `Ticker` (REQ) · `PatentNumber` (REQ)

**`live/patentdrift`** — `ticker` · `date` · `drift` («Proprietary metric quantifying the extent of a company's recent technological changes») *(שמות שדות ב-lowercase!)*
**`live/patentmomentum`** — `ticker` · `date` · `momentum` («Proprietary metric quantifying recent performance of a company's tech peers»)

**`live/appratings`** — «Returns the last week of app ratings data»:
`Ticker` (REQ, «Company ticker of app's publisher») · `App` (REQ) · `Created` (REQ) · `Publisher` (REQ) · `Rating` (REQ, «Average rating (on a 0-5 scale)») · `Count` (REQ, «Total number of reviews») · `Time` (REQ, «Time that this row of ratings data was scraped»)

---

## 5. מה אנחנו קוראים היום — 13 endpoints

### 5.1 טבלת קריאות

| Endpoint | פרמטרים שאנחנו שולחים | Edge Function | תדירות (cron job) |
|---|---|---|---|
| `/beta/live/congresstrading` | *(אין)* | `sync-congress-trades` → `buildFromQuiver` | `sync-congress-trades-20m` · `*/20 * * * *` |
| `/beta/bulk/congresstrading` | `bioguide_id`, `page`, `page_size=100`, `version=V1` · עד 20 עמודים לכל BioGuide × 17 curated | `sync-congress-trades` (`deep:true`) | אותו job |
| `/beta/bulk/trumpstocktrades` | `page`, `page_size=200` · עד 12 עמודים | `sync-congress-trades` → `buildCuratedExecutiveTradeRows` | אותו job |
| `/beta/historical/congresstrading/{ticker}` | — · עד 12 טיקרים | `sync-congress-trades` | אותו job, **רק** עם `enrich_tickers:true` (ברירת מחדל **כבוי**) |
| `/beta/historical/housetrading/{ticker}` | — | `fetchQuiverChamberHistoryForTickers` | **רק** עם `include_chambers:true` (כבוי) |
| `/beta/historical/senatetrading/{ticker}` | — | כנ״ל | כנ״ל |
| `/beta/bulk/congress/politicians` | `page`, `page_size=100`, `sort_by=trade_count`, `include_candidates=false`, `is_active=true` · עד 20 עמודים | `sync-quiver-congress-cache` | `sync-quiver-congress-cache-daily` · `15 6 * * *` |
| `/beta/live/congress_stock_holdings` | `bioguide_id`, `sort_by_holding=true` · לוּפ על 17 curated | `sync-quiver-congress-cache` | אותו job |
| `/beta/live/insiders` | **`date_from`** ⚠️, `page_size=500` (env `QUIVER_INSIDER_PAGE_SIZE`) | `sync-insider-buys` → `fetchFromQuiver` | `sync-insider-buys-market-hours` · `0 13,17,21 * * 1-5` + `sync-insider-buys-weekend` · `0 16 * * 0,6` |
| `/beta/live/sec13f` | `owner`, **`most_recent=true`** ⚠️, `page`, `page_size=500` | `sync-fund-13f` → `fetchQuiverSec13fByOwner` | `sync-fund-13f-daily` · `0 6 * * *` |
| `/beta/live/sec13fchanges` | `owner`, `most_recent=true`, `page`, `page_size=200` · 3 owners מאוצרים | `sync-fund-13f` → `fetchQuiverCuratedFundChanges` | אותו job |
| `/beta/live/offexchange` | *(אין — ללא pagination)* ⚠️ | `sync-darkpool` → `fetchFromQuiverOffexchange` | `sync-darkpool-5m` · `*/5 * * * *` (רק אם `DARK_POOL_PROVIDER` מוגדר) |
| `/beta/historical/offexchange/{ticker}` | — · עד 8 טיקרים, 60 שורות אחרונות לכל אחד | כנ״ל | כנ״ל |

> **הערה על ה-cron של בכירים:** `034_sync_insider_buys_cron.sql` הגדיר במקור `sync-insider-buys-hourly` (`0 * * * *`), אבל `20260823230000_darkpool_portfolio_snapshots_and_form4_cron.sql:73-74` מבטל אותו במפורש (`cron.unschedule`) לפני שהוא מתזמן את שני ה-jobs הנוכחיים. כלומר `DARK_POOL_DATA_SYNC.md` («3× ביום מסחר + סופ״ש») **מדויק** — אין סתירה. סה״כ 17 קריאות/שבוע ל-`/beta/live/insiders`.

### 5.2 מה שאנחנו מחזיקים ב-`dark_pool_uw_snapshots` (cache JSON)

| `cache_key` | payload | TTL |
|---|---|---|
| `quiver_congress_politicians` | כל אובייקט ה-`QuiverPolitician` **כמו שהוא** + `top_by_trade_count` + `curated_bioguides` | `QUIVER_POLITICIANS_FRESH_MS` = 24h |
| `quiver_congress_holdings` | `by_bioguide: Record<BioGuideID, QuiverCongressStockHolding[]>` | 24h |
| `quiver_sec13f_changes` | `QuiverSec13fChange[]` + `by_owner` | — |
| `congress_trades_meta` | מטא-סנכרון (count, provider, deep) | — |

> נקודה חשובה: ה-caches האלה שומרים את ה-JSON הגולמי של Quiver, כולל שדות שלא בשימוש. **`TradeVolume`, `State`, `ImageURL` כבר יושבים אצלנו ב-DB** — הם פשוט לא נקראים. זה הופך חלק מהשדרוגים למאמץ *client-side בלבד*, בלי שינוי סנכרון.

---

## 6. מה נשמר ב-DB מול מה שנזרק

### 6.1 `dark_pool_congress_trades` (מיגרציה `042_uw_db_cache.sql`)

עמודות: `external_id`, `politician_id`, `politician_name`, `politician_image_url`, `ticker`, `company_name`, `transaction_type`, `shares`, `price`, `amount_label`, `filed_at`, `transaction_date`, `txn_label`, `source`, `synced_at`

**אין אף עמודה** ל-: `ExcessReturn`, `PriceChange`, `SPYChange`, `Party`, `House`/`Chamber`, `District`, `TickerType`, `Range` הגולמי מול `Amount` (הרצפה), `last_modified`.

`shares` ו-`price` **תמיד `null`** בנתיב Quiver — בכוונה ומוצדק («לא לזייף shares/price כאילו מדווחים»).

### 6.2 `dark_pool_insider_buys`

עמודות רלוונטיות: `external_id`, `ticker`, `company_name`, `insider_cik`, `insider_name`, `insider_role`, `transaction_type`, `shares`, `price`, `value`, `filed_at`, `transaction_date`, `source`, `sector`, `is_sp500`, `marketcap`, `next_earnings_date`, `is_10b5_plan`, `shares_owned_after`, `return_1d`…`return_6m`, `insider_logo_url`

בנתיב Quiver (`mapQuiverInsider`): `company_name=null`, `insider_cik=null`, `sector=null`, `is_sp500=null`, `marketcap=null`, `next_earnings_date=null`, `is_10b5_plan=null`, `return_*=null`.

⚠️ **הפיד מסונן ל-`P` (purchase) בלבד.** מכירות בכירים (`S`), מימוש אופציות (`M`), award (`A`) — כולם מושמטים. Quiver מחזיר את כולם.

⚠️ `isDirector` / `isOfficer` / `isTenPercentOwner` / `isOther` / `directOrIndirectOwnership` — **אין להם עמודה**, למרות ש-`insider_role` (מ-`officerTitle`) לרוב `null` ל-directors.

### 6.3 `dark_pool_fund_holdings` / `dark_pool_fund_managers`

`fund_cik`, `filing_date`, `ticker`, `issuer_name`, `cusip`, `shares`, `value_usd`, `allocation_pct` · `cik`, `name`, `manager_name`, `image_url`, `last_filing_date`, `last_value_usd`, `holdings_count`

`allocation_pct` **מחושב אצלנו** (`value_usd / total × 100`) — זה נכון, כי הדוקס של `/beta/live/sec13f` לא מכילים שדה משקל.

נזרקים: `ReportPeriod`, `Class`, `SH/PRN`, `Put/Call`, `Direction`.

⚠️ **אין טבלה לשינויי 13F.** `upsertChangesAsHoldings()` דוחס אותם ל-`dark_pool_fund_holdings` עם `allocation_pct: 0` ואז מחשב מחדש. כלומר `Change` / `Change_Pct` (הסיפור המעניין — «Buffett הגדיל 40% ב-AAPL») **לא נשמרים כמצב מתמשך**, רק ב-cache JSON.

### 6.4 `dark_pool_person_portfolio_snapshots`

`series`, `holdings`, `period_returns`, `portfolio_value`, `total_return_pct`, `metrics`, `profile_meta`, `source_meta` — כולם JSONB.

התוכן נבנה מ-`congressPortfolio.ts`: שחזור תיק מ-mid-range × מחירי Yahoo יומיים. **אף אחד מהמספרים האלה לא בא מ-Quiver.**

---

## 7. GAP TABLE

### 7.1 Endpoints זמינים ולא בשימוש

| Endpoint | Tier/תוכנית | מה זה נותן | השפעה על המוצר |
|---|---|---|---|
| `/beta/live/topshareholders/{ticker}` | 2 / Trader | `ownership[]` + `ownership_options[]` — מי מחזיק, כולל אופציות | **גבוהה** — טאב «מי מחזיק» חדש במסך טיקר. אין לנו שום דבר מקביל |
| `/beta/live/congress/politicians` | 1 / Hobbyist | **live net worth** + `TradeVolume` מוערך | **גבוהה** — פרופיל פוליטיקאי עם שווי נטו טרי במקום bulk יומי |
| `/beta/live/polymarkettrades` | 1 / Hobbyist | 23 שדות של הימור גדול בודד + דירוג הסוחר | **גבוהה** — הפיד היחיד ב-Trader עם timestamp אמיתי לעסקה. מתאים בדיוק לפורמט «Dark Pool feed» הקיים |
| `/beta/live/lobbying` · `/beta/historical/lobbying/{ticker}` | 1 / Hobbyist | `Amount`, `Client`, `Issue`, `Specific_Issue`, `Registrant` | **בינונית** — «במה החברה הזו משקיעה פוליטית» במסך טיקר |
| `/beta/live/govcontractsall` · `/beta/historical/govcontractsall/{ticker}` | 1 / Hobbyist | חוזה בודד: `Agency`, `Description`, `Amount`, `action_date` | **בינונית** — קטליזטור גלוי. מתחבר יפה לפיד קונגרס (חוזה ממשלתי ← עסקת פוליטיקאי) |
| `/beta/live/govcontracts` · `/beta/historical/govcontracts/{ticker}` | 1 / Hobbyist | אגרגט רבעוני `Amount`/`Qtr`/`Year` | **בינונית** — סדרת זמן לגרף |
| `/beta/bulk/corporatedonors` · `/beta/historical/corporatedonors/{ticker}` | 1 / Hobbyist | תרומות PAC: `BioGuideID` ↔ `Ticker` ↔ `TransactionAmount` | **בינונית-גבוהה** — **חיבור ישיר בין פוליטיקאי לחברה שתרמה לו.** יש `bioguide_id` **וגם** `ticker` בפילטרים: «X קנה מניית Y, ו-Y תרמה ל-X $Z» |
| `/beta/live/quivernews` | 2 / Trader | `headline`, `summary`, `category`, `image`, פילטר `ticker` | **בינונית** — תוכן חדשות מוכן לטאב החדשות הקיים |
| `/beta/live/housetrading` · `/beta/live/senatetrading` | 1 / Hobbyist | פיד live לפי בית, **+ פרמטר `options`** («Include options with trading data») | **בינונית** — `options` הוא היחיד שחושף עסקאות אופציות של פוליטיקאים |
| `/beta/historical/executivecompensation/{ticker}` | 2 / Trader | `Salary`, `Bonus`, `StockAndOptionAwards`, `TotalCompensation` לפי `Year` | **נמוכה-בינונית** — הקשר לעסקאות בכירים |
| `/beta/live/allpatents` · `/beta/historical/allpatents/{ticker}` · `patentdrift` · `patentmomentum` | 2 / Trader | פטנטים + 2 מטריקות קנייניות | **נמוכה** — retail לא מתמחר פטנטים |
| `/beta/live/appratings` | 2 / Trader | `Rating`, `Count` שבועי לפי publisher | **נמוכה** — נישתי |

### 7.2 שדות שאנחנו זורקים — ואיך זה נראה למשתמש

| שדה | Endpoint | זמין? | מה המשתמש מפסיד |
|---|---|---|---|
| **`ExcessReturn`** | `live/congresstrading`, `historical/congresstrading/{ticker}`, `bulk/trumpstocktrades` | ✅ **מגיע בכל קריאה שאנחנו כבר עושים** | «כמה הרוויח מאז» ברמת עסקה בודדת. היום זה קיים רק כממוצע בזיכרון ב-`uw-explore` |
| **`PriceChange`** + **`SPYChange`** | כנ״ל | ✅ | פירוק תשואה: מניה מול benchmark. מחליף את החישוב שלנו מול Yahoo |
| **`Party`** | כל endpoints הקונגרס | ✅ | תג מסיבה בכרטיס עסקה. אין עמודה ב-DB |
| **`House`** / **`District`** | כנ״ל | ✅ | «House · CA11». אין עמודה |
| **`TradeVolume`** | `bulk/` + `live/congress/politicians` | ✅ **כבר ב-cache שלנו** | «נפח מסחר מוערך» בכרטיס גילוי — בלי שום קריאת API נוספת |
| **`State`** | כנ״ל | ✅ **כבר ב-cache** | פילטר/תג מדינה |
| **`ImageURL`** | כנ״ל | ✅ **כבר ב-cache** | תמונה רשמית מ-Quiver במקום ניחוש URL מ-`unitedstates.github.io` (ומנגנון `dark_pool_person_portraits` שלם שבנוי כדי לפצות) |
| **`isTenPercentOwner`** / `isDirector` / `isOfficer` / `isOther` | `live/insiders` | ✅ | «CEO» מול «10% owner» — הבחנה מהותית באיכות סיגנל בכירים |
| **`directOrIndirectOwnership`** | `live/insiders` | ✅ | החזקה ישירה מול נאמנות |
| **מכירות בכירים** (`TransactionCode` ≠ `P`) | `live/insiders` | ✅ | חצי מהסיפור. אנחנו מסננים `P` בלבד |
| **`Change`** / **`Change_Pct`** של 13F | `live/sec13fchanges` | ⚠️ בשימוש בזיכרון, **לא נשמר** כמצב | «Buffett הגדיל ב-40%». נדחס ל-`dark_pool_fund_holdings` ואז מאבד את הדלתא |
| **`ReportPeriod`** | `live/sec13f` | ✅ | «Q2 2026» מול תאריך הגשה. Filing date ≠ תקופת הדיווח |
| **`SH/PRN`** / **`Put/Call`** / **`Direction`** | `live/sec13f` | ✅ | האם זו מניה, פוט, קול, או חוב. היום כולם מוצגים כאחזקה אחת |
| **`uploaded`** | `live/insiders`, `live/polymarkettrades` | ✅ | חישוב אמיתי של «כמה זמן לקח לנו לקלוט» — freshness מדיד ל-`QuiverAttribution` במקום טקסט קבוע |

### 7.3 דברים שאנחנו **מעריכים** — ויש להם תחליף אמיתי

| מה שאנחנו מעריכים | איפה בקוד | תחליף אמיתי מ-Quiver | הערכה |
|---|---|---|---|
| **שחזור mid-range של STOCK Act** — `1001 → $8,000` וכו׳ | `congressPortfolio.ts` `STOCK_ACT_FLOOR_MID` + `parseCongressAmount()` | **חלקי.** `volume_method` (`range_start`/`average`/`range_end`) עושה בדיוק את זה בצד Quiver — אבל **רק לאגרגט `TradeVolume` של פוליטיקאי**, לא לעסקה בודדת. לרמת אחזקה: `CurrentHolding` (USD) + `Allocation` (%) מ-`congress_stock_holdings` | **לא ניתן להחליף מלא.** אין endpoint שמחזיר $ מדויק לעסקה — ה-STOCK Act עצמו לא מדווח אותו. `Amount` מתועד מפורשות כ-«Lower bound». אפשר להחליף את האגרגטים, לא את העסקה הבודדת |
| **תשואת תיק משוחזרת** — Yahoo daily + TWR + `MAX_DISPLAYABLE_PERIOD_RETURN_PCT=250` + `chart_reliable` | `congressPortfolio.ts`, `materialize-darkpool-portfolios` | **`ExcessReturn` / `PriceChange` / `SPYChange` לעסקה** | **החלפה חלקית, שווה מאוד.** לא מחליף את הגרף לאורך זמן, אבל **מחליף את «תשואה מאז העסקה»** — שזה 90% ממה שהמשתמש מסתכל עליו. ומגיע מ-Quiver, כלומר ניתן לשיוך ולא «לא מאומת» |
| **שווי תיק** = סכום mid-range | `uw-investor-profile` `preferQuiverHoldings` | `CurrentHolding` (כבר בשימוש לפרופילים מאוצרים) | **כבר פתור למאוצרים.** הפער: `sync-quiver-congress-cache` מביא holdings רק ל-17 ה-curated (`top_active=0`). לכל השאר עדיין שחזור |
| **`allocation_pct` של 13F** | `sync-fund-13f` `value_usd/total` | **אין** — הדוקס של `live/sec13f` לא מכילים שדה משקל | **החישוב שלנו נכון.** להשאיר |
| **תמונות פרופיל** — `unitedstates.github.io/images/congress/225x275/{BioGuideID}.jpg` + `dark_pool_person_portraits` + Wikipedia fallback | `congressFeedBuild.ts`, `sync-person-portraits` | **`ImageURL`** מ-`politicians` (כבר ב-cache) | **החלפה זולה.** תשתית שלמה שאפשר לצמצם |
| **`avg_delay_days`** (Filed מול Traded) | `congressPortfolio.ts` `computeAvgDelay` | `ReportDate` + `TransactionDate` — **כבר בידינו** | **הנתון תקין, החישוב פגיע.** כש-`TransactionDate` חסר אנחנו נופלים ל-`ReportDate` ואז ה-delay של השורה נעשה 0 ומדלל את הממוצע |

---

## 8. סתירות בין הריפו לדוקס — ממצאים לפעולה

### 8.1 🔴 `date_from` לא קיים ב-`/beta/live/insiders`

```ts
// _shared/quiverQuant.ts — fetchQuiverLiveInsiders
const json = await quiverGetJson<unknown>(apiKey, '/beta/live/insiders', {
  date_from: opts.dateFrom?.slice(0, 10) || undefined,   // ← לא בדוקס
  page_size: pageSize,
  page,
});
```

הפרמטרים המתועדים הם `date`, `limit_codes`, `page`, `page_size`, `ticker`, `uploaded`. **אין `date_from`.**

**המשמעות:** ה-lookback (`FORM4_LOOKBACK_HOURS`, ברירת מחדל 48h) מסונן **רק בצד הלקוח** (`if (sinceDate && txDate < sinceDate) return null`). אנחנו מורידים עד 500 שורות ואז זורקים את רובן. גרוע מזה — אם `/beta/live/insiders` מחזיר חלון קבוע משלו, ייתכן שאנחנו מפספסים שורות שנפלו מחוץ לחלון בין ריצות cron.

**התיקון הנכון:** להשתמש ב-`uploaded` («Date the transaction was uploaded, formatted as YYYYMMDD») — זה בדיוק הסמנטיקה הנכונה לסנכרון אינקרמנטלי, ובצד השרת.

### 8.2 🔴 `most_recent` לא קיים ב-`/beta/live/sec13f`

```ts
// fetchQuiverSec13fByOwner
const json = await quiverGetJson<unknown>(apiKey, '/beta/live/sec13f', {
  owner: o,
  most_recent: mostRecent ? 'true' : undefined,   // ← מתועד רק ב-sec13fchanges
  page, page_size: pageSize,
});
```

הפרמטרים של `/beta/live/sec13f` הם `date`, `owner`, `page`, `page_size`, `period`, `ticker`, `today`. `most_recent` מתועד **רק** ב-`/beta/live/sec13fchanges`.

**המשמעות:** אנחנו מניחים שנקבל רק את התקופה האחרונה, אבל כנראה מקבלים **את כל ההיסטוריה** של ה-owner מדוללת ל-`maxRows=2000`. זה מסביר למה `dark_pool_fund_holdings` צריך `UNIQUE(fund_cik, filing_date, ticker)` — אנחנו מקבלים תקופות מעורבות. **הפרמטר הנכון הוא `period`.**

### 8.3 🔴 מיפוי שבור של House/Senate historical

`normalizeCongressTrade()` ממפה:
```ts
Representative: row.Representative || row.Name,
TransactionDate: row.TransactionDate || row.Traded,
```

אבל הסכימות בדוקס (סעיף 4.2):
- `historical/housetrading/{ticker}` → `Representative` ✅ אבל **`Date`**, לא `TransactionDate`
- `historical/senatetrading/{ticker}` → **`Senator`**, לא `Representative` · **`Date`**, לא `TransactionDate`

הנורמליזציה **לא מכירה לא ב-`Senator` ולא ב-`Date`.**

**המשמעות:** כשמריצים עם `include_chambers:true`:
- שורות Senate → `politician_name` נופל ל-`'פוליטיקאי'` (ה-fallback ב-`quiverToCongressRow`)
- שורות House **וגם** Senate → `transaction_date` נופל ל-`ReportDate`, כלומר **תאריך הדיווח מוצג כתאריך העסקה**. זה גם מרעיל את `computeAvgDelay` (delay=0)

מקל נסיבות: `include_chambers` כבוי כברירת מחדל. אבל הוא חשוף כדגל body, ולכן זו פצצה מתוקתקת.

### 8.4 🟡 שדות שהריפו מצהיר עליהם ולא קיימים בדוקס

| Type בריפו | שדה | סטטוס |
|---|---|---|
| `QuiverCongressTrade` | `Name`, `Filed`, `Traded`, `Trade_Size_USD`, `Company`, `Chamber` (מסומנים «V2 fields») | ✅ **מאומת** (תוקן 2026-09-17) — כולם מופיעים ב-`CongressionalTradeV2`. חסרים בטיפוס: `Status`, `Subholding`, `Comments`, `Quiver_Upload_Time`, `excess_return`, `State` |
| `QuiverPolitician` | `LastTraded`, `House`, `'Net Worth'` | **לא מאומת** — הסכימה מכילה `Chamber` (לא `House`) ו-`NetWorth` (לא `'Net Worth'`). `LastTraded` לא קיים כלל |
| `QuiverInsiderRow` | `TransactionDate`, `Title`, `AccessionNumber` | **לא מאומת** — הדוקס אומרים `Date`, `officerTitle`, ואין `AccessionNumber` |
| `QuiverSec13fHolding` | `Company`, `Weight`, `Owner`, `Held`, `Held_Normalized`, `Close`, `FilingDate`, `PutCall` | **לא מאומת**. `PutCall` בפרט שגוי — הדוקס אומרים **`Put/Call`** |
| `QuiverSec13fChange` | `Change`, `Change_Share`, `Change_Pct`, `Held`, `Held_Normalized`, `Close`, `Action`, `ChangePercent` | **לא מאומת** — ל-`sec13fchanges` אין response schema |

⚠️ **תיקון תיעוד נדרש:** ההערה ב-`quiverQuant.ts` שורות 151–156 אומרת «Live SEC 13F changes — **docs fields**: Date, ReportPeriod, Ticker, Fund, Change, Change_Share, Change_Pct, Held, Held_Normalized, Close». **הדוקס לא מכילים את הרשימה הזו.** לא נורא שהקוד סובלני לשמות שונים (זו הנדסה נכונה מול spec חסר) — נורא שההערה **מציגה תצפית runtime כדוקומנטציה.**

⚠️ `docs/UNUSUAL_WHALES_INTEGRATION.md:21` מציין «`LastTraded`» כשדה של `/beta/bulk/congress/politicians`. לא מופיע בסכימה. לתקן ל-«לא מאומת».

### 8.5 🟡 `DPI` — התיאור בדוקס לא תומך ב-framing שלנו

הדוקס: `DPI` = «**% of shares short**» · `OTC_Short` = «Number of shares **short** on the given day» · `OTC_Total` = «Total number of shares on the given day».

ההערה בריפו: «Off-exchange / dark-pool **intensity**». `DARK_POOL_DATA_SYNC.md` מציג את זה כ-«Dark pool יומי (DPI)».

לפי הדוקס זה מדד **short**, לא מדד עוצמת דארק-פול. יכול להיות שהמותג של Quiver הוא «Dark Pool Index» — אבל **התיאור שאנחנו יכולים לצטט ולהתגונן איתו** אומר short. לא לבנות UI שמכנה את זה «עוצמת דארק-פול» בלי אימות מול Quiver.

### 8.6 🟡 `/beta/live/offexchange` בלי pagination

`fetchQuiverLiveOffexchange()` לא שולח `page` / `page_size` בכלל, למרות שהדוקס מתעדים את שניהם. אחר כך `fetchFromQuiverOffexchange` חותך ל-`maxLiveRows` (ברירת מחדל 800) לפי `OTC_Total` יורד.

«Yesterday's off-exchange activity across **all companies**» זה אלפי טיקרים. **ייתכן שאנחנו מקבלים רק את העמוד הראשון** ואז ממיינים תת-קבוצה שרירותית. גודל ה-`page_size` בברירת מחדל — **לא מאומת** (הדוקס לא מציינים).

### 8.7 🟡 `Date` של 13F כ-epoch ms

הדוקס: `Date` = «Filing date (**expressed in ms since Epoch CST**)», ו-`ReportPeriod` כנ״ל.

`normalizeQuiverIsoDate()` מטפל ב-ISO, ב-`MM/DD/YYYY`, ואז `Date.parse(s)`. `Date.parse("1755216000000")` → `NaN` → מחזיר `null`. אם Quiver מחזיר מספר גולמי, **תאריך ההגשה נופל בשקט.**

---

## 9. מה לא זמין / לא מאומת — סיכום מסודר

### 9.1 מאומת שלא זמין ב-Trader

| דאטה | למה | ראיה |
|---|---|---|
| Legislation + bill summaries (כולל `politicianTrades`, `lobbyingAmounts`) | `enterprise` | tag ב-spec + חסר מרשימות Hobbyist/Trader |
| `live/congressholdings` (`Politician`/`Holdings`/`Type`) | `enterprise` | כנ״ל. **שימו לב:** `live/congress_stock_holdings` (Tier 1, זמין) הוא endpoint **אחר** |
| Quiver Strategies holdings | `enterprise` | כנ״ל |
| Live RSS | `enterprise` | כנ״ל |
| **WSB / Twitter / Wikipedia sentiment** | `internal` | `/beta/tickerdata` הוא ה-endpoint היחיד עם `wsbMentionsWeekly`, `twitter_change`, `wiki_change` — ומתויג `internal` |
| CNBC / Jim Cramer picks | `internal` | `/beta/live/cnbc` + `/beta/personalities` |
| Corporate flights | `internal` | `/beta/live/flights` |
| Event beta / election odds | `internal` | `/beta/today/eventsbeta`, `/beta/historical/eventsbeta/{ticker}` |
| New Constructs ratings | מנוי נפרד | `Tier New Constructs Ratings` + בלוק תמחור עצמאי |
| **Commercial Use Rights** | ✅ אושר מול Quiver עד $1M/שנה | עמוד התמחור מסמן `* No Commercial Use Rights`, אך אישור ישיר מ-Quiver (2026-09-17) גובר עליו |

### 9.2 לא מאומת — הדוקס לא אומרים

| שאלה | למה לא מאומת |
|---|---|
| **Rate limits / quotas** | אין ב-OpenAPI spec ולא בעמוד התמחור |
| **`page_size` מקסימלי** | `integer` בלי `maximum`. ה-caps שלנו (100/200/500/1000) שרירותיים |
| **ברירת מחדל של `page_size`** לרוב ה-endpoints | מצוין רק ל-3: trumpstocktrades (200), corporatedonors (500), quivernews (30), executivecompensation (200) |
| **האם Commercial פותח את 6 ה-`enterprise`** | עמוד התמחור אומר «All Hobbyist & Trader Plan Datasets + Commercial Use Rights» — לא מונה אותם שמית |
| ~~שמות שדות של `bulk/congresstrading`~~ | ~~response schema ריק~~ — **שגוי, תוקן 2026-09-17.** V2 מתועד כ-`CongressionalTradeV2`. רק V1 נותר לא-מאומת מפורשות |
| **שמות שדות של `live/sec13fchanges`** | response schema ריק |
| **שמות שדות של `live/housetrading` / `live/senatetrading`** | response schema ריק (בשני ה-live; ה-`historical` דווקא מתועדים) |
| **מה `mobile=true` מחזיר** ב-sec13fchanges | «Mobile response», בלי סכימה |
| **האם ETF Holdings עדיין דאטה-סט** | מופיע בעמוד התמחור **בתוך הערת HTML** (`ETF Holdings -->`), כלומר הוסר מהתצוגה. אין endpoint מקביל ב-spec. נראה שהוחלף ב-Top Shareholders |
| **תדירות רענון של כל דאטה-סט** | הדוקס אומרים רק «live» / «yesterday's» / «last quarter's». אין SLA |

### 9.3 דברים שהמשימה הזכירה ולא קיימים

| מבוקש | מצב |
|---|---|
| WSB / retail sentiment | **לא זמין** — `internal` בלבד |
| Insider **sector** flow | **לא קיים ב-Quiver.** ל-`/beta/live/insiders` אין שדה sector. ה-`sector` ב-DB שלנו מגיע מ-Form4API, לא מ-Quiver |
| Dark pool **prints** בודדים | **לא קיים.** `offexchange` הוא אגרגט יומי. `sync-darkpool` צודק בכך שהוא מדלג על מנוע הסיגנלים כשהספק הוא Quiver |
| «Filed vs Traded» | **קיים ובידינו** — `ReportDate` + `TransactionDate`. הפער הוא בשימור ובחישוב, לא בזמינות |
| 13F changes | **קיים ובשימוש**, אבל שמות השדות לא מאומתים ו-`Change` לא נשמר כמצב |
| Trump | **קיים ובשימוש** — פרט ל-`ExcessReturn` שנזרק |
| Lobbying / gov contracts / patents | **קיימים וזמינים**, לא בשימוש בכלל |

---

## 10. Roadmap מומלץ

### 🔴 עדיפות גבוהה

| # | שדרוג | Endpoint | DB | UI | מאמץ |
|---|---|---|---|---|---|
| ~~H0~~ | ~~בירור רישוי Commercial Use Rights~~ — **בוצע ונסגר (2026-09-17): שימוש מלא מאושר עד $1M/שנה. לא חוסם.** | — | — | — | — |
| **H1** | **לשמר `ExcessReturn` / `PriceChange` / `SPYChange`** | `live/congresstrading` + `historical/congresstrading/{ticker}` + `bulk/trumpstocktrades` — **אפס קריאות חדשות** | `ALTER TABLE dark_pool_congress_trades ADD excess_return NUMERIC, price_change_pct NUMERIC, spy_change_pct NUMERIC` | תשואה לכל שורה ב-`CongressTradeCard` / `DarkPoolFeedCard`; מחליף חלק מהשחזור המוערך בפרופיל | **S** — 3 שדות ב-`quiverToCongressRow`, מיגרציה, שדרוג כרטיס |
| **H2** | **לתקן את 3 הבאגים מסעיף 8.1–8.3** | `date_from`→`uploaded` · `most_recent`→`period` · מיפוי `Senator`/`Date` | — | נכונות: תאריכי עסקה, תקופות 13F, שמות סנאטורים | **S** — נקודתי ב-`quiverQuant.ts` |
| **H3** | **`Party` / `House` / `District` / `TickerType`** | אותן קריאות, אפס תוספת | 4 עמודות ב-`dark_pool_congress_trades` | תגים בכרטיס, פילטרים לפי מסיבה/בית בפיד ובגילוי | **S** |
| **H4** | **`live/topshareholders/{ticker}`** | endpoint חדש (Trader) | טבלה חדשה `dark_pool_top_shareholders` או `dark_pool_uw_snapshots` per-ticker | טאב «מי מחזיק» במסך טיקר — תוכן שאין לנו כלל | **M** — sync חדש + cron + מסך |

### 🟡 עדיפות בינונית

| # | שדרוג | Endpoint | DB | UI | מאמץ |
|---|---|---|---|---|---|
| **M1** | **`TradeVolume` / `State` / `ImageURL`** | **אפס** — כבר ב-`quiver_congress_politicians` | אפשר בלי שינוי סכימה | כרטיסי גילוי + מצמצם את תשתית `dark_pool_person_portraits` | **XS** — client-side בלבד |
| **M2** | **מכירות בכירים + `isTenPercentOwner`/`isDirector`/`isOfficer`** | `live/insiders` (להסיר את סינון `P`) | להרחיב `CHECK` על `transaction_type`, `+ is_ten_percent_owner`, `is_director`, `is_officer`, `ownership_type` | פיד בכירים דו-כיווני + סינון «CEO בלבד» | **M** — צריך הפרדה של buy/sell ב-UI |
| **M3** | **`live/congress/politicians` ל-live net worth** | endpoint חדש (Hobbyist) | להרחיב payload של ה-cache | «שווי נטו» בפרופיל פוליטיקאי — מסלק את ההסתייגות ב-`DARK_POOL_DATA_SYNC.md` | **S** |
| **M4** | **`bulk/corporatedonors`** | endpoint חדש (Hobbyist) | `dark_pool_corporate_donors(bioguide_id, ticker, amount, cycle, committee_name)` | הסיפור החזק: «X קנה Y — ו-Y תרם ל-X». יש `bioguide_id` **וגם** `ticker` בפילטרים | **M** |
| **M5** | **`live/govcontractsall` + `historical/govcontracts/{ticker}`** | 2 endpoints (Hobbyist) | `dark_pool_gov_contracts` | קטליזטור במסך טיקר + הצלבה עם עסקאות קונגרס | **M** |
| **M6** | **שימור אמיתי של 13F `Change`** | `live/sec13fchanges` — כבר קורא | `dark_pool_fund_changes(fund_cik, report_period, ticker, change_shares, change_pct)` **במקום** לדחוס ל-`fund_holdings` | «Buffett הגדיל 40% ב-AAPL» כפיד; היום הדלתא נמחקת | **M** |
| **M7** | **`live/polymarkettrades`** | endpoint חדש (Hobbyist) | `dark_pool_prediction_trades` | הפיד היחיד ב-Trader עם timestamp אמיתי. מתאים לפורמט הקיים של `DarkPoolTradeFeedCard` | **M** |
| **M8** | **`ReportPeriod` + `SH/PRN` + `Put/Call` ב-13F** | כבר קורא | 3 עמודות ב-`dark_pool_fund_holdings` | «Q2 2026» + הבחנה מניה/פוט/קול. היום הכל אחזקה אחת | **S** |

### 🟢 עדיפות נמוכה

| # | שדרוג | Endpoint | DB | UI | מאמץ |
|---|---|---|---|---|---|
| **L1** | `live/lobbying` + per-ticker | Hobbyist | `dark_pool_lobbying` | סקשן במסך טיקר | M |
| **L2** | `live/quivernews` | Trader | קיימת תשתית חדשות | מקור נוסף לטאב החדשות | S |
| **L3** | `options=true` על `live/housetrading` / `live/senatetrading` | Hobbyist | — | עסקאות אופציות של פוליטיקאים (תוכן שאין בשום מקום אחר) | S — **לאמת קודם** מה חוזר (אין schema) |
| **L4** | `historical/executivecompensation/{ticker}` | Trader | `dark_pool_exec_compensation` | הקשר לעסקאות בכירים | M |
| **L5** | `allpatents` / `patentdrift` / `patentmomentum` | Trader | — | ערך retail נמוך | M |
| **L6** | `live/appratings` | Trader | — | נישתי | S |
| **L7** | `pagination` ל-`live/offexchange` | כבר קורא | — | כיסוי מלא במקום עמוד ראשון | S |

### מסלול מומלץ

**סבב 1 (H0 + H1 + H2 + H3):** רק שדות שכבר מגיעים ב-payloads הקיימים + תיקוני נכונות. **אפס קריאות API חדשות, אפס שינוי cron.** ה-ROI הגבוה במסמך: `ExcessReturn` לבד מחליף את המטריקה המוערכת הבולטת ביותר במוצר בנתון מ-Quiver שאפשר לשייך.

**סבב 2 (M1 + M8 + H4):** M1 הוא client-side בלבד. H4 הוא ה-endpoint החדש הראשון ששווה את הרוחב.

**סבב 3 (M4 + M5):** «חיבור פוליטיקאי↔חברה» — זה מה שמבדל אפליקציית קונגרס מפיד עסקאות רגיל.

---

## 11. תחזוקה

- **מקור האמת ל-endpoints:** `https://api.quiverquant.com/docs/schema.json`. ה-SPA ב-`/docs/` רק מציג אותו. לרענון: `curl -sS https://api.quiverquant.com/docs/schema.json`.
- **מקור האמת לתוכניות:** `https://api.quiverquant.com/pricing/` (HTML סטטי). מיפוי: `Tier 1`→Hobbyist, `Tier 2`→Trader, `enterprise`→Commercial, `internal`→לא ללקוחות.
- כשמוסיפים endpoint: לעדכן את סעיף 5.1 (endpoint + params + cron), את הטבלה ב-`UNUSUAL_WHALES_INTEGRATION.md`, ואת טבלת התדירויות ב-`DARK_POOL_DATA_SYNC.md`.
- **לא להצהיר «docs fields» בהערות קוד על שדות שנצפו ב-runtime.** לסמן `// observed, not in schema.json`.
