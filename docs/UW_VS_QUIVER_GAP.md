# Unusual Whales מול Quiver — ניתוח פערים להחלטה

> **סטטוס:** מסמך חקירה בלבד. **לא נגעתי בשום קוד, סכימה, UI או cron.**
> **תאריך:** 2026-09-17 · **שיטה:** 18 קריאות MCP אמיתיות ל-`user-unusual-whales`. אין הסקה משמות כלים.
> **המפתח לא נקרא, לא הודפס ולא נשמר.** כל הקריאות עברו דרך ה-MCP המאומת בסשן.

קשור: [`QUIVER_API_AUDIT.md`](./QUIVER_API_AUDIT.md) · [`ROSTER_EXECUTIVES.md`](./ROSTER_EXECUTIVES.md) · [`ROSTER_WHALES_13F.md`](./ROSTER_WHALES_13F.md) · [`CURATED_ROSTER_PLAN.md`](./CURATED_ROSTER_PLAN.md) · [`INSIDERWAVE_FEATURE_MAP.md`](./INSIDERWAVE_FEATURE_MAP.md) · [`UNUSUAL_WHALES_INTEGRATION.md`](./UNUSUAL_WHALES_INTEGRATION.md)

---

## 0. TL;DR — שמונה מסקנות

1. **🟢 המנוי של UW חי ומשלם.** `get_market_state` החזיר snapshot אופציות לתאריך `2026-09-17` (היום), ו-`get_dark_pool_trades` החזיר prints מ-`20:29:59Z` — **שניות** לפני הקריאה. אין שגיאת auth, אין degradation, אין תשובת trial. ראה §1.
2. **🟢 Dark pool prints: UW מוסיף ערך אמיתי, מכריע.** print בודד, `executed_at` ברזולוציית **שנייה**, NBBO bid/ask ברגע העסקה, `trf_executed_at`, latency של **~1 שנייה**, היסטוריה של **≥6 חודשים** מאומתת. Quiver מציע אגרגט יומי T-1 בלבד. זה לא שיפור — זו קטגוריה אחרת. §2.
3. **🟢 Insiders/בכירים: UW מוסיף ערך אמיתי, מכריע.** שאילתה **לפי אדם** (`owner_name`), **`reporter_cik` יציב**, **`is_10b5_1`**, **`security_title`**, `shares_owned_before`, `natureofownership`, `formtype`. כל ששת הפערים שנקבעו כחסומים ב-`ROSTER_EXECUTIVES.md` — **נפתרים**. §3.
4. **🟡 קונגרס: שקול ל-Quiver, ובציר אחד גרוע ממנו.** אותם טווחי STOCK Act, ואותה הערכת midpoint (`mid_value`). **אין ב-UW אף endpoint של אחזקות קונגרס** → 5 הפוליטיקאים הריקים **לא נפתרים**. ועל Khanna, UW **מאחר ב-4 חודשים** אחרי ה-DB שלנו. §4.
5. **🟢/🟡 13F: UW טוב יותר מבנית, זהה בטריות.** אותו מקור SEC רבעוני, אותו lag של 45 יום (Berkshire Q2 הוגש `2026-08-14` — זהה). אבל UW נותן **`put_call`**, **`security_type`**, **`cik`**, **`people[]`**, **`name_changes[]`**, והפרדה בין `date` (תקופה) ל-`filing_date` — כלומר **בדיוק חמש מהחסימות** של `ROSTER_WHALES_13F.md` §5.5. §5.
6. **🔴 הדגל האדום מצביע על Quiver, לא על UW.** נבדק במפורש: UW מציג ל-Pershing Square תקופה אחרונה `2026-03-31` (Q1) — **תואם EDGAR, אין Q2 2026**. ה-probe של Quiver שתועד ב-`ROSTER_WHALES_13F.md` §2.3 דווקא **כן** החזיר שורות לתקופה `2026-06-30`. §5.3.
7. **🔴 ל-UW יש מספרים מומצאים משלו — ארבעה סוגים.** `avg_price` / `price_first_buy` / `price_change_since_first_buy_perc` ב-13F הם **cost basis מודלי** (13F לא מדווח cost basis בכלל). `stock_price`/`marketcap` בשורות insider הם **מחיר של היום**, לא של יום העסקה. §7.
8. **ההמלצה: היברידי ממוקד.** UW עבור **dark pool prints + Form 4** בלבד. Quiver נשאר המקור לקונגרס. 13F — לשקול העברה ל-UW בגלל `put_call`. ~$225/חודש בשתי התוכניות. §8.

---

## 1. האם המנוי חי — הראיה

זו הייתה השאלה הראשונה, כי אם התשובה שלילית כל השאר מיותר. **התשובה: חי לחלוטין.**

| בדיקה | קריאה | תוצאה | פסק דין |
|---|---|---|---|
| Auth + טריות | `get_market_state` | `{"date":"2026-09-17","call_volume":38007655,"put_volume":31751535,"put_call_ratio":"0.835..."}` | ✅ נתון של **היום** |
| Dark pool real-time | `get_dark_pool_trades(NVDA)` | print אחרון `executed_at = 2026-09-17T20:29:59Z` | ✅ **שניות** לפני הקריאה |
| Form 4 | `get_insider_transactions` | שורות מלאות ל-4 בכירים | ✅ |
| 13F | `get_institution_holdings` | Berkshire Q2 2026, 50 רבעונים היסטוריה | ✅ |
| קונגרס | `get_recent_congress_trades` | `filed_at_date` עד `2026-09-15` | ✅ יומיים לפני הקריאה |
| Short interest | `get_short_data_by_ticker(NVDA)` | 147KB payload | ✅ |

**אין שום סימן ל-degradation.** לא `403`, לא payload חסר, לא חלון trial. הנתון היחיד שמחזיר «ריק» באופן לגיטימי הוא `get_institutions(name="SCION")` — וזו **התאמת prefix ולא substring**, כי `"Scion Asset Management, LLC"` המלא **כן** עבד ב-`get_institution_holdings`. זו מגבלת חיפוש, לא מגבלת מנוי.

> ⚠️ **מה שלא נבדק:** מכסת ה-API שנותרה, תאריך חידוש המנוי, ומה קורה אחרי N קריאות. `UNUSUAL_WHALES_INTEGRATION.md` §6 מפנה ל-usage dashboard — **לא נבדק בסבב הזה.** 18 קריאות עברו רצוף ללא throttling.

---

## 2. Dark pool prints — **UW מוסיף ערך אמיתי**

זה השם של האפליקציה, וזה האזור החלש ביותר של Quiver. מסתבר שזה גם הפער הגדול ביותר.

### 2.1 מה Quiver נותן מול מה ש-UW נותן

| ממד | Quiver `/beta/live/offexchange` | UW `get_dark_pool_trades` |
|---|---|---|
| גרנולריות | **אגרגט יומי לטיקר** | **print בודד** |
| רזולוציית זמן | תאריך (`Date`) | **שנייה** (`executed_at`) |
| Latency | «yesterday's activity» = **T-1** | **~1 שנייה** (מאומת) |
| שדות | `OTC_Short`, `OTC_Total`, `DPI` (4 שדות) | **20 שדות** |
| היסטוריה | 60 שורות/טיקר בקוד שלנו | **≥6 חודשים** מאומת |
| NBBO בזמן העסקה | ❌ | ✅ `nbbo_bid` / `nbbo_ask` + quantities |
| ביטולים | ❌ | ✅ `canceled` |
| סוג עסקה | ❌ | ✅ `trade_code`, `sale_cond_codes`, `ext_hour_sold_codes` |

### 2.2 שורה אמיתית מלאה (NVDA, 2026-09-17)

```json
{
  "ticker": "NVDA", "size": 1900, "price": "218.9", "premium": "415910.0",
  "executed_at": "2026-09-17T20:29:21Z", "trf_executed_at": "2026-09-17T20:29:21Z",
  "created_at": "2026-09-17T20:29:22Z",
  "nbbo_bid": "218.9", "nbbo_ask": "218.98",
  "nbbo_bid_quantity": 1026, "nbbo_ask_quantity": 1,
  "market_center": "L", "canceled": false, "trade_settlement": "regular",
  "ext_hour_sold_codes": "extended_hours_trade", "sale_cond_codes": null,
  "issue_type": "Common Stock", "sector": "Technology",
  "volume": 92309935, "avg30_volume": "128662461.47619048",
  "tracking_id": 30575945941680
}
```

**מדידת ה-latency:** `executed_at 20:29:21` → `created_at 20:29:22` = **שנייה אחת**. אומת גם על נתון היסטורי: `17:59:54` → `17:59:55`. זה אינג'סט כמעט-מיידי, לא batch.

**עומק ההיסטוריה:** `older_than: "2026-03-16T18:00:00Z"` החזיר prints מ-`2026-03-16T17:59:54Z` — **6 חודשים אחורה, אותה רזולוציה בדיוק**. עומק מעבר לזה לא נבדק.

### 2.3 מה שמשתמש קמעונאי יראה שהוא לא יכול לראות היום

| פיצ׳ר | אפשרי עם UW? | הערה |
|---|---|---|
| פיד «עסקאות דארק-פול חיות» עם שעה מדויקת | ✅ | זה הפיצ׳ר שהאפליקציה מבטיחה בשם שלה ולא מספקת |
| «בלוק של $2M ב-NVDA לפני 3 דקות» | ✅ | `premium` + `executed_at` — שניהם מדווחים |
| מיון לפי גודל/פרמיה ברמת השוק | ✅ | `order: "prem"`, `min_premium` |
| האם הביצוע היה ב-bid או ב-ask | ✅ | `price` מול `nbbo_bid`/`nbbo_ask` — **נתון מדווח, לא מודל** |
| ריכוז נפח לפי מחיר | ✅ | `get_dark_pool_volume_price_group` — §2.4 |
| השוואה לית׳ מול דארק | ✅ | `get_ticker_lit_flow` (דורש `ticker_symbol`) |

### 2.4 `get_dark_pool_volume_price_group` — נבדק, NVDA 2026-09-17

מחזיר `stock_price_vol` עם `dark_pool_volume` מול `regular_volume` לכל רמת מחיר:

| price | `dark_pool_volume` | `regular_volume` |
|---|---|---|
| 219 | 25,437,422 | 37,621,134 |
| 218.75 | 3,555,004 | 795,164 |
| 218 | 9,541,960 | 4,672,417 |
| 217 | 1,761,249 | 604,057 |

זה **נתון נמדד, לא נגזר** — סכימת נפח לפי רמת מחיר. שמיש מיידית ל-«באיזה מחיר המוסדיים נערמו». מכיל גם `opt_price_vol` (call/put volume לפי bid/ask side) שאינו רלוונטי לנו.

### 2.5 🔴 אזהרת כנות — למה אסור לקרוא ל-top-of-leaderboard «בלוק»

הקריאה `order: "prem", min_premium: "50000000"` החזירה את ה-prints הגדולים בשוק. **כולם** בעלי החתימה הזו:

```
IVV  size 2,552,289  premium $1,928,145,101  sale_cond_codes: "average_price_trade"  issue_type: "ETF"
VOO  size 2,775,686  premium $1,923,936,773  sale_cond_codes: "average_price_trade"  issue_type: "ETF"
```

`average_price_trade` = **לא עסקה בודדת**. זו דיווח מסכם של סדרת ביצועים במחיר ממוצע, בעיקר יצירה/פדיון של ETF. להציג את זה כ-«בלוק של $1.9 מיליארד» זה בדיוק סוג המספר שהסבב הקודם הוציא מהמוצר.

**חובה, אם נכנסים לזה:** לסנן `sale_cond_codes != "average_price_trade"`, או לתייג במפורש. ל-schema **יש** את הפילטר הזה (`sale_cond_codes`) וגם `hide_index_etf` — הכלים קיימים.

> **פסק דין §2: UW מוסיף ערך אמיתי.** זה הפער הגדול, והוא בדיוק על שם המוצר.

---

## 3. Insiders / בכירים — **UW מוסיף ערך אמיתי**

`ROSTER_EXECUTIVES.md` §1.5 הגדיר שבעה חסמים מבניים ב-Quiver. נבדק אחד-אחד.

### 3.1 טבלת הפערים — כל אחד נבדק בקריאה חיה

| פער שנקבע כחסום ב-`ROSTER_EXECUTIVES.md` | Quiver | UW | ראיה |
|---|---|---|---|
| **שאילתה לפי אדם** | ❌ אין `name`/`cik`/`owner` | ✅ **`owner_name`** (partial, case-insensitive) | `owner_name: "HUANG JEN HSUN"` → 5 שורות NVDA |
| **מזהה אדם יציב** | ❌ אין CIK, אין ID | ✅ **`reporter_cik`** | `0001197649` (Huang) · `0001214156` (Cook) · `0001548760` (Zuckerberg) · `0001184237` (Khosrowshahi) |
| **דגל 10b5-1** | ❌ | ✅ **`is_10b5_1`** | Cook `S` 2026-04-02 → `is_10b5_1: true` · Huang `F` → `false` |
| **`security_title`** | ❌ | ✅ | `"Common Stock"` · `"Restricted Stock Unit"` · **`"Class A Common Stock"` / `"Class B Common Stock"`** |
| **`shares_owned_before`** | ❌ (רק `...Following`) | ✅ | Cook: `before 3,345,367` → `after 3,280,418` |
| **`natureofownership`** | ❌ (רק `D`/`I`) | ✅ | `"By Trust"` · `"By Grantor Retained Annuity Trust 2"` · `"By CZI Holdings, LLC"` |
| **`formtype`** | ❌ | ✅ | `"4"` |
| sector / marketcap / earnings | ❌ | ✅ | `sector`, `marketcap`, `next_earnings_date` |
| קיבוץ שורות מאותו filing | ❌ | ✅ | `transactions: 6` + `ids[]` (Cook) |
| **מעקב אדם חוצה-חברות** | ❌ (שאילתה לפי ticker בלבד) | ✅ | Khosrowshahi החזיר **UBER וגם EXPE** בקריאה אחת |

### 3.2 ארבעת הבכירים מהרוסטר — השורות האמיתיות

**`HUANG JEN HSUN`** · CIK `0001197649` · `officer_title: "President and CEO"` · `is_officer: true`, `is_director: true`

| transaction_date | code | `security_title` | `is_10b5_1` | amount | `natureofownership` | before → after |
|---|---|---|---|---|---|---|
| 2026-06-17 | `F` | Common Stock | false | −45,723 | `null` (D) | 70,191,975 → 70,146,252 |
| 2026-06-16 | `G` | Common Stock | false | −400,000 | **By Trust** (I) | 468,531,547 → 468,131,547 |
| 2026-03-18 | `G` | Common Stock | false | −58,962,602 | **By GRAT 2** (I) | 29,481,301 → 0 |
| 2026-03-18 | `G` | Common Stock | false | +58,962,602 | **By Irrevocable Remainder Trust** (I) | 50,078,000 → 109,040,602 |

**זה פותר את הבעיה שתועדה ב-`ROSTER_EXECUTIVES.md` §2.4** — שם נכתב שאסור להציג אחזקה כוללת כי `SharesOwnedFollowing` הוא per-security-line ואין דרך להפריד. עם `security_title` + `natureofownership` + `director_indirect` **יש** דרך להפריד, ולכן «70M ישירות + 468M בנאמנות» הופך לניסוח שניתן להגנה.

**`COOK TIMOTHY`** · CIK `0001214156` · `officer_title: "Chief Executive Officer"`

| date | code | `security_title` | `is_10b5_1` | amount | `transactions` |
|---|---|---|---|---|---|
| 2026-04-02 | `S` | Common Stock | **true** | −64,949 @ $254.23 | 6 |
| 2026-04-01 | `M` | Common Stock | false | +131,576 | 1 |
| 2026-04-01 | `M` | **Restricted Stock Unit** | false | −131,576 | 3 |

זה **בדיוק** ה-failure mode שתועד ב-`ROSTER_EXECUTIVES.md` §2.4: זוג `M` נגדי ש-Quiver מציג כ«קנייה ומכירה של אותו נכס». עם `security_title` זה קורא נכון: RSU הומר למניה רגילה.

**`ZUCKERBERG MARK`** · CIK `0001548760` · `officer_title: "COB and CEO"` · `is_ten_percent_owner: true`

| date | code | `security_title` | amount | `natureofownership` |
|---|---|---|---|---|
| 2026-07-31 | `C` | **Class A** Common Stock | +591,690 | By CZI Holdings, LLC |
| 2026-07-31 | `G` | **Class A** Common Stock | −591,690 | By CZI Holdings, LLC |
| 2026-07-31 | `C` | **Class B** Common Stock | −591,690 | By CZI Holdings, LLC |

Quiver **לא יכול להבחין בין Class A ל-Class B** — אין לו `security_title`. שלוש השורות האלה נראות ב-Quiver כתנועה חסרת פשר.

**`KHOSROWSHAHI DARA`** · CIK `0001184237` — הרכישה `P` היחידה ברוסטר

| ticker | date | code | `is_10b5_1` | amount | price | `officer_title` |
|---|---|---|---|---|---|---|
| UBER | 2026-09-10 | **`P`** | false | +141,000 | $70.96 | Chief Executive Officer |
| EXPE | 2026-08-14 | `G` | false | −15,000 | $0 | `null` (director בלבד) |
| EXPE | 2026-06-01 | `A` | false | +1,107 | $0 | `null` — **`security_title: "Restricted Stock Units"`**, `date_excercisable: 2027-06-01`, `expiration_date: 2029-06-01` |

שתי נקודות: (1) שורת UBER **ו**-EXPE באותה קריאה — מעקב אדם חוצה-חברות; (2) שדות נגזרים (`date_excercisable`, `expiration_date`) שאין ל-Quiver כלל.

### 3.3 פורמט השם — מאשר את האזהרה הקיימת

UW החזיר **תמיד UPPERCASE**: `HUANG JEN HSUN`, `COOK TIMOTHY`, `ZUCKERBERG MARK`, `KHOSROWSHAHI DARA`. זה מאשר בדיוק את `ROSTER_EXECUTIVES.md` §0.3 — Quiver מחזיר Title-Case ב-80% מהמקרים, UW ב-0%. **אם עוברים ל-UW ל-Form 4, הבעיה הזו נעלמת** כי `reporter_cik` מחליף את התאמת ה-string לחלוטין. זו הנקודה המוצרית החזקה ביותר בסעיף הזה: **36 שורות ה-pin שנשארו `unverified` ב-`ROSTER_EXECUTIVES.md` §5.4 מתייתרות.**

### 3.4 סט הקודים

`transaction_codes` ב-schema מקבל: `P, S, A, M, G, C, I, U, O, H, W, J, L, F, Z` — **15 קודים**, כולל `J`, `C`, `I` שמסומנים כ«חסרים» בטיפוס שלנו (`ROSTER_EXECUTIVES.md` §2.5). ובנוסף פילטר **`exclude_10b5_1`** בצד השרת.

> **פסק דין §3: UW מוסיף ערך אמיתי.** כל שבעת החסמים המבניים נפתרים. `P`-only עדיין יצטרך להיפתח בצד שלנו — זו בעיה שלנו, לא של הספק.

---

## 4. קונגרס — **שקול ל-Quiver, ובציר אחד גרוע ממנו**

### 4.1 מה UW נותן שאין ב-Quiver

| שדה UW | ערכים שנצפו | האם Quiver מספק? |
|---|---|---|
| **`owner` / `ownership` / `affiliation`** | `self`, `spouse`, **`child`**, `joint`, `undisclosed` | 🔴 **לא — לא קיים בשום סכימה של Quiver** |
| **`file` / `link_url`** | `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/9115679.pdf` | 🔴 לא — אין קישור למקור |
| **`politician_id`** | `08d939a4-f63b-4a4b-b431-7096644081bb` (UUID) | 🟡 יש `BioGuideID`, שקול |
| **`asset`** | `stock`, `municipal-security` | 🟡 יש `TickerType` |
| `notification_date` | `2025-10-02` (בין `transaction_date` ל-`filed_at_date`) | 🔴 לא |
| `current_district` | `CA-17`, `TN-1` | ✅ יש (`District`) |
| `low_value` / `high_value` / `mid_value` | `1001` / `15000` / `8000.5` | 🟡 יש `Range` + `Amount` |
| `unusual_activity_type` | `committee_conflict`, `fec_donation_conflict`, … | 🔴 לא — **אבל מסומן `Enterprise` בסכימה** |

**השדה `owner` הוא הממצא האמיתי בסעיף הזה.** `CURATED_ROSTER_PLAN.md` §5.6 קבע שההסבר הסביר לכך ש-Khanna ו-McCaul מחזירים אחזקות ריקות הוא חשבונות משפחתיים, **והוסיף במפורש** ש«ל-schema של Quiver אין שדה owner/spouse/filer בכלל… ההשערה לא ניתנת להוכחה או להפרכה». UW **מוכיח אותה**: כל 50 שורות ה-Khanna שקיבלתי הן `owner ∈ {spouse, child}` — **אפס שורות `self`**.

### 4.2 🔴 מה ש-UW **לא** נותן — וזה מה שביקשנו

השאלה הייתה האם UW פותר את 5 הפוליטיקאים שמחזירים אחזקות ריקות ב-Quiver.

**חיפוש בכל ה-namespace על `holding|portfolio|net_worth` מחזיר כלי אחד: `get_institution_holdings` — 13F בלבד.**

> **אין ב-UW אף endpoint של אחזקות קונגרס.** אין תיק, אין שווי, אין allocation, אין `NetWorth`.

| פוליטיקאי | Quiver holdings | UW holdings | UW trades | פסק דין |
|---|---|---|---|---|
| Ro Khanna | ❌ `[]` | ❌ **אין endpoint** | ✅ (עד 2026-04-27) | **לא נפתר** |
| Michael McCaul | ❌ `[]` | ❌ **אין endpoint** | לא נבדק בנפרד | **לא נפתר** |
| Diana Harshbarger | ❌ `[]` | ❌ **אין endpoint** | ✅ אבל עד **2023-02-22** | **לא נפתר** |
| Mark Green | ❌ `[]` | ❌ **אין endpoint** | לא נבדק בנפרד | **לא נפתר** |
| Chuck Fleischmann | ❌ `[]` | ❌ **אין endpoint** | לא נבדק בנפרד | **לא נפתר** |

**המסקנה: `holdings_source = 'trades_only'` מ-`CURATED_ROSTER_PLAN.md` §5.6 נשארת ההמלצה הנכונה.** UW לא משנה אותה. הוא כן **מחזק** אותה, כי עכשיו יש הסבר מדווח («העסקאות של Khanna הן חשבונות בן/בת זוג וילדים») במקום השערה.

### 4.3 🔴 טריות — UW מאחר אחרי Quiver על Khanna

| מדד | UW | Quiver / ה-DB שלנו |
|---|---|---|
| Khanna — `transaction_date` אחרון | **2026-04-27** (`filed 2026-05-11`) | **2026-09-01** (`CURATED_ROSTER_PLAN.md` §5.2) |
| Harshbarger — `transaction_date` אחרון | **2023-02-22** | **2026-04-16** |
| טריות **גלובלית** (`get_recent_congress_trades`) | `transaction_date` עד 2026-08-28 · **`filed_at_date` עד 2026-09-15** | `*/20m` cron |

הפיד הגלובלי של UW **כן** טרי (יומיים). אבל **ברמת האדם**, שני מתוך השניים שבדקתי מאחרים משמעותית אחרי מה שכבר יש לנו. על Harshbarger הפער הוא **3.2 שנים**.

> ⚠️ **גודל המדגם: 2 אנשים.** לא בדקתי את כל הרוסטר. מה שכן מאומת: על שני האנשים שנבדקו, UW גרוע יותר. זה מספיק כדי לשלול «UW טרי יותר בקונגרס» כטענה כללית.

### 4.4 🔴 סכומים — אין שיפור, וזה מבני

השאלה הייתה האם UW נותן סכומים מדויקים במקום טווחי STOCK Act.

```
"amounts": "$1,001 - $15,000",  "low_value": "1001",  "high_value": "15000",  "mid_value": "8000.5"
```

`mid_value = 8000.5` = **בדיוק ה-midpoint** של הטווח. זה **אותו חישוב** ש-`congressPortfolio.ts` עושה ב-`STOCK_ACT_FLOOR_MID`, ואותו דבר ש-`volume_method=average` של Quiver עושה. **אין סכום מדויק אצל אף אחד מהשניים, כי ה-STOCK Act לא מדווח אותו.** זה חסם רגולטורי, לא חסם ספק.

### 4.5 🔴 איכות נתונים — כפילויות מאומתות ב-UW

`get_politics_flow(search_query: "Harshbarger")` החזיר **50 שורות שמתוכן PCAR ב-2026-02-14 מופיע 5 פעמים** — אותו טיקר, אותו תאריך, אותו `txn_type`, אותו `amounts`, ונבדל רק ב-`owner` (`spouse`/`joint`/`undisclosed`) וב-`description` (`null` מול `" stock 8000"`). זו חתימה של **cross-join**, לא של חמש עסקאות.

בנוסף: `created_at: "2025-01-01T00:00:00.000000Z"` **זהה בכל 50 השורות** של Harshbarger — placeholder, לא זמן קליטה אמיתי. (בשורות Khanna דווקא `created_at` אמיתי: `2025-10-03T16:42:14Z`.)

> **פסק דין §4: שקול ל-Quiver, וגרוע ממנו בטריות ברמת האדם.** השדה `owner` שווה זהב הסברתי, אבל הוא לא שווה מיגרציה. **להישאר עם Quiver לקונגרס.**

---

## 5. מוסדיים / 13F — **UW טוב יותר מבנית, זהה בטריות**

### 5.1 טריות — זהה, וזה בלתי נמנע

| קרן | UW `date` (תקופה) | UW `filing_date` | Quiver (`ROSTER_WHALES_13F.md`) |
|---|---|---|---|
| Berkshire Hathaway | **2026-06-30** | **2026-08-14** | 2026-06-30, `Date = 2026-08-14` |
| Pershing Square | **2026-03-31** | **2026-05-15** | ראה §5.3 🔴 |
| Scion Asset Management | **2025-09-30** | **2025-11-03** | לא מאומת |

**זהה לחלוטין.** אותו מקור SEC, אותו lag של 45 יום, אותה התיישנות של 79 ימים. כל מה ש-`ROSTER_WHALES_13F.md` §4 אומר על כנות 13F — **חל על UW במדויק אותו דבר**. מעבר ל-UW **לא** מייצר נתון טרי יותר.

### 5.2 מה UW נותן מבנית שאין ב-Quiver

`ROSTER_WHALES_13F.md` §5.5 מונה 9 חסימות לפני שילוח. **חמש מהן הן פערי ספק ש-UW סוגר:**

| חסימה ב-`ROSTER_WHALES_13F.md` | שדה UW | ראיה |
|---|---|---|
| **#5 — לשמור `Put/Call`, אחרת Burry שקרי** | **`put_call`** + **`security_type`** | Scion: `PLTR` → `put_call: "put"`, `security_type: "Option"` |
| **#3 — להפריד `report_period` מ-`filing_date`** | **`date`** + **`filing_date`** בנפרד | Berkshire: `date 2026-06-30`, `filing_date 2026-08-14` |
| **§1.1 — אין CIK ואין institution ID ב-Quiver** | **`cik`** | `"0001067983"` |
| **§1.1 — שינוי שם שובר את הפרופיל בשקט** | **`name_changes[]`** | מוחזר כמערך (ריק ל-Berkshire) |
| **§5.4 — `person_slug` למניעת כפילות Halvorsen** | **`people[]`** + `short_name` | Berkshire: `["Greg Abel","Warren Buffett","Charlie Munger"]` |

ובנוסף, ללא מקבילה ב-Quiver:

- **פירוק שווי לפי סוג נייר:** `share_value`, `call_value`, `put_value`, `warrant_value`, `pfd_value`, `debt_value`, `fund_value` — וכן `*_holdings` מקבילים.
- **`holdings_breakdown`** — Scion: `{"Share": 0.04}`, כלומר **96% מהתיק המדווח שלו אינו מניות**.
- **`has_options_holdings`** — boolean ברמת הקרן.
- **`buy_value` / `sell_value`** ברמת הרבעון — Berkshire Q2: `+$18.9B` קניות, `−$3.97B` מכירות.
- **`is_hedge_fund`, `tags`** (`["known","activist","value_investor"]`), **`logo_url`, `founder_img_url`**, `description`.
- **עומק היסטוריה:** `dates[]` של **50–51 רבעונים** עד `2013-12-31`.
- **פילטרים:** `security_types`, `holding_status` (`open`/`closed`/`added`/`reduced`), `ticker_symbol`.

### 5.3 🔴 מקרה Pershing Square — הדגל האדום מצביע על Quiver

המשימה הגדירה: «EDGAR אומר שאין Q2 2026 ל-Pershing — אם UW טוען שיש, זה דגל אדום על UW».

**UW לא טוען שיש.** `get_institution_holdings(name: "PERSHING SQUARE CAPITAL MANAGEMENT, L.P.")` החזיר:

```
date: "2026-03-31"   filing_date: "2026-05-15"
dates[0]: "2026-03-31"   ← התקופה הטרייה ביותר שקיימת
```

הרבעון הטרי ביותר הוא **Q1 2026**. אין Q2. **UW תואם EDGAR.**

לעומת זאת, `ROSTER_WHALES_13F.md` §2.3 מתעד מה-probe החי של Quiver:

> «ה-probe החי מחזיר 12 שורות `sec13fchanges` לתקופה `2026-06-30` (filing date `2026-08-14`). כלומר **Quiver כן מחזיק את Q2 2026 ל-Pershing** ואנחנו לא כתבנו אותו.»

**שני הספקים בסתירה, ו-UW הוא זה שמסכים עם EDGAR.**

| מסקנה | סטטוס |
|---|---|
| UW לא המציא Q2 ל-Pershing | ✅ **מאומת בסבב הזה** |
| Quiver החזיר שורות לתקופה `2026-06-30` ל-Pershing | 📄 מתועד ב-`ROSTER_WHALES_13F.md` §2.3 — **לא אומת מחדש** (אין מפתח Quiver בסבב read-only הזה) |
| האם Pershing אכן לא הגיש Q2 2026 | 🔴 **לא אומת מול EDGAR בסבב הזה** |

> **פעולה נדרשת:** לאמת מול EDGAR ישירות. אם Pershing אכן לא הגיש Q2 2026, אז «הבאג» שתועד כ«אנחנו לא כתבנו את Q2» הוא **לא באג שלנו** — Quiver ממציא תקופה, וה-DB שלנו דווקא נכון. זה הופך את חסימה #4 ב-`ROSTER_WHALES_13F.md` §5.5 על ראשה.

### 5.4 🔴 Scion / Burry — UW עונה על שאלה פתוחה, ומאשר סכנה

`ROSTER_WHALES_13F.md` §6 מסמן כ«לא מאומת»: «האם Scion (Burry) עוד מגישה 13F». **UW עונה:**

- התקופה האחרונה: **`2025-09-30`**, הוגש `2025-11-03`. **מאז — אין.** כלומר ~שנה ללא דיווח.
- `holdings_breakdown: {"Share": 0.04}` — **4% בלבד** מהשווי המדווח הוא מניות.
- הפוזיציות הגדולות ביותר, לפי `value`:

| ticker | `security_type` | **`put_call`** | units | `value` |
|---|---|---|---|---|
| PLTR | Option | **put** | 50,000 | $912,100,000 |
| NVDA | Option | **put** | 10,000 | $186,580,000 |
| PFE | Option | **call** | 60,000 | $152,880,000 |
| HAL | Option | **call** | 25,000 | $61,500,000 |
| MOH | Share | — | 125,000 | $23,920,000 |
| BRKR | **Pref** | — | 48,334 | $13,137,181 |

זו הוכחה ישירה לאזהרה ב-`ROSTER_WHALES_13F.md` §4.7 («Puts כ-long 🔴 לא»): ב-Quiver, שזורק את `Put/Call`, הפרופיל של Burry היה מציג **PLTR כאחזקת long של $912M** — ההיפך המדויק מהפוזיציה.

> ⚠️ **אזהרת כנות על `value` של אופציות:** $912M עבור 50,000 חוזי put הוא ה-**notional** של הנכס הבסיסי (50,000 × 100 × ~$176 ≈ $881M), **לא הפרמיה ששולמה**. זו דרישת דיווח של 13F, לא בחירה של UW — אבל להציג את זה כ«פוזיציה של $912M» זה מטעה בסדר גודל. חובה תווית.

> **פסק דין §5: UW טוב יותר מבנית, זהה בטריות.** `put_call` לבד הוא חוסם-שילוח שנפתר. אבל 13F נשאר רבעוני ובן 79–137 ימים בשני הספקים, וכל סעיף 4 ב-`ROSTER_WHALES_13F.md` נשאר בתוקף.

---

## 6. מה שאין ל-Quiver מקבילה בכלל — והאם זה רלוונטי לנו

המוצר: אפליקציה קמעונאית בעברית למעקב אחרי עסקאות של אנשים בולטים. בהתאם:

| תחום UW | כלים | רלוונטי למוצר? | נימוק |
|---|---|---|---|
| **Options flow** (`get_option_trades`, `get_flow_alerts`, `get_options_screener`, `get_multi_trades`) | ~15 | 🔴 **הסחת דעת** | זה מוצר לסוחרי אופציות. המשתמש שלנו עוקב אחרי **אנשים**, לא אחרי חוזים. מחייב הסבר של מה זה premium, DTE, sweep — כל אחד מהם מחסום כניסה. |
| **GEX / Greeks** (`get_gex_levels`, `get_greek_exposure_*`, `get_greek_flow*`) | ~8 | 🔴 **הסחת דעת חריפה** | GEX הוא מודל dealer-positioning **נגזר**, לא נתון מדווח. הסבב הקודם הוציא מספרים מודלים — לא להכניס את הכבד ביותר שבהם. |
| **Market tide / ETF tide** (`get_market_tide`, `get_market_etf_tide`, `get_expiry_tide`) | 4 | 🔴 הסחת דעת | אגרגט זרימת אופציות. לא קשור לאנשים. |
| **Analyst ratings** (`get_analyst_ratings`) | 1 | 🟡 **אולי — נישה** | Quiver כן נותן `quivernews` שלא בשימוש. דירוגי אנליסטים הם תוכן «מי אומר מה» שמתיישב עם המוצר, אבל אנליסט הוא לא «אדם בולט» במובן שהמוצר מוכר. **עדיפות נמוכה.** |
| **Earnings** (`get_upcoming_earnings`, `get_earnings_report`, `get_earnings_history`) | ~6 | 🟡 **כן, כהקשר בלבד** | `next_earnings_date` **מגיע חינם בכל שורת insider** של UW. עמודה שכבר קיימת ב-`dark_pool_insider_buys` ותמיד `null` בנתיב Quiver. **זה שדרוג של אפס עלות**, לא פיצ׳ר. |
| **Seasonality** (`get_market_seasonality`, `get_average_return_per_month_by_ticker`) | ~5 | 🔴 הסחת דעת | תשואה היסטורית לפי חודש. סטטיסטיקה חסרת סיבתיות שמתחפשת לסיגנל. הכי גרוע בקמעונאות. |
| **Short interest** (`get_short_screener`, `get_short_data_by_ticker`, `get_short_volume_ratio_*`) | ~5 | 🟡 **גבולי** | ✅ נבדק וחי. הקשר: `QUIVER_API_AUDIT.md` §8.5 גילה שה-`DPI` של Quiver מתועד כ-«% of shares short» ולא כעוצמת דארק-פול. UW נותן short interest **אמיתי ומופרד**, מה שמאפשר להפסיק לתייג שדה short כ-«דארק פול». **זה תיקון כנות, לא פיצ׳ר.** |
| **Prediction markets** (`get_prediction_*`) | ~10 | 🟡 שקול ל-Quiver | Quiver נותן `polymarkettrades` עם 23 שדות שאינו בשימוש (`QUIVER_API_AUDIT.md` §7.1, M7). **אין צורך ב-UW בשביל זה.** |
| **Crypto whales** (`get_recent_crypto_whale_trades`) | ~4 | 🔴 מחוץ ל-scope | |
| Fundamentals / screeners / correlations / yield curve / central bank rates | ~20 | 🔴 הסחת דעת | תשתית של טרמינל, לא של אפליקציית אנשים. |

**סיכום חד:** מתוך ~200 כלי UW, **שניים** מצדיקים את המנוי (`dark pool prints`, `insider transactions`). שלושה נוספים הם שדרוגי כנות בעלות אפס (`next_earnings_date`, `short interest`, `put_call` ב-13F). **כל השאר — לא.**

---

## 7. Honesty check — מספרים של UW שאסור לייבא

אותו תקן שהופעל על Quiver. **ל-UW יש מספרים מודלים משלו, וחלקם מוצגים כעובדה.**

| שדה | Endpoint | REAL / DERIVED | הסבר |
|---|---|---|---|
| `executed_at`, `size`, `price`, `premium` | dark pool | ✅ **REAL** | דיווח TRF. `premium = price × size` — אריתמטיקה על שדות מדווחים |
| `nbbo_bid` / `nbbo_ask` + quantities | dark pool | ✅ **REAL** | quote נמדד ברגע העסקה |
| `dark_pool_volume` / `regular_volume` לפי מחיר | volume_price_group | ✅ **REAL** | סכימת נפח |
| `is_10b5_1`, `security_title`, `natureofownership`, `formtype`, `reporter_cik`, `shares_owned_before` | insider | ✅ **REAL** | כולם שדות ב-Form 4 עצמו |
| `put_call`, `security_type`, `units`, `value` | 13F | ✅ **REAL** | שדות ב-13F |
| `cik`, `date`, `filing_date`, `people[]` | institutions | ✅ **REAL** | מטא-דאטה מ-SEC |
| **`avg_price`** | 13F holdings | 🔴 **DERIVED — מוצג כעובדה** | Berkshire/AAPL: `avg_price: "40.56"`. **13F לא מדווח cost basis בכלל.** UW מחשב מדלתות רבעוניות × מחירי סוף-רבעון. הערכה סבירה — **לא נתון** |
| **`price_first_buy`** | 13F holdings | 🔴 **DERIVED** | `"22.53"` ל-AAPL. אותו מודל |
| **`first_buy`** | 13F holdings | 🔴 **DERIVED + מוטה חלון** | Pershing/MSFT: `first_buy: "2026-03-31"` עם `historical_units: [5654078,0,0,0]` — כלומר «הרבעון הראשון בחלון שבו הופיע», לא הרכישה הראשונה. **זה בדיוק הבאג שתועד אצלנו ב-`ROSTER_WHALES_13F.md` §4.2(ד)** |
| **`price_change_since_first_buy_perc`** · **`avg_price_change_perc`** | 13F holdings | 🔴 **DERIVED — הכי מסוכן** | Berkshire/AAPL: `"13.9578"` = **+1,396%**. נבנה על `avg_price` מודלי ועל `first_buy` מוטה. **אסור לייבא** |
| `buy_price` / `sell_price` / `price_on_filing` / `price_on_report` | 13F activity | 🔴 **DERIVED** | 13F לא מדווח מחירי ביצוע |
| **`stock_price`** | insider | 🔴 **מחיר של היום, לא של אז** | `"219.34"` בכל 5 שורות Huang — כולל שורה מ-**2026-03-18**. `"337"` בכל שורות Cook מ-אפריל. אם יוצג ליד עסקה היסטורית → שקר |
| **`marketcap`, `next_earnings_date`, `close`** | insider / 13F | 🟡 **snapshot נוכחי** | תקינים כ«נכון להיום». **לא** point-in-time |
| **`mid_value`** | congress | 🔴 **DERIVED** | midpoint של טווח STOCK Act. אותו ניחוש שאנחנו כבר עושים |
| **`value` של אופציות ב-13F** | 13F | 🟡 REAL אבל מטעה | notional של הבסיס, לא פרמיה. Scion/PLTR = $912M |
| **`premium` של `average_price_trade`** | dark pool | 🟡 REAL אבל מטעה | לא בלוק בודד. §2.5 |
| `unusual_activity_type` | politics flow | ⚠️ **תיוג קנייני + `Enterprise`** | הסכימה מסמנת «Enterprise unusual-activity tags». לא נבדק, וספק אם בתוכנית שלנו |
| `created_at` | politics flow | 🔴 **placeholder לפעמים** | `"2025-01-01T00:00:00Z"` בכל 50 שורות Harshbarger |

**הכלל המעשי:** ב-UW, **`security_type`, `put_call`, `units`, `value`, `date`, `filing_date` מ-13F הם REAL.** כל שדה שמכיל `avg`, `price_first`, `_perc`, או `first_buy` — **DERIVED, לא לייבא.** בשורות insider ו-dark pool המצב הפוך: כמעט הכל REAL, פרט ל-`stock_price`/`marketcap`/`close` שהם snapshot נוכחי.

---

## 8. פסק דין מסכם + המלצה

### 8.1 טבלת הכרעה

| תחום | פסק דין | הנימוק בשורה אחת |
|---|---|---|
| **1. Dark pool prints** | 🟢 **UW מוסיף ערך אמיתי** | print בודד ברזולוציית שנייה ב-latency של שנייה, מול אגרגט T-1. הפער היחיד שהוא קטגורי |
| **2. Insiders / בכירים** | 🟢 **UW מוסיף ערך אמיתי** | `owner_name` + `reporter_cik` + `is_10b5_1` + `security_title` — כל 7 החסמים של `ROSTER_EXECUTIVES.md` נפתרים |
| **3. קונגרס** | 🟡 **שקול ל-Quiver / גרוע בטריות** | אותם טווחים, אותו midpoint, **אין endpoint אחזקות**, ומאחר ב-4 חודשים על Khanna |
| **4. 13F — טריות** | 🟡 **שקול ל-Quiver** | אותו מקור SEC, אותו lag 45 יום, אותה התיישנות 79 ימים |
| **4b. 13F — מבנה** | 🟢 **UW מוסיף ערך אמיתי** | `put_call` (חוסם-שילוח #5) + `cik` + `people[]` + הפרדת report/filing |
| **5. אופציות / GEX / tide / seasonality** | 🔴 **לא רלוונטי** | מוצר לסוחרי אופציות. ~150 כלים, אפס שימוש אצלנו |
| **5b. short interest / earnings date** | 🟡 **שדרוג כנות בעלות אפס** | `next_earnings_date` מגיע חינם בכל שורת insider; short מופרד מתקן את בלבול ה-`DPI` |
| **5c. prediction markets** | 🟡 **לא צריך את UW** | Quiver נותן `polymarkettrades` (23 שדות) ולא בשימוש |

### 8.2 שלושה דברים שרק UW יכול לתת

1. **פיד dark pool ברמת print** — הפיצ׳ר שנושא את שם האפליקציה. Quiver לא יכול, לא בתוכנית אחרת ולא בכלל.
2. **פרופיל בכיר ניתן-להגנה** — `reporter_cik` מחליף 36 שורות pin שנשארו `unverified`, ו-`is_10b5_1` + `security_title` הופכים «יומן פעולות בכיר» מבלתי-אפשרי לאפשרי.
3. **13F עם `put_call`** — בלעדיו כל פרופיל short-heavy (Burry, Icahn, Einhorn) הוא שקר בכיוון ההפוך.

### 8.3 שלושה דברים שבהם UW גרוע או פחות אמין

1. **טריות קונגרס ברמת האדם.** Khanna: פער של 4 חודשים. Harshbarger: 3.2 שנים. Quiver מנצח.
2. **כפילויות בפיד הקונגרס.** PCAR ×5 באותו תאריך, נבדל רק ב-`owner`. חתימת cross-join.
3. **cost basis מודלי מוצג כעובדה.** `avg_price`, `price_change_since_first_buy_perc` (+1,396% ל-Berkshire/AAPL). 13F **לא** מדווח cost basis. זה בדיוק סוג המספר שהוצא מהמוצר בסבב הקודם — **אסור לייבא**.

### 8.4 ההמלצה: היברידי ממוקד

| מסלול | הרכב | ~עלות/חודש | הערכה |
|---|---|---|---|
| A. Quiver בלבד (המצב הנוכחי) | Quiver Trader | **$75** | ❌ אפליקציה בשם «Dark Pool» שאין לה dark pool prints, ורוסטר בכירים עם אדם אחד שמיש |
| B. UW בלבד | UW API Basic | **~$150** | ❌ מפסידים טריות קונגרס ואת `congress_stock_holdings` (88% כיסוי תיקים) — ואין להם מקבילה ב-UW |
| **C. היברידי ממוקד** | Quiver Trader + UW API Basic | **~$225** | ✅ **מומלץ** |

**חלוקת האחריות המוצעת ב-C:**

| דאטה | ספק | למה |
|---|---|---|
| **Dark pool prints** | **UW** | אין מקבילה ב-Quiver |
| **Form 4 / בכירים** | **UW** | `reporter_cik`, `is_10b5_1`, `security_title`, שאילתה לפי אדם |
| **13F** | **UW** (לשקול) | `put_call` הוא חוסם-שילוח. הטריות זהה, אז המעבר «חינם» באיכות |
| קונגרס — עסקאות | **Quiver** | טרי יותר ברמת האדם |
| קונגרס — **אחזקות** | **Quiver** | `congress_stock_holdings`, 88% כיסוי. **ל-UW אין בכלל** |
| Trump | **Quiver** | `trumpstocktrades` עם `Amount` בדולרים אמיתיים |
| אופציות / GEX / tide / seasonality | **אף אחד** | לא רלוונטי למוצר |

**מדוע לא לזרוק את Quiver:** `congress_stock_holdings` הוא הנתון שמתקן את בעיית «התיקים המופרכים» (`CURATED_ROSTER_PLAN.md` §3.2: חציון פער ×5.05, מקרה גרוע ×1,025), והוא **לא קיים ב-UW בשום צורה**. לזרוק את Quiver זה להחזיר את הבעיה שהסבב הקודם פתר.

### 8.5 אם רק מנוי אחד אפשרי

**UW, אבל עם עין פקוחה.** הוא נותן את שני הפיצ׳רים שהמוצר מבטיח ולא מספק (dark pool prints, פרופיל בכיר), מול הפסד של `congress_stock_holdings`. אבל אז **חייבים** לעבור ל-`holdings_source = 'trades_only'` לכל הפוליטיקאים, לא רק ל-5 — כלומר ויתור על פיצ׳ר התיקים כולו.

**זו בחירה מוצרית, לא טכנית:** האם המוצר הוא «תיקים של פוליטיקאים» (→ Quiver) או «זרימת כסף חכם בזמן אמת» (→ UW)? השם `DarkPoolApp` מרמז על השני.

---

## 9. מה לא אומת בסבב הזה

| פריט | מדוע |
|---|---|
| **מכסת ה-API של UW ותאריך החידוש** | לא נבדק. 18 קריאות עברו ללא throttling. יש usage dashboard |
| **העלות המדויקת של UW היום** | `UNUSUAL_WHALES_INTEGRATION.md` אומר «~$150/חודש API Basic». לא אומת מול חיוב או מול עמוד תמחור |
| **האם `unusual_activity_type` זמין בתוכנית שלנו** | הסכימה מסמנת «Enterprise» |
| **עומק היסטוריית dark pool מעל 6 חודשים** | 2026-03-16 אומת. מעבר לזה לא נבדק |
| **האם Pershing Square אכן לא הגיש Q2 2026** | 🔴 **לא אומת מול EDGAR.** קריטי — §5.3 |
| **האם Quiver עדיין מחזיר `2026-06-30` ל-Pershing** | לא ניתן — אין מפתח Quiver בסבב read-only |
| **טריות קונגרס ב-UW ל-38 הפוליטיקאים הנותרים** | נבדקו 2 (Khanna, Harshbarger). שניהם גרועים מ-Quiver |
| **McCaul / Mark Green / Fleischmann ב-UW** | נבדקו בעקיפין (אין endpoint אחזקות → נפסלים בכל מקרה). פיד העסקאות שלהם לא נבדק בנפרד |
| **סמנטיקת ההתאמה של `owner_name`** | «case-insensitive partial» בדוקס. `"KHOSROWSHAHI"` ו-`"ZUCKERBERG"` עבדו חלקית. `get_institutions` דווקא נכשל על `"SCION"` — לא עקבי בין הכלים |
| **האם UW מכניס Form 144 לפיד** | `ROSTER_EXECUTIVES.md` §2.4 תיעד `formtype: "144"` ב-UW. בסבב הזה כל השורות היו `formtype: "4"`. לא נשלל |
| **rate limits של UW** | לא מתועד בסכימות ה-MCP |

---

## 10. תחזוקה

- **מקור אמת ל-UW:** `GetDynamicTools` על `user-unusual-whales` (~200 כלים). הסכימות הן מקור האמת, לא `api.unusualwhales.com/docs`.
- **לפני כל החלטת מיגרציה:** להריץ מחדש את §1 (בדיקת חיוּת) — המנוי בוטל פעם אחת ויכול להתבטל שוב.
- **הפעולה החוסמת הבאה:** לאמת מול EDGAR אם Pershing Square הגיש 13F ל-Q2 2026 (§5.3). זו שאלה בת 10 דקות שקובעת מי מהספקים פחות אמין.
- **לא להצהיר «נתון» על שדה שמכיל `avg`, `price_first`, `_perc` או `first_buy`** — §7.
