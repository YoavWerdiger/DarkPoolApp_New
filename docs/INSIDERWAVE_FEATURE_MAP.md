# InsiderWave — מפת פיצ'רים ↔ חוזה נתונים

> **מטרה:** data-first. לכל פיצ'ר שראינו אצל InsiderWave — מה בדיוק צריך כדי להציג אותו, מה כבר יש לנו, ומה מהמספרים שלהם **לא יכול להיות נכון** על נתוני STOCK Act.
>
> **תאריך:** 2026-09-17 · **מקורות:** צילומי מסך של InsiderWave + [`QUIVER_API_AUDIT.md`](./QUIVER_API_AUDIT.md) §4/§7 + הריפו.
>
> כל מקום שבו לא הצלחנו לאמת מסומן **לא מאומת**.

---

## 0. TL;DR

1. **`ExcessReturn` / `PriceChange` / `SPYChange` כבר חוזרים בכל קריאת קונגרס שאנחנו עושים ונזרקים** (QUIVER_API_AUDIT §4.1). זה הנכס הכי גדול בדוח הזה — הוא פותר לבד את B, C, ואת החלופה הישרה ל-I.
2. **אין מסך trade-detail בכלל.** אין קובץ ב-`screens/DarkPool/` ואין route ב-`navigation/DarkPoolStack.tsx` (רק `DarkPoolHome`/`DarkPoolPeople`/`DarkPoolTicker`/`DarkPoolInvestor`). כלומר C, D, E, F, G — כולם חסרי משטח תצוגה, לא רק חסרי נתון.
3. **"disclosed 22h ago · traded 4w ago" הוא win חינם** — `filed_at` ו-`transaction_date` כבר שניהם בטבלה; אנחנו פשוט מציגים רק אחד (`CongressTradeCard` מעביר `filedAt` בלבד).
4. **המספרים הכותרתיים של InsiderWave אינם ניתנים לחישוב מדיווחי STOCK Act.** פירוט מלא ב-§3. בקצרה: כל מה שמוצג ב-cent-precision הוא פברוק תצוגתי.
5. **פיצ'ר E (טבלת אופציות: contracts / strike / entry-per-contract) איננו ניתן למילוי ישר.** ה-PTR לא מדווח מספר חוזים ולא פרמיה. יתרה מזו — המספרים בצילום שלהם סותרים את עצמם (§3.7).

---

## 1. חוזה נתונים לכל פיצ'ר (A–M)

סיווג קלט: **(a)** גילוי גולמי מ-Quiver · **(b)** נתוני מחיר שוק · **(c)** אנליטיקה נגזרת שאנחנו מחשבים · **(d)** נתוני מוצר/סושיאל שהם שלנו בלבד.

### A. Explore — חיפוש + "Most Followed" + "Top Performers"

| קלט | סיווג | מקור | Cadence |
|---|---|---|---|
| `Name`, `BioGuideID`, `Party`, `State`, `Chamber` | a | `bulk/congress/politicians` | יומי |
| `ImageURL` | a | אותו endpoint — **כבר ב-cache, נזרק** (§7.2) | יומי |
| `TradeCount`, `TradeVolume`, `NetWorth` | a | אותו endpoint (`volume_method`) | יומי |
| `follower_count`, `copied_usd_total` | d | טבלת follows שלנו | realtime |
| דירוג תשואה לפי תקופה (1D…ALL) | c | ראה §3.4 — **לא לחשב כתשואת תיק** | יומי |

**לוגיקת נגזרת:** "Top Performers" צריך להיות דירוג **יחסי** (percentile) ולא מספר אבסולוטי. הדירוג הישר היחיד: חציון `ExcessReturn` על עסקאות בחלון התקופה.
**מצב נוכחי: חלקי** — `DarkPoolExploreScreen.tsx` + `ExplorePeopleGrid`/`ExploreTrendingSection` קיימים; חיפוש לפי party/state לא אפשרי כי `Party`/`State` נזרקים (§7.2), ואין בורר תקופה.

### B. Signals/Feed — Following vs All, "Latest trades"

| קלט | סיווג | מקור | Cadence |
|---|---|---|---|
| `Representative`, `Ticker`, `Transaction`, `Range` | a | `live/congresstrading` | ~20 דק' |
| `TransactionDate` (traded) **ו-**`ReportDate` (disclosed) | a | אותו endpoint — שניהם כבר אצלנו | ~20 דק' |
| מחיר מניה חי | b | Finnhub quotes (כבר בשימוש) | on-screen |
| "Stock since trade %" | a **או** c | `PriceChange` מ-Quiver (עדיף) **או** `calcSinceTradePct(trade.price, quote.price)` שלנו | ~20 דק' |
| `follow_edges` לטאב Following | d | `darkPoolFollowService` | realtime |
| מיון ("Recent"/"Biggest"/"Best performing") | c | על `disclosed_at` / `amount_high_usd` / `excess_return_pct` | client |

**מצב נוכחי: חלקי** — `DarkPoolFeedScreen.tsx` (`tab: 'all'`, `hideFollowing`) + `congressFeedCalc.buildCongressFeedItem` כבר מחשב `sinceTradePct`. חסר: תאריך כפול, בורר מיון, כרטיס טיקר משובץ עם מחיר חי.

### C. Trade detail — כותרת

| קלט | סיווג | הערה |
|---|---|---|
| verb + ticker + `Range` | a | ✅ יש |
| `traded_at`, `disclosed_at`, delay | a | ✅ יש, לא מוצג ביחד |
| תג "Reduce"/"Add"/"New"/"Exit" | c | דורש weight snapshot לפני/אחרי — ראה D |
| מחיר מניה + "Since trade %" | a/b | `PriceChange` חינם |
| `contracts`, `$/contract` | — | ❌ **לא קיים בדיווח** — §3.7 |

**מצב נוכחי: חסר** — אין מסך ואין route.

### D. "Why this matters" — משפט אחד

| קלט | סיווג | הערה |
|---|---|---|
| `allocation_pct` לפני העסקה | c | דורש snapshot היסטורי של משקלים |
| `allocation_pct` אחרי | a/c | `CurrentHolding`+`Allocation` מ-`live/congress_stock_holdings` (אמיתי, לפי `bioguide_id`) או שחזור מ-`buildProfileHoldings` |
| סף מהותיות | c | **חובה** — אחרת מקבלים "86.99% → 86.98%" כמו אצלם |

**מצב נוכחי: חסר** — `profilePortfolioEngine.buildProfileHoldings` מחשב `allocation_pct` נוכחי בלבד, בלי היסטוריה.

### E. "Trade details" — טבלת אופציות

| שדה | סיווג | ניתן למילוי ישר? |
|---|---|---|
| Action | a | ✅ |
| Traded date / Reported date | a | ✅ |
| Total value | a | ⚠️ **טווח בלבד** — לא מספר |
| Contracts | — | ❌ לא מדווח |
| Entry / contract | — | ❌ לא מדווח |
| Strike / Expiration | a? | ⚠️ לעיתים בטקסט החופשי של `Description`; `housetrading`/`senatetrading` עם `options=true` הם היחידים שחושפים אופציות (§7.1). **לא מאומת** האם השדות מובנים או שצריך parsing |
| Portfolio weight / Allocation change | c | תלוי D |

**מצב נוכחי: חסר** — ומסקנה: **אין למלא את E כפי שהם מציגים אותו**. ראה §3.7.

### F. "Recent activity" — ציר זמן של אותו משקיע באותו טיקר

| קלט | סיווג | הערה |
|---|---|---|
| כל עסקאות `(bioguide_id, ticker)` | a | קיים ב-`dark_pool_congress_trades`, רק חסר query+UI |
| נקודה צבעונית buy/sell | c | `parseTxnSide` / `getFeedTradeSide` ✅ |
| תג "Current" | c | העסקה האחרונה בטיקר |
| "Now 86.98% · -0.01%" | c | תלוי D — **לא להציג דלתאות מיקרו** |

**מצב נוכחי: חסר** (הנתון קיים, התצוגה לא). `PersonPortfolioProfileScreen` בונה `tradeRows` מ-`recent_trades` אבל לא מפולח לפי טיקר.

### G. "Who else holds WMB"

| קלט | סיווג | מקור |
|---|---|---|
| `ownership[]`, `ownership_options[]` | a | `live/topshareholders/{ticker}` — **זמין בתוכנית שלנו, לא בשימוש** (§7.1) |
| אחזקות פוליטיקאים לפי טיקר | a | `live/congress_stock_holdings?ticker=` |
| % of portfolio + share count | a | מגיע מה-endpoint |

**מצב נוכחי: חסר** — הפער הכי זול-לסגירה מכל הרשימה: endpoint אחד, טאב אחד ב-`DarkPoolTickerScreen`.

### H. Profile hero — שווי תיק, תשואה, עקומה, Follow/Alert/Share

| קלט | סיווג | מקור |
|---|---|---|
| `portfolio_value` | c (מוערך!) | `buildProfilePortfolioMetrics` → `portfolio_value` |
| סדרת שווי יומית | b+c | `buildProfileValueSeries` + Yahoo/Finnhub daily closes |
| `period_returns` 1D…ALL | c | `periodReturnPct` / `twrPeriodReturnPct` ✅ כבר קיים |
| Follow / Alerts | d | `toggleFollowInvestor`, `useFollowedInvestors` ✅ |
| Share | d | חסר · **לא מאומת** אם קיים במסך |

**מצב נוכחי: חלקי** — הכל קיים ב-`PersonPortfolioProfileScreen.tsx` (שורות ~213, ~311, ~502, ~631, ~656, ~683), אבל **התיוג לא ישר** — ראה §3.1.

### I. Stats row — Win Rate / Expectancy / Avg Delay

| מטריקה | סיווג | מצב |
|---|---|---|
| `avg_delay_days` | c מ-a | ✅ `computeAvgDelay` — **המטריקה היחידה מהשלוש שהיא מדויקת** |
| `win_rate` | c | ⚠️ `computeWinRate` סופר רק `sells` — ראה §3.5 |
| `expectancy` | c | ❌ לא קיים, ולא בר-חישוב ישר — §3.6 |

**מצב נוכחי: חלקי**.

### J. "Recent trades" מקובץ לפי תאריך + "1 new trade"

| קלט | סיווג |
|---|---|
| `recent_trades` ממויין | a ✅ |
| לוגו טיקר | b/סטטי — `TickerLogo` ✅ |
| "1 new" = מאז `last_seen_at` של המשתמש | d — חסר |

**מצב נוכחי: חלקי** — `tradeRows` קיים (`PersonPortfolioProfileScreen` ~493), בלי קיבוץ ובלי read-state.

### K. "Current Holdings"

| קלט | סיווג | מקור |
|---|---|---|
| `ticker`, `market_value`, `allocation_pct`, `return_pct` | c | `buildProfileHoldings` ✅ |
| מקור אמיתי חלופי | a | `CurrentHolding` + `Allocation` מ-Quiver, **היום נמשך רק ל-17 פרופילים מאוצרים** (§7.3) |
| `basis_reliable` / `qty_disclosed` | c | ✅ כבר יש דגלי כנות במנוע! |

**מצב נוכחי: קיים** (עם הסתייגות §3.2). זה החלק הכי בריא בקוד שלנו — `profilePortfolioEngine` כבר מאפס `return_pct` כשאין basis אמין.

### L. "If you invested $520 since Jan 2, 2011 you'd have $5,164.02"

| קלט | סיווג |
|---|---|
| כל היסטוריית העסקאות | a |
| מחירי סגירה יומיים היסטוריים | b |
| מודל ביצוע (מתי "קונים"?) | c |

**מצב נוכחי: חסר** — וזה backtest, לא נתון. §3.8.

### M. "About this investor" + Collapsibles

| קלט | סיווג | מקור |
|---|---|---|
| ביו | a חיצוני | לא ב-Quiver · Congress.gov API / ויקיפדיה · **לא מאומת** |
| Committees (4) | a חיצוני | Congress.gov · אין ב-Quiver |
| "Where do these trades come from?" | סטטי | ✅ `QuiverAttribution.tsx` קיים |
| "How do we track this portfolio?" | סטטי | **חובה אצלנו** — זה הדף שמכשיר את כל ה-estimates |
| Disclosures | סטטי | חסר |

**מצב נוכחי: חלקי**.

---

## 2. טבלת מצב מסכמת

| # | פיצ'ר | מצב | הצדקה מהקוד |
|---|---|---|---|
| A | Explore + Top Performers | חלקי | `DarkPoolExploreScreen.tsx` יש; `Party`/`State` נזרקים (§7.2); אין period selector |
| B | Feed + since-trade | חלקי | `congressFeedCalc.ts:19` מחשב `sinceTradePct`; `CongressTradeCard` מעביר `filedAt` בלבד |
| C | Trade detail header | **חסר** | אין קובץ ב-`screens/DarkPool/`, אין route ב-`DarkPoolStack.tsx` |
| D | Why this matters | **חסר** | `buildProfileHoldings` מחזיר `allocation_pct` נוכחי בלבד |
| E | טבלת פרטי עסקה (אופציות) | **חסר + בעייתי** | ראה §3.7 |
| F | Recent activity בטיקר | **חסר** | `recent_trades` לא מפולח לפי ticker |
| G | Who else holds | **חסר** | `live/topshareholders/{ticker}` לא בשימוש (§7.1) |
| H | Profile hero | חלקי | `PersonPortfolioProfileScreen.tsx` ~502/~683 — קיים, לא מתויג נכון |
| I | Win/Expectancy/Delay | חלקי | `congressPortfolio.ts:597,623` — win_rate+delay יש, expectancy אין |
| J | Recent trades grouped | חלקי | `PersonPortfolioProfileScreen.tsx:493` |
| K | Current Holdings | קיים | `profilePortfolioEngine.ts:336-398` |
| L | "$520 → $5,164" | **חסר** | אין backtest engine |
| M | About/Committees | חלקי | `QuiverAttribution.tsx` בלבד |

---

## 3. ביקורת כנות — המספרים שאסור להעתיק

**עובדת היסוד:** דיווח PTR לפי STOCK Act מכיל: נכס, סוג עסקה, תאריך עסקה, תאריך דיווח, ו**טווח סכום** מתוך 11 מדרגות (`$1,001–$15,000` … `מעל $50,000,000`). הוא **אינו** מכיל מספר מניות, מחיר למניה, או שווי מדויק. Quiver עצמה מתעדת את `Amount` כ־*"Lower bound of transaction size"* (§4.1).

### 3.1 "Portfolio Value $206,053,131.12"

| | |
|---|---|
| **כדי לחשב ביושר צריך** | שווי מדויק של כל פוזיציה = מספר מניות × מחיר. מספר המניות לא מדווח. |
| **מה InsiderWave כנראה עושה** | לוקחים mid-point של הטווח (בדיוק כמו `STOCK_ACT_FLOOR_MID` שלנו), מחלקים במחיר ליום העסקה, מקבלים כמות רציונלית, מכפילים במחיר נוכחי — ומדפיסים את התוצאה עם 2 ספרות אחרי הנקודה. **הסנטים הם רעש מתמטי מטווח ברוחב $35,000.** |
| **מה אנחנו נציג** | טווח או bucket, אף פעם לא סנטים. `portfolio_value` נשאר פנימי; בתצוגה — `portfolio_value_low`/`high` מסכום ה-floors וה-caps של הטווחים. |
| **מיקרוקופי** | `שווי מוערך: $150M–$260M` · מתחת: `לפי טווחי הדיווח של STOCK Act — לא שווי בפועל` |

> טיפ ליישום: `MAX_DISPLAYABLE_PERIOD_RETURN_PCT` ו-`chart_reliable` ב-`profilePortfolioEngine.ts` מראים שכבר יש אצלנו תרבות של "לא להציג כשלא יודעים". להרחיב אותה גם ל-`portfolio_value`.

### 3.2 שווי $ לפוזיציה בודדת ("WMB $165,691,402.37 · 86.98%")

| | |
|---|---|
| **כדי לחשב ביושר** | כמות מניות מצטברת מדויקת. לא קיימת. |
| **מה הם עושים** | שחזור avg-cost מטווחים — בדיוק `replayProfilePositions`. ריכוזיות של **86.98% במניה אחת** היא ה-tell: זה לא תיק אמיתי, זה סכום העסקאות המדווחות בלבד. אדם עם $206M לא מחזיק 87% במניה אחת; פשוט רק WMB דווח. |
| **מה נציג** | `Allocation` + `CurrentHolding` מ-`live/congress_stock_holdings` (Quiver מגדירה אותם "Estimated" בעצמה — כלומר ניתן לשיוך). כשאין — משקל יחסי בלבד, מעוגל לאחוז שלם, בלי $. |
| **מיקרוקופי** | `86% מהעסקאות המדווחות` (לא "מהתיק") · `מוצגות רק אחזקות שדווחו — ייתכנו אחזקות נוספות` |

### 3.3 "+$109,673,360.30 ▲ 893.08%"

| | |
|---|---|
| **כדי לחשב ביושר** | cost basis אמיתי. עם טווחים, ה-basis יכול לזוז פי 15 בתוך מדרגה אחת (`$1,001`↔`$15,000`). |
| **מה הם עושים** | `(שווי נוכחי − סכום mid-points) / סכום mid-points`. כשה-mid נמוך והמניה עלתה — מקבלים 893%. **המספר רגיש יותר לבחירת ה-mid מאשר לביצועי המשקיע.** |
| **מה נציג** | להחליף לגמרי ב-`ExcessReturn` ברמת עסקה (מגיע מ-Quiver, בחינם, כבר בתשובות שלנו) ולהציג בפרופיל את **החציון**, לא צבירה. |
| **מיקרוקופי** | `חציון עודף תשואה מול S&P 500: +4.1%` · `מקור: Quiver · מחושב מיום העסקה` |

### 3.4 בורר תקופות "ALL +3,051.84%"

`periodReturnPct`/`twrPeriodReturnPct` שלנו כבר עושים TWR עם `external_flow` — טכנית יותר נכון ממה שנראה אצלם. אבל הקלט זהה (שחזור מטווחים), ולכן `sanitizePeriodReturnPct` עם תקרה של 250% הוא **החלטה נכונה שיש לשמר**. אצלם 3,051% פשוט אומר שאין תקרה.
**מיקרוקופי:** `תשואה מוערכת · מבוססת עסקאות מדווחות בלבד`.

### 3.5 "Win Rate 68.8%"

| | |
|---|---|
| **כדי לחשב ביושר** | זיווג round-trip: קנייה ↔ מכירה עם basis. מכירות חלקיות בטווחים הופכות זאת לבלתי-ניתן לזיווג. |
| **מה הם עושים** | **לא מאומת.** ההשערה הסבירה: לכל עסקה בודקים אם המניה עלתה מאז — כלומר זה לא win rate אלא "אחוז עסקאות שהמניה עלתה אחריהן", שאין בו הבחנה בין קנייה למכירה ולא מנוכה מהשוק. |
| **הבאג אצלנו** | `computeWinRate` (`congressPortfolio.ts:597`) מסתמך רק על `sells` — פוליטיקאי שקונה ולא מוכר מקבל `null`, ופוליטיקאי עם מכירה אחת מוצלחת מקבל 100%. |
| **מה נציג במקום** | **"Beat S&P rate"** — `% מהעסקאות שבהן ExcessReturn > 0`. מוגדר היטב, לא דורש basis, מנוכה benchmark, וניתן לשיוך ל-Quiver. |
| **מיקרוקופי** | `היכה את S&P 500 ב-62% מהעסקאות (41 עסקאות)` · `לפי עודף תשואה מיום העסקה` |

### 3.6 "Expectancy 1.57"

חסר-ממדים ולכן חסר-משמעות (1.57 של מה? R? $?). דורש התפלגות P&L לעסקה — כלומר basis. **המלצה: לא להציג בכלל בשלב 1.** תחליף אם רוצים מספר שלישי: `חציון עודף תשואה ב-90 יום` או `יחס עסקאות מנצחות/מפסידות מול S&P`.

### 3.7 "Avg Delay 29 days" ✅ + פיצ'ר E ❌

**Avg Delay הוא המספר היחיד בצילומים שהוא אמיתי לחלוטין** — `ReportDate − TransactionDate`, שני שדות מדווחים. זו הזדמנות: זה גם הנתון הכי *ייחודי* לקטגוריה וגם הכי כן. להבליט אותו.

**פיצ'ר E — הבעיה:** המסך מציג `1,000 contracts · $20.00/contract · Total value $20k · Strike $75.00`. שים לב לסתירה: חוזה אופציה אמריקאי = 100 מניות, ולכן 1,000 חוזים ב-$20 פרמיה = **$2,000,000**, לא $20k. המספרים שלהם לא מכפילים במכפיל. זו ראיה חזקה ש-`contracts` ו-`$/contract` הם **שדות נגזרים מטווח הסכום**, לא נתונים מדווחים — והנגזרת עצמה שגויה.

בנוסף, הכותרת אומרת **"Bought"** בעוד התג אומר **"Reduce"** ו-D אומר "Reduced from 86.99% to 86.98%" — קנייה שמקטינה משקל. זה artifact של נורמליזציה, לא תובנה.

| | |
|---|---|
| **מה נציג** | Action · תיאור הנכס כפי שדווח (raw) · טווח סכום · תאריך ביצוע · תאריך דיווח · עיכוב. Strike/Expiration **רק** אם נחלצו מ-`Description`, עם תיוג. |
| **מיקרוקופי** | `טווח מדווח: $15,001–$50,000` · `Strike ותאריך פקיעה מתוך תיאור הדיווח` · לעולם לא שורת "מספר חוזים" |

### 3.8 "$520 → $5,164.02 since Jan 2, 2011"

| | |
|---|---|
| **כדי לחשב ביושר** | backtest עם מודל ביצוע מפורש. הקריטי: משקיע אמיתי **לא יכול היה** לקנות ביום העסקה — הדיווח הגיע 29 יום אחרי. backtest שקונה בתאריך העסקה הוא lookahead bias טהור. |
| **מה הם כנראה עושים** | **לא מאומת**, אבל התאריך "Jan 2, 2011" (יום מסחר ראשון) והסכום המוזר "$520" מרמזים על נרמול אחורה מתוצאה. |
| **מה נציג** | או כלום, או סימולציה עם ביצוע **בתאריך הדיווח** — שזו דווקא תובנה מוצרית מצוינת ("כמה נשאר אחרי העיכוב"). |
| **מיקרוקופי** | `סימולציה — לא תשואה בפועל` · `ההדמיה קונה ביום הדיווח לציבור, לא ביום העסקה` |

### 3.9 "$95.6K copied" / "Most Followed"

נתון (d) — שלהם משקף את בסיס המשתמשים שלהם. אצלנו זה יהיה `follow_count` אמיתי או שום דבר. **אסור לייבא מספר כזה כ"חברתי" אם אין מאחוריו משתמשים.**

### 3.10 סיכום פסק-דין

| מספר | העתקה כמו שהוא? | חלופה |
|---|---|---|
| Portfolio Value לסנט | ❌ | טווח + תווית "מוערך" |
| $ לפוזיציה | ❌ | `CurrentHolding` של Quiver, או % בלבד |
| +893.08% / ALL +3,051.84% | ❌ | חציון `ExcessReturn`, עם תקרה |
| Win Rate 68.8% | ❌ | Beat-S&P rate |
| Expectancy 1.57 | ❌ | להשמיט |
| Avg Delay 29 days | ✅ | להבליט |
| Contracts / $-per-contract | ❌ | להשמיט |
| Strike / Expiration | ⚠️ | רק מתוך `Description` + תיוג |
| "Since trade +0.43%" | ✅ | `PriceChange` מ-Quiver |
| Allocation change −0.01% | ❌ | סף מהותיות; מתחת לסף — לא להציג |
| "$520 → $5,164.02" | ❌ | סימולציה בתאריך דיווח, או כלום |

---

## 4. תוספות מינימליות למודל הנתונים

### 4.1 `dark_pool_congress_trades` — עמודות חדשות

| עמודה | טיפוס | מקור | פותח |
|---|---|---|---|
| `traded_at` | `date NOT NULL` | `TransactionDate` | B, C, F |
| `disclosed_at` | `date NOT NULL` | `ReportDate` | B, C |
| `disclosure_delay_days` | `int GENERATED` | `disclosed_at − traded_at` | I |
| `amount_low_usd` / `amount_high_usd` | `numeric` | parsing של `Range` | §3.1, E |
| `excess_return_pct` | `numeric` | `ExcessReturn` — **כבר בתשובה** | B, C, I |
| `price_change_pct` | `numeric` | `PriceChange` — **כבר בתשובה** | B, C |
| `spy_change_pct` | `numeric` | `SPYChange` — **כבר בתשובה** | I |
| `quiver_return_asof` | `timestamptz` | `last_modified` | תיוג טריות |
| `party`, `chamber`, `district`, `state` | `text` | נזרקים היום (§7.2) | A |
| `asset_description_raw` | `text` | `Description` | E |
| `is_option` / `option_type` / `option_strike` / `option_expiry` | `bool`/`text`/`numeric`/`date` | parsing של `Description` | E |
| `option_parse_confidence` | `text` | `exact` \| `parsed` \| `unknown` | E |
| `price_at_trade` / `price_at_disclosure` | `numeric` | סגירה יומית | C, L |

### 4.2 טבלאות חדשות

| טבלה | מפתח | שדות | פותח |
|---|---|---|---|
| `dark_pool_politician_holdings` | `(bioguide_id, ticker, as_of)` | `current_holding_usd`, `allocation_pct`, `source` (`quiver`\|`reconstructed`) | D, K, G |
| `dark_pool_holding_weight_snapshots` | `(subject_id, ticker, as_of)` | `allocation_pct` | **D, F** |
| `dark_pool_investor_stats` | `(subject_id, kind)` | `beat_spy_rate_pct`, `median_excess_return_pct`, `avg_delay_days`, `trade_count`, `sample_confidence`, `computed_at` | I |
| `dark_pool_ticker_holders` | `(ticker, holder_id, as_of)` | `shares`, `value_usd`, `pct_of_portfolio`, `is_options` | **G** |
| `dark_pool_follow_counts` | `(subject_id, kind)` | `follower_count`, `updated_at` | A |
| `dark_pool_user_seen` | `(user_id, subject_id)` | `last_seen_at` | J ("1 new") |

### 4.3 עיקרון תצוגה חוצה-סכימה

כל שדה מוערך נושא `*_estimated: boolean` או `source`. המנוע שלנו כבר עושה זאת (`basis_reliable`, `qty_disclosed`, `chart_reliable`) — להרחיב את הקונבנציה, לא להמציא חדשה.

---

## 5. תוכנית שלבים (ערך ÷ מאמץ)

### שלב 1 — ללא endpoint חדש, ללא feed חדש

| # | משימה | פותח | למה זה זול |
|---|---|---|---|
| 1 | לשמור `ExcessReturn` / `PriceChange` / `SPYChange` | B, C, I | **כבר חוזרים בכל קריאה** — רק מיפוי + 3 עמודות |
| 2 | "דווח לפני 22 שעות · בוצע לפני 4 שבועות" | B, C | שני השדות כבר בטבלה; `CongressTradeCard` מעביר רק `filedAt` |
| 3 | `Party`/`State`/`Chamber`/`District`/`ImageURL`/`TradeVolume` | A | **כבר ב-cache**, רק לא נשמרים |
| 4 | מסך trade-detail + route | C | המשטח החסר שחוסם 5 פיצ'רים |
| 5 | `amount_low/high` במקום mid יחיד | §3.1 | `parseCongressAmount` כבר מזהה את המדרגות |
| 6 | Beat-S&P rate במקום `win_rate` | I | נגזר ישירות מ-(1); מתקן גם את הבאג ב-`computeWinRate` |
| 7 | הסרת סנטים + תיוג "מוערך" בכל מקום | §3 | טקסט + עיגול |
| 8 | סף מהותיות לדלתאות משקל | D | תנאי אחד |
| 9 | F — "Recent activity" בטיקר | F | query על נתון קיים |

### שלב 2 — endpoint אחד או price feed אחד

| # | משימה | עלות |
|---|---|---|
| 10 | `live/topshareholders/{ticker}` → **G** | endpoint אחד + טאב |
| 11 | `live/congress_stock_holdings` לכל הפוליטיקאים (לא רק 17 מאוצרים) → **D, K** אמיתיים | הרחבת `sync-quiver-congress-cache` |
| 12 | `price_at_trade` — סגירה יומית לכל עסקה | price feed אחד, backfill |
| 13 | `live/congress/politicians` — net worth חי | A |
| 14 | `housetrading`/`senatetrading?options=true` — לבדוק מה באמת חוזר | E (חלקי) |
| 15 | weight snapshots → "Why this matters" | D |

### שלב 3 — אנליטיקה כבדה

| # | משימה |
|---|---|
| 16 | עקומת equity לכל התקופות עם רצועת אי-ודאות במקום קו |
| 17 | backtest "copy-trade" עם ביצוע בתאריך **דיווח** (§3.8) |
| 18 | Top Performers כ-percentile עם בורר תקופה |
| 19 | follow graph + "$ copied" אמיתי |
| 20 | Committees / bio ממקור חיצוני (Congress.gov) — **לא מאומת** שיש מקור חינמי יציב |

---

## 6. פערים פתוחים (לא מאומת)

- האם `housetrading`/`senatetrading` עם `options=true` מחזירים strike/expiry מובנים או טקסט חופשי.
- האם `topshareholders` מכסה פוליטיקאים או רק מוסדיים.
- האם קיים מקור חינמי ויציב לוועדות וביו של חברי קונגרס.
- האם קיים כפתור Share ב-`PersonPortfolioProfileScreen` (לא אומת בקריאה ממוקדת).
- מה בדיוק InsiderWave מחשב מאחורי Win Rate ו-Expectancy.
