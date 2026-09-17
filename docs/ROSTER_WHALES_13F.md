# ROSTER: Whales / Super-Investors — 13F (Quiver Quant)

> **Scope:** קבוצה 3 מתוך 120 השמות — 40 "לווייתנים" / מנהלי קרנות.
> פוליטיקאים (bioguide) ומנהלים תאגידיים (Form 4) מטופלים בנפרד ולא נכללים כאן.
>
> **תאריך האודיט:** 2026-09-17 · **מקור נתונים:** Quiver Quant, plan Trader
> **Source of truth ל-API:** `https://api.quiverquant.com/docs/schema.json` (נשלף ואומת ב-2026-09-17)
> **אימות חי:** בוצע מול Quiver דרך `POST /functions/v1/sync-fund-13f {"probe":true}` (read-only) ב-2026-09-17T19:54:40Z, וכן שאילתות `SELECT` על `dark_pool_fund_holdings` / `dark_pool_fund_managers` בפרודקשן.

---

## 0. תקציר מנהלים

| ממצא | מסקנה |
|---|---|
| 40 שמות → אחרי dedupe | **39 ישויות** (#19 = #40, Andreas Halvorsen) |
| ראויים לשילוח כפרופיל 13F | **11 core + 3 מותנים = 14** |
| "זמין טכנית אבל מטעה מוצרית" | **18** (market-making / index / quant / credit / האדם לא מנהל) |
| אין 13F בכלל / שייך לצינור אחר | **6** |
| התיישנות הנתון הטרי ביותר היום | **79 ימים** מסוף התקופה (2026-06-30) · **34 ימים** מיום ההגשה (2026-08-14) |
| התיישנות במקרה הגרוע | **137 ימים** (ב-2026-11-14, רגע לפני שהרבעון הבא מתפרסם) |
| "תשואה" של 13F בקוד הקיים | **שגויה ומדידה — לא מוערכת. ראה סעיף 4.2.** באפט יוצג היום כ-**−65.97%**, קאתי wood כ-**+3,557.8%** |

---

## 1. Identity model — איך Quiver מזהה מגיש 13F

### 1.1 השורה התחתונה: אין CIK ואין institution ID

**אין ב-Quiver שום מזהה יציב למגיש 13F.** לא CIK, לא `institution_id`, לא slug.
הזיהוי היחיד הוא **string חופשי בפרמטר `owner`**, והשדה שחוזר הוא **`Fund`** — טקסט חופשי גם הוא.

זה שונה מהותית מצינור הפוליטיקאים (`bioguide`) ומ-Form 4 (`cik` של המנפיק). המשמעות:

- כל פרופיל חייב **alias list ידני** שנשמר אצלנו. זה בדיוק מה שהקוד עושה היום ב-`CURATED_FUND_QUIVER_OWNERS` — מיפוי `CIK → { owner, owners[] }` שאנחנו מתחזקים, כאשר ה-CIK הוא **המזהה שלנו, מ-SEC, לא של Quiver**.
- שינוי שם אצל המגיש (מיזוג, re-registration) **שובר את הפרופיל בשקט** — הסנכרון יחזיר 0 שורות ובלי התראה. אין `show_deleted` / `renamed_from`.
- אין endpoint חיפוש/autocomplete שמיש: `/beta/funds` הוא `Tier 1` + `"x-internal": true` + `WebPlatformTokenAuth`, כלומר **לא זמין ל-API token** של plan Trader. **לא מאומת** שהוא נגיש לנו בכלל.

### 1.2 עד כמה fuzzy ההתאמה של `owner`

**לא מאומת** — הדוקס כותבים רק `"Owner for SEC13F Search"`, בלי לציין exact/prefix/contains/case-sensitivity.

מה שכן אומת בשטח (probe, 2026-09-17):

| owner string שנשלח | rows חזרו | הערה |
|---|---|---|
| `BERKSHIRE HATHAWAY INC` | 705 | עובד |
| `ARK Investment Management LLC` | 2000 (נחתך ב-maxRows) | עובד |
| `Pershing Square Capital Management, L.P.` | 155 | עובד — **כולל הפסיק** |

הקוד ב-`quiverQuant.ts` מנסה 3–4 ואריאציות כתיב לכל קרן ועוצר בראשונה שמחזירה שורות. זו הנדסה נכונה מול spec לא מוגדר — **אבל זה אומר שכל שם חדש מצריך trial-and-error ידני**, ואי אפשר לגלות אוטומטית את ה-string הנכון ל-37 השמות שטרם מופו.

### 1.3 Endpoints זמינים

| Endpoint | Tier | Params | שימוש אצלנו |
|---|---|---|---|
| `GET /beta/live/sec13f` | Tier 2 · public | `date`, `owner`, `page`, `page_size`, `period`, `ticker`, `today` | `fetchQuiverSec13fByOwner` |
| `GET /beta/live/sec13fchanges` | Tier 2 · public | `date`, `mobile`, `most_recent`, `owner`, `page`, `page_size`, `period`, `show_new_funds`, `ticker`, `today` | `fetchQuiverLiveSec13fChanges` |
| `GET /beta/live/topshareholders/{ticker}` | Tier 2 · public | `ticker` (path) | לא בשימוש |
| `GET /beta/funds` | **Tier 1 · internal** | — | **לא נגיש** (`x-internal: true`) |

⚠️ **`most_recent` לא קיים ב-`/beta/live/sec13f`** — מתועד רק ב-`sec13fchanges`. זה תוקן בקוד (`QuiverSec13fByOwnerOpts.mostRecent` מסומן `@deprecated` ולא נשלח), אבל **הפרמטר `period` גם לא נשלח**, ולכן הסנכרון היומי מוריד את **כל ההיסטוריה** (705–3,200 שורות לקרן) ומשליך 90% ממנה בצד הלקוח. ראה סעיף 5.2.

### 1.4 שדות התשובה — **אומתו חיים**

האודיט הקודם (`docs/QUIVER_API_AUDIT.md` §4.10) קבע ש-`sec13fchanges` הוא ללא response schema ולכן שמות השדות **לא מאומתים**. **שני הדברים השתנו:**

1. ה-schema **כן** מכיל עכשיו `SEC13FChangesResponse → anyOf[SEC13FChangesEntry, SEC13FChangesEntryMobile]`.
2. ה-probe החי אישר את שמות השדות בדיוק.

**`/beta/live/sec13f` — observed keys (3/3 קרנות, זהה):**

```
Date · ReportPeriod · Name · Ticker · CUSIP · Fund · Class · Value · Shares · SH/PRN · Put/Call · Direction
```

**`/beta/live/sec13fchanges` — observed keys (3/3 קרנות, זהה):**

```
Date · ReportPeriod · Ticker · Fund · Change · Change_Share · Change_Pct · Held · Held_Normalized · Close
```

| מסקנה | פירוט |
|---|---|
| ✅ שמות השדות בקוד **נכונים** | `Change`, `Change_Share`, `Change_Pct`, `Held`, `Held_Normalized`, `Close` — כולם קיימים באמת |
| 🔴 **`sec13fchanges` לא מחזיר `Value` ולא `Shares`** | ולכן `quiverSec13fValueUsd()` נופל ל-`Held × Close`. זה **המקור לכל בעיית ההיסטוריה** בסעיף 4 |
| 🔴 **`sec13fchanges` לא מחזיר `CUSIP` ולא `Company`/`Name`** | לכן כל שורת היסטוריה נכתבת עם `cusip=NULL`, `issuer_name=NULL`. אומת ב-DB |
| 🔴 **`sec13fchanges` לא מחזיר `Action`** | הקוד מייצר אותו לוקאלית מסימן `Change`. תקין, אבל לא נתון מהספק |
| ⚠️ `Company`, `Weight`, `Owner`, `Held`, `Close`, `FilingDate` ב-`QuiverSec13fHolding` | **אינם קיימים** ב-`sec13f`. dead fields ב-type |
| ⚠️ `PutCall` ב-type | שם השדה האמיתי הוא **`Put/Call`** (עם סלאש). השדה **נזרק** היום — puts של Burry מוצגים כאחזקת long |

---

## 2. Live verification — מה באמת חזר

### 2.1 מגבלת האימות (חשוב)

**לא הצלחתי להשיג credential גולמי של Quiver באופן בטוח.** `.env` המקומי לא מכיל מפתח Quiver כלל, ו-`supabase secrets list` מחזיר רק **SHA-256 digest** של `QUIVER_API_KEY`, לא את הערך.

לכן האימות החי מוגבל ל-**3 קרנות** — אלו היחידות שיש להן נתיב קוד מוכן (`CURATED_FUND_QUIVER_OWNERS`), דרך endpoint ה-probe שכבר deployed (`verify_jwt: false`, read-only, לא כותב ל-DB).

**עבור 36 הקרנות האחרות אין ולו שורת נתונים אמיתית אחת.** לא נשלח owner string שרירותי ל-Quiver בשום מקום בקוד, ולא נבנה סקריפט חדש שדורש את המפתח. כל טור "Quiver owner string" בסעיף 3 שאינו אחד מ-3 אלה מסומן **לא מאומת**.

### 2.2 מה שכן אומת — Quiver live (probe, 2026-09-17T19:54:40Z)

| CIK | owner string שעבד | `sec13f` rows | `sec13fchanges` rows (`most_recent=true`) |
|---|---|---|---|
| 1067983 | `BERKSHIRE HATHAWAY INC` | 705 (כל התקופות) | 30 |
| 1336528 | `Pershing Square Capital Management, L.P.` | 155 (כל התקופות) | 12 |
| 1697748 | `ARK Investment Management LLC` | 2000 (נחתך) | 195 |

קריאה ללא `owner` החזירה 200 שורות בעמוד הראשון בלבד (cap) — כלומר **`owner` הוא חובה מעשית**; אין דרך למשוך "כל הקרנות" ב-Quiver בסדר גודל שמיש.

### 2.3 מה שכן אומת — הנתון שכבר יושב אצלנו בפרודקשן

```
last sync: 2026-08-29 19:07 UTC  (לפני 19 ימים — ה-cron `sync-fund-13f-daily @ 0 6 * * *` לא רץ מאז, או רץ ונכשל)
```

| CIK | Fund (string אמיתי מ-Quiver) | Manager | latest period | staleness (ימים) | holdings | total value (USD) |
|---|---|---|---|---|---|---|
| 1067983 | `BERKSHIRE HATHAWAY INC` | Warren Buffett | **2026-06-30** | **79** | 30 | 299,280,002,205 |
| 1697748 | `ARK Investment Management LLC` | Cathie Wood | **2026-06-30** | **79** | 189 | 15,420,490,909 |
| 1336528 | `Pershing Square Capital Management, L.P.` | Bill Ackman | **2026-03-31** | **170** 🔴 | 11 | 13,625,112,704 |

🔴 **באג מאומת:** Pershing תקוע ברבעון Q1 2026 למרות שה-probe החי מחזיר 12 שורות `sec13fchanges` לתקופה `2026-06-30` (filing date `2026-08-14`). כלומר **Quiver כן מחזיק את Q2 2026 ל-Pershing ואנחנו לא כתבנו אותו.** הפרופיל של אקמן באפליקציה מציג כרגע נתון בן 170 ימים.

### 2.4 חשבון ההתיישנות — מדויק, להיום 2026-09-17

| מדד | ערך |
|---|---|
| התקופה הטרייה ביותר שקיימת | `2026-06-30` (Q2 2026) |
| ימים מסוף התקופה | **79** |
| תאריך ההגשה בפועל (`Date` מ-Quiver) | `2026-08-14` |
| ימים מההגשה | **34** |
| המועד החוקי להגשה | 45 יום מסוף רבעון → 14/2, 15/5, 14/8, 14/11 |
| התקופה הבאה (Q3 2026) תסתיים | `2026-09-30` |
| ומתפרסמת עד | `2026-11-14` — **בעוד 58 ימים** |
| גיל הנתון "הטרי" ערב הפרסום הבא | **137 ימים** |

**המשמעות:** במשך 58 הימים הקרובים, שום פרופיל 13F באפליקציה לא יתעדכן. הנתון יזדקן מ-79 ל-137 ימים. זה לא bug — זו התכונה של 13F.

---

## 3. Resolution table — 40 השמות

**מקרא viability:**
`viable` = 13F קיים, מרוכז דיו, ומשקף החלטות אמיתיות של האדם
`misleading` = 13F קיים טכנית אבל **לא מייצג את מה שהמשתמש חושב שהוא רואה** (market-making / index / quant / credit / האדם לא מנהל יותר)
`not available` = אין 13F, או הנתון שייך לצינור אחר (Form 4 / 13D)

**מקרא verification:** `live` = אומת מול Quiver ב-2026-09-17 · `unverified` = **לא מאומת** — לא נשלח owner string ל-Quiver

| # | Person | Institution | Quiver `owner` string | Verified | 13F usable | Latest period | Stale (d) | Holdings | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Elon Musk | — (Tesla) | — | — | **לא** | — | — | — | `not available` — Form 4 / 13D. **צינור אחר** |
| 2 | Bill Ackman | Pershing Square Capital Management | `Pershing Square Capital Management, L.P.` | **live** | כן | 2026-03-31 (ב-DB) / 2026-06-30 (ב-Quiver) | 170 / 79 | 11 | **`viable`** ⭐ הטוב ביותר בקבוצה — 11 פוזיציות, long-only באמת |
| 3 | Michael Burry | Scion Asset Management | לא מאומת | unverified | ⚠️ | לא מאומת | — | — | `misleading` — התיק בנוי על **puts**, ושדה `Put/Call` נזרק אצלנו. **בנוסף: יש לאמת מול SEC אם Scion עוד מגישה** (דיווחים על deregistration — **לא מאומת**) |
| 4 | Kevin Warsh | — | — | — | **לא** | — | — | — | `not available` — אין קרן ואין 13F בשמו. (קישור ל-Duquesne Family Office — **לא מאומת**) |
| 5 | Warren Buffett | Berkshire Hathaway | `BERKSHIRE HATHAWAY INC` | **live** | כן | 2026-06-30 | 79 | 30 | **`viable`** ⭐ |
| 6 | Ken Griffin | Citadel Advisors | לא מאומת | unverified | טכנית כן | לא מאומת | — | אלפי שורות | **`misleading`** 🔴 — 13F של Citadel הוא בעיקר **market-making + hedging**, עם אלפי שורות ואופציות. "התיק של גריפין" הוא בדיה |
| 7 | Ray Dalio | Bridgewater Associates | לא מאומת | unverified | טכנית כן | לא מאומת | — | מאות | **`misleading`** 🔴 — Bridgewater הוא macro (futures/bonds/FX) שלא מדווח ב-13F. ה-13F הוא ETFs + EM. **ודאליו עזב את ניהול ההשקעות ב-2022** |
| 8 | Steven Cohen | Point72 Asset Management | לא מאומת | unverified | טכנית כן | לא מאומת | — | אלפי שורות | **`misleading`** — multi-manager, אלפי פוזיציות, short book עצום בלתי נראה |
| 9 | David Tepper | Appaloosa Management | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** ⭐ מרוכז, long equity אמיתי |
| 10 | Stan Druckenmiller | Duquesne Family Office | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** ⭐ |
| 11 | Paul Tudor Jones | Tudor Investment Corp | לא מאומת | unverified | חלקית | לא מאומת | — | מאות | `misleading` — macro + אופציות; ה-13F הוא שבריר |
| 12 | Carl Icahn | Icahn Enterprises / Icahn Capital | לא מאומת | unverified | כן | לא מאומת | — | ~10–15 | `viable*` — מרוכז, אבל איקאן מריץ **short book גדול** שלא נראה ב-13F. חייב disclaimer |
| 13 | Cathie Wood | ARK Investment Management | `ARK Investment Management LLC` | **live** | כן | 2026-06-30 | 79 | 189 | **`viable`, אבל לא דרך 13F** 🔴 — ARK מפרסמת **holdings יומיים** בחינם. להציג נתון בן 79 ימים זו רגרסיה מודעת |
| 14 | Ryan Cohen | RC Ventures | — | — | **לא** | — | — | — | `not available` — Form 4 / 13D. **צינור אחר** |
| 15 | Dan Loeb | Third Point | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** |
| 16 | Chase Coleman | Tiger Global Management | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** — הערה: התיק הפרטי (VC) גדול מהציבורי ובלתי נראה |
| 17 | Seth Klarman | Baupost Group | לא מאומת | unverified | ⚠️ | לא מאומת | — | לא מאומת | `viable*` — Baupost הצטמצמה משמעותית והתיק כולל נכסים לא-13F. **חייב אימות טרי** |
| 18 | Cliff Asness | AQR Capital Management | לא מאומת | unverified | טכנית כן | לא מאומת | — | אלפי שורות | **`misleading`** 🔴 — תיק factor/quant. אין "כוונה" מאחורי שורה בודדת |
| 19 | Andreas Halvorsen | Viking Global Investors | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** — **זהה ל-#40** |
| 20 | David Shaw | D. E. Shaw & Co. | לא מאומת | unverified | טכנית כן | לא מאומת | — | אלפי שורות | **`misleading`** 🔴 — quant. דיוויד שו גם לא מנהל בפועל |
| 21 | Jim Simons | Renaissance Technologies | לא מאומת | unverified | טכנית כן | לא מאומת | — | ~3,000+ | **`not available` כאדם** 🔴 — **סימונס נפטר ב-מאי 2024**. ה-13F ממשיך כפירמה. ראה §3.2 |
| 22 | Nelson Peltz | Trian Fund Management | לא מאומת | unverified | כן | לא מאומת | — | ~10 | **`viable`** ⭐ activist מרוכז |
| 23 | George Soros | Soros Fund Management | לא מאומת | unverified | טכנית כן | לא מאומת | — | מאות | `misleading` — **סורוס העביר את הניהול ל-Alex Soros (2023)**. הקישור person→portfolio שגוי |
| 24 | Howard Marks | Oaktree Capital Management | לא מאומת | unverified | טכנית כן | לא מאומת | — | לא מאומת | **`misleading`** 🔴 — Oaktree הוא **credit/distressed debt**. אג"ח לא מדווח ב-13F. מה שיוצג הוא שארית equity זניחה |
| 25 | Larry Fink | BlackRock | לא מאומת | unverified | טכנית כן | לא מאומת | — | **~10,000+** | **`misleading` / חסר תועלת מוחלט** 🔴🔴 — 13F של BlackRock הוא **כל מדדי העולם** (~$3T). אין בו שום החלטה של פינק. **לא לשלב** |
| 26 | Stephen Schwarzman | Blackstone | לא מאומת | unverified | טכנית כן | לא מאומת | — | לא מאומת | **`misleading`** 🔴 — Blackstone הוא PE/RE שלא מדווח ב-13F. ה-13F הוא שבריר לא מייצג |
| 27 | Chamath Palihapitiya | Social Capital | לא מאומת | unverified | **לא מאומת** | לא מאומת | — | — | `not available` (מסתמן) — Social Capital הוא VC; קיום 13F משמעותי **לא מאומת**. לא לשלב עד אימות |
| 28 | Izzy Englander | Millennium Management | לא מאומת | unverified | טכנית כן | לא מאומת | — | אלפי שורות | **`misleading`** 🔴 — multi-strat, ~300 צוותים. אין "תיק של אנגלנדר" |
| 29 | Philippe Laffont | Coatue Management | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** |
| 30 | David Einhorn | Greenlight Capital | לא מאומת | unverified | כן | לא מאומת | — | עשרות | `viable*` — short book מפורסם ובלתי נראה. חייב disclaimer |
| 31 | Steve Mandel | Lone Pine Capital | לא מאומת | unverified | טכנית כן | לא מאומת | — | עשרות | `misleading` — **מנדל לא מנהל כספים מאז 2019**. הקישור person→portfolio מטעה |
| 32 | Bruce Flatt | Brookfield | לא מאומת | unverified | טכנית כן | לא מאומת | — | לא מאומת | **`misleading`** 🔴 — Brookfield הוא infra/RE/PE. ה-13F שולי ולא קשור להחלטות פלאט |
| 33 | Bill Miller | Miller Value Partners | לא מאומת | unverified | ⚠️ | לא מאומת | — | לא מאומת | `misleading` — מילר העביר את הניהול; AUM קטן. **חייב אימות** |
| 34 | Chuck Royce | Royce & Associates | לא מאומת | unverified | טכנית כן | לא מאומת | — | ~1,000 | `misleading` — תיק small-cap מפוזר; רויס עצמו לא בניהול יומיומי |
| 35 | Mario Gabelli | GAMCO Investors | לא מאומת | unverified | טכנית כן | לא מאומת | — | ~800–1,000 | `misleading` — מפוזר מדי; "top holding" ב-1% מהתיק חסר משמעות |
| 36 | John Paulson | Paulson & Co. | לא מאומת | unverified | ⚠️ | לא מאומת | — | לא מאומת | `misleading` — **הפך ל-family office ב-2020**; התיק קטן ומרוכז בזהב/לא-13F |
| 37 | Dan Sundheim | D1 Capital Partners | לא מאומת | unverified | כן | לא מאומת | — | עשרות | **`viable`** — הערה: ~כמחצית מה-AUM בפרטי ובלתי נראה |
| 38 | Leon Black | Apollo Global Management | לא מאומת | unverified | **לא** | — | — | — | `not available` כאדם 🔴 — **בלאק עזב את Apollo ב-2021**. ה-13F של Apollo הוא credit. אין קשר |
| 39 | Chris Hohn | TCI Fund Management | לא מאומת | unverified | כן | לא מאומת | — | ~10–12 | **`viable`** ⭐ מהמרוכזים בעולם |
| 40 | O. Andreas Halvorsen | Viking Global Investors | — | — | — | — | — | — | **DUPLICATE של #19** — למחוק |

### 3.1 Dedupe

`#19 Andreas Halvorsen` ו-`#40 O. Andreas Halvorsen` הם **אותו אדם** — Ole Andreas Halvorsen, מייסד Viking Global Investors. `O.` הוא השם הפרטי הנורווגי. **הרוסטר האפקטיבי הוא 39 ישויות.**

זו גם אזהרה: מכיוון ש-Quiver מזהה לפי string בלבד (§1.1), **אין שום מנגנון שיתפוס כפילות כזו אוטומטית.** צריך unique constraint על `person_slug` בצד שלנו.

### 3.2 Jim Simons — ההחלטה

סימונס נפטר ב-מאי 2024. Renaissance Technologies ממשיכה להגיש 13F כפירמה.

**המלצה: לא לשלב את סימונס כפרופיל אדם.** שלוש סיבות:
1. פרופיל "Jim Simons" עם עסקאות מ-2026 הוא **שקר מפורש** — אדם שנפטר לא קנה NVDA ברבעון האחרון.
2. גם אם נציג "Renaissance Technologies" כישות, ה-13F הוא ~3,000 פוזיציות quant — `misleading` לפי אותו קריטריון של AQR / D.E. Shaw.
3. אם בכל זאת רוצים — **רק כישות תאגידית** (`kind: 'institution'`, לא `'person'`), עם תמונת לוגו ולא דיוקן, וללא שום ניסוח בזמן הווה לגוף ראשון.

אותו כלל חל על **Leon Black** (עזב 2021), **Steve Mandel** (2019), **George Soros** (2023), **Ray Dalio** (2022) — ההבדל היחיד הוא שאלו בחיים. גם עבורם, קישור השם לתיק הנוכחי הוא טענה עובדתית שגויה.

### 3.3 Musk / Ryan Cohen — צינור אחר

| Person | הנתון האמיתי | צינור |
|---|---|---|
| Elon Musk | Form 4 — עסקאות TSLA כ-insider (+ 13D ב-X/Twitter) | `sync-insider-buys` / `/beta/live/insiders` — **agent אחר** |
| Ryan Cohen | Form 4 (יו"ר GME) + 13D/G עבור RC Ventures | Form 4. **13D/G אינו זמין ב-Quiver** — לא מאומת שיש endpoint |

שניהם **לא מגישי 13F** ואין להם `owner` string. אם הם מופיעים בפרופילי 13F — זה מזויף. להעביר ל-scope של Form 4.

### 3.4 ספירה סופית

| Verdict | ספירה | שמות |
|---|---|---|
| **`viable` — core** | **11** | Buffett, Ackman, Tepper, Druckenmiller, Loeb, Coleman, Halvorsen, Peltz, Laffont, Sundheim, Hohn |
| **`viable*` — מותנה ב-disclaimer על short book** | **3** | Icahn, Einhorn, Klarman |
| **`viable` אבל 13F הוא המקור הגרוע** | **1** | Cathie Wood (עדיף daily holdings של ARK) |
| **`misleading`** | **18** | Burry, Griffin, Dalio, Cohen(S), Tudor Jones, Asness, Shaw, Soros, Marks, Fink, Schwarzman, Englander, Mandel, Flatt, Miller, Royce, Gabelli, Paulson |
| **`not available`** | **6** | Musk, Warsh, Ryan Cohen, Simons, Black, Chamath |
| **duplicate** | **1** | O. Andreas Halvorsen |
| **סה"כ** | **40** | ✓ |

**סה"כ ראויים לשילוח: 11 core + 3 מותנים = 14 פרופילי 13F.** בנוסף Wood — נשלחת, אבל דרך daily holdings של ARK ולא דרך 13F. כלומר **15 פרופילים, 14 מהם על בסיס 13F**.

---

## 4. Honesty audit — החלק הקריטי

### 4.1 "Portfolio value" — חצי אמת

`dark_pool_fund_managers.last_value_usd` = סכום `Value` מכל שורות 13F באותה תקופה.

**מה זה באמת:** השווי המדווח של פוזיציות **long בניירות 13F-eligible אמריקאיים בלבד**, נכון ל-**סוף הרבעון**.
**מה זה לא:** לא shorts, לא מזומן, לא אג"ח, לא נכסים בינלאומיים, לא פרטי/VC, ולא נגזרים מלבד חלק מהאופציות.

דוגמאות מהרוסטר שלנו שבהן הפער קיצוני:
- **Berkshire** — $299B ב-13F, אבל לברקשייר יש **~$300B+ מזומן ו-T-bills** ועסקים מוחזקים במלואם (BNSF, GEICO). "השווי" שנציג הוא פחות מחצי מהחברה.
- **Bridgewater** — התיק האמיתי הוא futures/FX/bonds. ה-13F הוא רעש.
- **Oaktree** — התיק הוא חוב. ה-13F כמעט ריק.
- **Tiger Global / D1** — התיק הפרטי גדול מהציבורי.

**פסק דין: ניתן להציג, אבל אסור לקרוא לו "שווי התיק".** מותר רק: *"שווי הפוזיציות המדווחות"* + scope + תקופה. מיקרוקופי בסעיף 4.6.

### 4.2 "Returns / performance / equity curve" — **חייב לרדת. אלה מספרים שקריים.**

זה לא אזהרה תיאורטית. `supabase/functions/uw-fund-profile/index.ts` **כבר מחשב ומחזיר** `total_return_pct` ו-`period_returns` (`1M`/`3M`/`YTD`/`1Y`/`5Y`/`ALL`) מתוך `value_series`, ש-`value_series` הוא **סך שווי ה-13F לפי תקופה**. הרצתי את החשבון על הנתון האמיתי בפרודקשן:

```
total_return_pct = (last_total_value − first_total_value) / first_total_value
```

| Person | first point | last point | מה האפליקציה תציג **היום** | המציאות |
|---|---|---|---|---|
| Warren Buffett | 2022-09-30 → $879,494,064,926 | 2026-06-30 → $299,280,002,205 | **−65.97%** | ברקשייר עלתה בתקופה. המספר הפוך בסימן |
| Cathie Wood | 2024-12-31 → $421,545,603 | 2026-06-30 → $15,420,490,909 | **+3,557.8%** | ARK לא עשתה ×36 |
| Bill Ackman | 2022-03-31 → $9,100,350,094 | 2026-03-31 → $13,625,112,704 | **+49.7%** | קרוב יותר, אבל עדיין לא תשואה |

**למה זה קורה — שתי תקלות שאומתו:**

**(א) נקודת הפתיחה של באפט מנופחת ×3.** השורה `1067983 / 2022-09-30 / AAPL` מכילה `shares = 2,684,406,957`, בדיוק **×3** מ-894,802,319 שברקשייר דיווחה ל-SEC. `implied_price = 138.20` (נכון), ולכן `value_usd = $370,985,041,457` — עבור AAPL לבד. סך התקופה: **$879B** מול ~$296B בפועל. כל שאר 15 התקופות של AAPL תואמות ל-SEC בדיוק. **רק התקופה הראשונה בחלון שבורה — וזו בדיוק הנקודה שממנה `ALL return` נמדד.** (שורש התקלה: **לא מאומת**.)

**(ב) נקודת הפתיחה של ARK חתוכה.** `1697748 / 2024-12-31` מכיל **20 שורות בלבד** (`CYBR` עד `NVMI` — חתך אלפביתי) בשווי $421M, מול 173–192 שורות ו-$12–18B בכל תקופה אחרת. הסיבה: ההיסטוריה נבנית מ-`sec13fchanges` עם `maxRows: 1200`, ו-ARK מייצרת ~195 שורות לרבעון × 17 רבעונים ≫ 1200. התקופה העתיקה ביותר נחתכת באמצע — **וזו הנקודה שממנה מודדים תשואה.**

**(ג) `1M` תמיד 0%.** `buildPeriodReturns` מחפש `series.find(p => p.date >= last.date − 30d)`. בסדרה רבעונית זו תמיד **הנקודה האחרונה עצמה** → `(last − last)/last = 0`. תג "1M: 0.0%" יוצג לכל קרן, לנצח.

**(ד) `return_pct` לכל אחזקה מעוגן לגבול שרירותי.** הקוד מחשב `(current_price − price_at_first_added_date) / price_at_first_added_date`, כאשר `first_added_date` = **התאריך הראשון שבו הטיקר מופיע בחלון ה-16 רבעונים שלנו** — לא התאריך שבו הקרן קנתה. באפט קנה AAPL ב-2016; `first_added_date` אצלנו הוא `2022-09-30`. "התשואה של באפט על אפל" שנציג היא תשואת AAPL מ-2022, מיוחסת לו.

**מה תשואה מ-13F *יכולה* למדוד בכלל?**
רק דבר אחד לגיטימי: **תשואת סל היפותטי** — "אם היית קונה את אותן פוזיציות במחירי סוף הרבעון ומחזיק עד היום". זה מדיד, ניתן להגנה, ו**זו לא התשואה של האדם** — כי אין בו shorts, אין מזומן, אין את התזמון האמיתי בתוך הרבעון, ואין את 55% מהתיק שלא מדווח.

**המלצה:**
1. **להסיר `total_return_pct` ו-`period_returns` מפרופילי 13F.** לא לתקן — להסיר. אין דרך לחשב אותם נכון ממקור רבעוני.
2. גרף: לא equity curve של "תשואה", אלא **גרף עמודות של שווי הפוזיציות המדווחות לפי רבעון** — עם נקודות בדידות (אחת לרבעון), בלי אינטרפולציה, ועם התקופה כתווית על כל עמודה. אם רוצים מגמה — זו מגמת *גודל התיק המדווח*, לא תשואה.
3. אם בכל זאת נדרש מספר ביצועים — רק `hypothetical_basket_return_pct` עם תווית מפורשת. ראה מיקרוקופי §4.6.

### 4.3 "Recent trades" — אלה לא עסקאות

`sec13fchanges` מחזיר `Change`, `Change_Share`, `Change_Pct` — **דלתא בין שני snapshots רבעוניים**. זו לא עסקה:

- קרן שקנתה ומכרה בתוך הרבעון → `Change = 0`. **בלתי נראה לחלוטין.**
- אין timestamp. אין מחיר ביצוע. `Close` הוא מחיר סוף רבעון, לא מחיר הקנייה.
- עד שזה מתפרסם — הפוזיציה בת **45–134 ימים**. באפט יכול היה למכור את הכל ב-1 ביולי ואנחנו נציג אותה כ"מוחזקת" עד 14 בנובמבר.
- ה-`action` (`increase`/`decrease`) מיוצר **אצלנו** מסימן `Change`, לא מגיע מהספק.

**פסק דין: אסור להציג את זה בפיד עסקאות משותף עם Form 4 או congress trades.** Form 4 מגיע תוך יומיים עם תאריך ומחיר; congress תוך 45 יום עם תאריך. 13F הוא **לא עסקה** ואין לו תאריך.

**המלצה:** להציג כ-**"שינויי פוזיציה"** בכרטיס נפרד עם צורה ויזואלית שונה, ותמיד ברמת רבעון: *"בין 31/03/2026 ל-30/06/2026 הפוזיציה גדלה ב-12%"*. לעולם לא "קנה" ולא "לפני יומיים".

### 4.4 "Win rate" — לא ניתן לחשב. לא בקירוב.

Win rate מחייב זוגות entry/exit עם מחירים. מ-13F אין:
- אין מחיר entry (רק שווי סוף רבעון)
- אין תאריך entry (רק "הופיע בין שני snapshots")
- אין exit — פוזיציה שנעלמה יכולה להיות מכירה, או ירידה מתחת לרף הדיווח, או העברה לחשבון אחר
- round-trips תוך-רבעוניים לא קיימים בנתון

**פסק דין: `win_rate` אסור לפרופילי 13F. אין גרסה מוחלשת שהיא כן נכונה.** (זה בניגוד ל-Form 4, שבו יש תאריך ומחיר ולכן יש בסיס.)

### 4.5 "Average delay" — מדיד, אבל לא מעניין; והמדד הנכון הוא אחר

`Date − ReportPeriod` מדיד וקיים בנתון. ל-3 הקרנות שאומתו: `2026-08-14 − 2026-06-30 = 45 יום` — **בדיוק המועד החוקי, לכל השלוש.** כל מגיש 13F מגיש ביום האחרון. המדד הזה **קבוע ל-45 עבור כולם** ולכן לא מבדיל בין קרנות ולא שווה pixel ב-UI.

**המדד שכן חשוב וצריך להיות מוצג בכל פרופיל:**

```
data_age_days = today − report_period_end
```

זה מה שמעניין את המשתמש. היום: **79** (או **170** לאקמן, בגלל הבאג ב-§2.3).

### 4.6 מיקרוקופי בעברית — ניסוחים קונקרטיים

**Badge ראשי (תמיד גלוי, מעל התיק):**

```
נתוני 13F · נכון ל-30/06/2026 · פורסם 14/08/2026 · בן 79 ימים
```

**תווית scope (מתחת לשווי):**

```
פוזיציות long בניירות אמריקאיים בלבד, כפי שדווחו ל-SEC.
לא כולל שורט, מזומן, אג"ח, נכסים בחו"ל והשקעות פרטיות.
```

**החלפת "שווי התיק":**

| ❌ אסור | ✅ מותר |
|---|---|
| שווי התיק | שווי הפוזיציות המדווחות |
| התיק של וורן באפט | הפוזיציות המדווחות של Berkshire Hathaway |
| תשואה · +12% | — (להסיר) |
| עסקאות אחרונות | שינויי פוזיציה ברבעון |
| קנה NVDA | הגדילה את הפוזיציה ב-NVDA |
| לפני 3 ימים | ברבעון שהסתיים 30/06/2026 |
| אחוז הצלחה | — (להסיר) |

**Tooltip מלא (בלחיצה על ה-badge):**

```
מה זה 13F?

מנהלי השקעות אמריקאים גדולים מחויבים לדווח ל-SEC על הפוזיציות
שלהם פעם ברבעון, עד 45 יום מסוף הרבעון.

הדיווח כולל רק פוזיציות long בניירות אמריקאיים — ולא שורט,
מזומן, אג"ח, נכסים בחו"ל או השקעות פרטיות.

הדיווח הוא ברמת המוסד, לא ברמת האדם.

הנתון שמוצג כאן נכון ל-30/06/2026 והתפרסם ב-14/08/2026.
הנתון הבא יתפרסם עד 14/11/2026.
```

**Disclaimer לקרנות עם short book (Icahn / Einhorn / Klarman / Burry):**

```
לקרן זו פוזיציות שורט משמעותיות שאינן מדווחות ב-13F.
התמונה המוצגת חלקית.
```

**Disclaimer ל-`misleading` אם בכל זאת משלבים (Citadel / Millennium / Point72 / AQR / D.E. Shaw):**

```
הדיווח של <מוסד> כולל אלפי פוזיציות הנובעות מעשיית שוק
וגיבוי פוזיציות. הוא אינו משקף בחירות השקעה של <שם האדם>.
```

**Disclaimer לניתוק person→institution (Dalio / Soros / Mandel / Black / Miller / Royce):**

```
<שם> אינו מנהל את ההשקעות של <מוסד> כיום.
הנתונים הם של המוסד.
```

**באנר "אין עדכון" (58 הימים הבאים):**

```
אין נתון חדש. הדיווח הבא של הרבעון המסתיים 30/09/2026
יתפרסם עד 14/11/2026.
```

### 4.7 סיכום ההגינות

| מושג UI | ניתן להגנה? | הערה |
|---|---|---|
| Holdings list | ✅ כן | הנתון החזק היחיד. עם תקופה + scope |
| Allocation % | ✅ כן | מחושב אצלנו נכון (`value/total`); Quiver לא מספק `Weight` |
| Reported positions value | ⚠️ עם תווית | לא "שווי תיק" |
| Position changes (רבעוני) | ⚠️ עם תווית | לא "עסקאות". חייב הצמדה לרבעון |
| Value-per-quarter bars | ⚠️ עם תווית | נקודות בדידות, לא קו. **חייב תיקון §4.2(א)(ב) קודם** |
| Returns / equity curve | 🔴 **לא** | להסיר. מספרים שקריים מאומתים |
| Win rate | 🔴 **לא** | בלתי ניתן לחישוב |
| Average delay | 🔴 לא שימושי | קבוע 45 לכולם. להחליף ב-`data_age_days` |
| "Recent trades" בפיד מאוחד | 🔴 **לא** | אסור לערבב עם Form 4 / congress |
| Puts כ-long | 🔴 **לא** | `Put/Call` נזרק. קריטי ל-Burry |

---

## 5. Coverage verdict + build notes

### 5.1 מה לשלוח

**14 פרופילי 13F** (11 core + 3 עם disclaimer על short book) + **Wood דרך daily holdings של ARK** (לא 13F).
**25 מה-40 לא נשלחים**: 18 `misleading`, 6 `not available`, 1 duplicate. מתוכם 4 דורשים אימות מול SEC לפני החלטה סופית (Burry, Miller, Paulson, וגם Klarman שכרגע מסומן `viable*`).

**להסיר במפורש מהרוסטר:** Fink (BlackRock ~10,000 מדדים), Schwarzman, Flatt, Marks, Black, Simons, Warsh, Chamath, Musk, Ryan Cohen, O. Andreas Halvorsen.

### 5.2 Sync design

| החלטה | פירוט |
|---|---|
| **Endpoint לאחזקות** | `GET /beta/live/sec13f?owner=<alias>&period=<YYYYMMDD>&page_size=500` |
| 🔴 **תיקון נדרש** | להתחיל לשלוח **`period`**. היום הוא לא נשלח, ולכן כל ריצה מורידה את **כל** ההיסטוריה (705 שורות לברקשייר, 3,200+ ל-ARK) ומשליכה 90% בצד הלקוח |
| **Endpoint לשינויים** | `GET /beta/live/sec13fchanges?owner=<alias>&most_recent=true&page_size=500` |
| 🔴 **להפסיק** לבנות היסטוריה מ-`sec13fchanges` | זה מקור שתי התקלות ב-§4.2. `sec13fchanges` **אין לו `Value` ואין לו `Shares`** — הוא לא endpoint של אחזקות. להשתמש ב-`sec13f` עם `period` לכל רבעון היסטורי |
| **Cadence** | 13F מתפרסם 4 פעמים בשנה. **`0 6 * * *` יומי הוא בזבוז של ~98%** |
| **Cadence מומלץ** | polling יומי **רק בחלונות ההגשה**: 01–20/02, 01–20/05, 01–20/08, 01–20/11. מחוץ להם — פעם בשבוע כ-safety net |
| **גלאי "נתון חדש"** | קריאת `sec13fchanges?most_recent=true` אחת (owner יחיד, `page_size=1`) והשוואת `ReportPeriod` ל-`last_report_period` ב-DB. אם זהה — לדלג על כל ה-sync |
| **Backfill היסטורי** | חד-פעמי: 16 רבעונים × 14 קרנות × `sec13f?period=` |
| **Alias resolution** | ידני, חד-פעמי, ל-14 השמות. אין endpoint חיפוש (`/beta/funds` הוא internal). **חייב alert אם owner מחזיר 0 שורות** — היום זה נכשל בשקט |

### 5.3 API cost

| תרחיש | requests |
|---|---|
| Backfill חד-פעמי (14 קרנות × 16 רבעונים, `page_size=500`) | ~230 |
| רענון רבעוני (14 קרנות: 1–2 עמודות `sec13f` + 1 `sec13fchanges`) | ~45 |
| גלאי "נתון חדש" יומי (owner יחיד, `page_size=1`) | 365/שנה |
| **סה"כ שנתי** | **~550** |
| היום (יומי, ללא `period`, כל ההיסטוריה × 3 קרנות) | **~4,400/שנה** — יותר מפי 8, עבור 3 קרנות במקום 14 |

13F הוא **הצינור הזול ביותר** בכל האפליקציה. הוא גם המעופש ביותר. אין קשר בין השניים — polling תכוף לא הופך אותו לטרי.

### 5.4 עמודות DB נדרשות

**🔴 הבעיה הכי חמורה בסכימה הקיימת:**

`dark_pool_fund_holdings.filing_date` **מאכלס בפועל את ה-report period**, לא את תאריך ההגשה. אומת: השורות של ברקשייר מתויגות `2026-06-30`, בעוד ש-`Date` מ-Quiver הוא `2026-08-14`. **אין בסכימה עמודה שמחזיקה את תאריך ההגשה בכלל.** לכן המיקרוקופי של §4.6 — *"נכון ל-30/06, פורסם 14/08"* — **בלתי אפשרי כרגע**. זה חוסם את כל האודיט.

**`dark_pool_fund_holdings` — הוספות:**

| עמודה | טיפוס | מקור Quiver | למה |
|---|---|---|---|
| `report_period` | `date NOT NULL` | `ReportPeriod` | סוף הרבעון. **המזהה הנכון** ל-snapshot |
| `filing_date` | `date` | `Date` | תאריך ההגשה בפועל. **להפריד מהקיים** |
| `sh_prn` | `text` | `SH/PRN` | מניה מול principal על חוב |
| `put_call` | `text` | `Put/Call` | 🔴 קריטי — בלי זה ה-puts של Burry מוצגים כ-long |
| `class` | `text` | `Class` | תיאור הנייר |
| `direction` | `text` | `Direction` | investment discretion |
| `value_source` | `text` | — | `'quiver_value'` מול `'derived_held_x_close'`. חובה כדי לא לערבב שוב |

**Unique key חדש:** `(fund_cik, report_period, ticker, cusip, put_call)` — הקיים `(fund_cik, filing_date, ticker)` מאבד שורות כשיש גם stock וגם put על אותו טיקר.

**`dark_pool_fund_changes` — טבלה חדשה (לא קיימת):**

| עמודה | טיפוס | מקור |
|---|---|---|
| `fund_cik` | `text` | שלנו |
| `report_period` | `date` | `ReportPeriod` |
| `filing_date` | `date` | `Date` |
| `ticker` | `text` | `Ticker` |
| `change_shares` | `numeric` | `Change_Share` / `Change` |
| `change_pct` | `numeric` | `Change_Pct` |
| `held_shares` | `numeric` | `Held` |
| `held_normalized` | `numeric` | `Held_Normalized` |
| `close_at_period` | `numeric` | `Close` |

היום `upsertChangesAsHoldings()` דוחס שינויים ל-`dark_pool_fund_holdings` — וזה מה שמזהם את ההיסטוריה (§4.2). **הפרדה מלאה נדרשת.**

**`dark_pool_fund_managers` — הוספות:**

| עמודה | טיפוס | למה |
|---|---|---|
| `last_report_period` | `date` | להפריד מ-`last_filing_date` |
| `last_filing_date` | `date` | קיים — לתקן שיחזיק את `Date` האמיתי |
| `data_age_days` | `integer` generated | `today − last_report_period`. מה שה-UI מציג |
| `quiver_owner_aliases` | `text[]` | להוציא את ה-alias list מהקוד ל-DB |
| `person_slug` | `text UNIQUE` | מונע את הכפילות של Halvorsen |
| `is_person_active_manager` | `boolean` | `false` ל-Dalio / Soros / Mandel / Black. מפעיל disclaimer |
| `scope_note` | `text` | `'has_significant_short_book'` וכו' |
| `viability` | `text` | `viable` / `misleading` / `not_available` — לחסום רינדור |

### 5.5 חסימות לפני שילוח (בסדר עדיפות)

| # | חסימה | סעיף |
|---|---|---|
| 1 | להסיר `total_return_pct` + `period_returns` מ-`uw-fund-profile` | §4.2 |
| 2 | להפסיק לבנות היסטוריה מ-`sec13fchanges` — לעבור ל-`sec13f?period=` | §4.2(א)(ב), §5.2 |
| 3 | להפריד `report_period` מ-`filing_date` בסכימה | §5.4 |
| 4 | לתקן את הבאג שבו Pershing תקוע ב-Q1 2026 (170 ימים) | §2.3 |
| 5 | לשמור `Put/Call` — אחרת Burry שקרי | §4.7 |
| 6 | להסיר את `first_added_date` כבסיס לתשואת אחזקה | §4.2(ד) |
| 7 | badge התיישנות חובה בכל פרופיל 13F | §4.6 |
| 8 | alert כש-`owner` מחזיר 0 שורות (היום נכשל בשקט) | §5.2 |
| 9 | לברר מול SEC: Burry/Scion, Klarman/Baupost, Miller, Paulson | §3 |

---

## 6. מה נשאר לא מאומת

| פריט | סטטוס |
|---|---|
| `owner` string מדויק ל-36 מ-39 הקרנות | **לא מאומת** — אין credential ואין נתיב קוד ל-owner שרירותי |
| מספר אחזקות / תקופה / staleness ל-36 הקרנות | **לא מאומת** |
| סמנטיקת ההתאמה של `owner` (exact/fuzzy/case) | **לא מאומת** — הדוקס שותקים |
| נגישות `/beta/funds` ב-plan Trader | **לא מאומת** — `x-internal: true` |
| מה `mobile=true` מחזיר ב-`sec13fchanges` | **לא מאומת** — `SEC13FChangesEntryMobile` קיים כ-ref, תוכנו לא נבדק |
| שורש התקלה של ×3 בשורת AAPL 2022-09-30 | **לא מאומת** — הסימפטום אומת במדויק |
| האם Scion (Burry) עוד מגישה 13F | **לא מאומת** — דורש בדיקה מול EDGAR |
| האם ל-Social Capital (Chamath) יש 13F משמעותי | **לא מאומת** |
| קיום endpoint ל-13D/13G ב-Quiver (ל-Ryan Cohen) | **לא מאומת** — לא נמצא ב-schema |
