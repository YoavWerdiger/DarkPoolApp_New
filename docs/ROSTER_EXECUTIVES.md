# ROSTER: בכירים בתאגידים (Group 2 — 40 שמות)

> **סטטוס מקור (עודכן — אימות חי בוצע):**
>
> | מקור | מה אומת | סטטוס |
> |---|---|---|
> | `schema.json` | מיפוי endpoints, params, שמות שדות מוצהרים | ✅ |
> | **Quiver live, `/beta/live/insiders`** | **רשימת שדות אמיתית, קודי עסקה, פורמט `Name`, חלון התשובה** | ✅ **מאומת** |
> | **Supabase DB (`source='quiverquant'`)** | 165 מחרוזות `Name` אמיתיות של Quiver, התפלגות `officerTitle` | ✅ **מאומת** |
> | Unusual Whales | התנהגות Form 4 ברמת האדם (שמות חוקיים, קודים per-person) | ✅ ספק אחר, אותו מקור רגולטורי |
> | **Quiver `?ticker=`** | היסטוריה per-ticker, מחרוזות `Name` ל-33 הבכירים | 🔴 **לא מאומת — לא נגיש** (§0.2) |
>
> **איך הושג האימות החי:** מפתח Quiver קיים **רק כ-Supabase secret**, לא בשום `.env` מקומי.
> העברתי את הקריאות דרך ה-edge function ה**מותקן בפרודקשן** `sync-insider-buys`, שמחזיק את
> ה-secret בצד השרת, בנתיב ה-probe הקיים שלו:
> `POST /functions/v1/sync-insider-buys` עם `{"probe":"quiver","page_size":N}`.
> נתיב ה-probe חוזר (`return`) **לפני** כל כתיבה ל-DB — כלומר read-only, לא מוטט נתוני פרודקשן.
> **המפתח עצמו לא נקרא, לא הודפס ולא נשמר בשום שלב.** לא פורסמה שום פונקציה חדשה.

---

## 0. אימות חי מול Quiver — מה התקבל ומה חסום

### 0.1 התשובה האמיתית מ-`/beta/live/insiders`

שתי קריאות (`page_size=50`, `page_size=1000`) דרך ה-probe בפרודקשן, 2026-09-17:

| מדד | `page_size=50` | `page_size=1000` |
|---|---|---|
| `count` שהוחזר | 50 | **1000** (נחסם ב-cap שלנו, לא של השרת) |
| טווח תאריכים | 2026-09-17 → 2026-09-17 | 2026-09-16 → 2026-09-17 |
| `hasAccession` | false | false |

**היסק תפעולי (מאומת):** ~1000 שורות ≈ **יומיים** של דיווחים בכל השוק, כלומר **~500 שורות ליום**.
הפרודקשן מריץ `QUIVER_INSIDER_PAGE_SIZE=500` עם `FORM4_LOOKBACK_HOURS=48` —
כלומר מבקש 500 שורות כדי לכסות חלון של 48 שעות שמכיל ~1000. **החלון חתוך בחצי בערך.**
זה אישור כמותי ל-§8.1 באודיט. *(לא תיקנתי — אין שינויי פרודקשן במשימה הזו.)*

### 0.2 🔴 מה לא הצלחתי לאמת, ולמה — פער ה-`?ticker=`

חיפשתי ערוץ מותקן שיעביר `?ticker=` ל-`/beta/live/insiders`. **אין כזה.** הממצאים:

| בדיקה | תוצאה |
|---|---|
| `fetchQuiverLiveInsiders()` — הפרמטרים שהיא שולחת | `uploaded`, `page_size`, `page` בלבד. **`ticker` לא נשלח אף פעם** |
| מי קורא ל-`fetchQuiverLiveInsiders` | `sync-insider-buys` בלבד |
| מה ה-probe מעביר הלאה | `{ pageSize, maxRows }` בלבד — לא `ticker`, לא `uploaded`, לא `page` |
| האם `quiverGetJson` (הקריאה הגנרית) exported? | ❌ לא — `async function` פרטית ב-`_shared/quiverQuant.ts:282` |
| פונקציה מותקנת שמקבלת `path`/`endpoint`/`params` מה-body ומעבירה ל-Quiver | ❌ אין |
| `uw-diagnostics` | Unusual Whales בלבד |
| `sync-fund-13f` probe | `sec13f` / `sec13fchanges` בלבד |

**המסקנה:** להעביר `?ticker=` ל-Quiver דורש **שינוי קוד פרודקשן** (`_shared/quiverQuant.ts`) —
מה שהמשימה אוסרת. לכן **נשארים לא מאומתים**:

1. 🔴 **המחרוזות המדויקות ב-`Name` ל-33 הבכירים** — לא ניתן לשאול לפי טיקר.
2. 🔴 **האם `?ticker=` מחזיר היסטוריה או חלון recent** — השאלה הקריטית לתכנון ה-backfill.

**אין למלא את הפער הזה בהסקה מ-Unusual Whales.** הפורמטים של שני הספקים **שונים בפועל**
(§0.3), ולכן pin ידני על מחרוזת שמקורה UW הוא בדיוק הסיכון שצריך למנוע.

### 0.3 פורמט `Name` של Quiver — מאומת, ושונה מ-UW

מתוך **165 מחרוזות `Name` אמיתיות** שנקלטו מ-Quiver ל-`dark_pool_insider_buys`:

| תכונה | ממצא מאומת |
|---|---|
| סדר | `Last First [Middle]` — עקבי (`Agree Joey`, `Ackerman Jonathan Z.`) |
| **Case** | 🔴 **לא עקבי: 132/165 (80%) Title-Case, 33/165 (20%) ALL-UPPERCASE** |
| דוגמאות UPPERCASE | `AULT MILTON C III`, `CHEN THOMAS C`, `COLOMBO WILLIAM J`, `DO CUONG V` |
| דוגמאות Title-Case | `Agree Joey`, `Altman Peter`, `Aguirre Blaise A.`, `Bridgford Allan Jr.` |
| ישויות (לא אנשים) מעורבות | `CASCADE INVESTMENT, L.L.C.`, `DONEGAL MUTUAL INSURANCE CO`, `ADAR1 Capital Management, LLC`, `A-6684 Ltd.` |
| סופיקסים — מקום, case ונקודה משתנים | `Bridgford Allan Jr.` · `Liuzza Nicholas Reyland JR` · `RAKOLTA JOHN JR` · `PRICE BILLY L JR DR` · `O'Dowd William IV` |
| פסיקים / נקודות / גרש | `Ackerman Jonathan Z.` · `Aguirre Blaise A.` · `O'Dowd William IV` |
| `officerTitle` | 🔴 **`null` ב-151 מתוך 247 שורות (61%)** |

**השוואה ישירה לאותו סוג נתון ב-UW:** UW החזיר תמיד UPPERCASE (`HUANG JEN HSUN`, `FARLEY JR JAMES`).
**Quiver מחזיר ב-80% מהמקרים Title-Case.** כלומר אפילו אם שני הספקים שואבים את אותו
`rptOwnerName`, **ה-string לא זהה** — וזה מוכיח שאסור היה לבנות pin על מחרוזות UW.

**מה זה מחייב בחוק ההתאמה:** `normalize()` **חייב** לכלול `toUpperCase()`, הסרת `.`/`,`/`'`/`-`,
וכיווץ רווחים. בלי זה `Agree Joey` ו-`AGREE JOEY` הם שני אנשים שונים.

### 0.4 `officerTitle` — לא שמיש לסינון

התפלגות אמיתית (247 שורות Quiver): `null` ×151, `Chief Executive Officer` ×17, `VP` ×17,
`Executive Chairman` ×7, `CEO` ×6, `Chief Operating Officer` ×6, `SVP` ×5,
`President and CEO` ×3, `President & CEO` ×3, `CEO & President` ×2.

**«מנכ״ל» מופיע בארבעה איותים שונים לפחות, ו-61% מהשורות בלי תפקיד כלל.**
אסור לסנן «רק מנכ״לים» לפי `officerTitle`, ואסור להציג אותו כמו שהוא — צריך `role_title` ידני ברוסטר.

---

## 1. מודל הזיהוי (Identity Model) — איך Quiver מזהה בכיר

### 1.1 Endpoints רלוונטיים ב-Trader

| Endpoint | Response schema | ניתן לשאול לפי אדם? |
|---|---|---|
| `/beta/live/insiders` | `Form4Response` → `Form4Entry[]` | ❌ **לא** |
| `/beta/historical/executivecompensation/{ticker}` | `HistoricalExecCompResponse` → `ExecCompEntry[]` | ❌ לפי ticker בלבד |
| `/beta/live/topshareholders/{ticker}` | `LiveTopShareholdersResponse` | ❌ לפי ticker בלבד |

**זה ה-endpoint היחיד לעסקאות בכירים בכל ה-spec.** חיפוש על `paths` בסכימה מחזיר `/beta/live/insiders`
ולא כלום אחר עם `insider`. אין `/beta/historical/insiders/{ticker}`, אין `/beta/bulk/insiders`.

### 1.2 Query params של `/beta/live/insiders` (מלא, מהסכימה)

| param | type | תיאור מהדוקס |
|---|---|---|
| `date` | `string` (date) | «Date, formatted as YYYYMMDD» |
| `limit_codes` | `boolean` | «Limit codes for form4 search» |
| `page` | `integer` | «Page number» |
| `page_size` | `integer` | «Items / page» |
| `ticker` | `string` | «Ticker for any given stock» |
| `uploaded` | `string` (date) | «Date the transaction was uploaded, formatted as YYYYMMDD» |

> 🔴 **אין `name`, אין `owner`, אין `cik`, אין `bioguide_id`-equivalent.**
> ההשוואה בולטת: לקונגרס יש `/beta/bulk/congresstrading?bioguide_id=`, ל-13F יש
> `/beta/live/sec13f?owner=`. **לבכירים אין שום פרמטר ברמת אדם.**
> המסקנה: **אפשר לשאול רק BY TICKER (או by date) — לעולם לא BY PERSON.**

### 1.3 שדות מזהי-אדם ב-`Form4Entry` (שמות שדה מדויקים)

| שדה | type | required | מה זה |
|---|---|---|---|
| `Name` | `string` | ✅ | «Name of transactor» — **המזהה היחיד של האדם** |
| `officerTitle` | `string` | — | «Corporate title of the transactor» |
| `isDirector` | `boolean` | — | «Whether the transactor is a director of the company» |
| `isOfficer` | `boolean` | — | «Whether the transactor is an officer of the company» |
| `isTenPercentOwner` | `boolean` | — | «Whether the transactor is a 10% owner of the company» |
| `isOther` | `boolean` | — | «The transactor is not a director, officer, or 10% owner» |
| `directOrIndirectOwnership` | `string` | — | «Ownership type ('D' or 'I')» |

שדות העסקה: `Ticker`, `Date` (transaction date, req), `AcquiredDisposedCode` (req),
`TransactionCode` (req), `Shares`, `PricePerShare`, `SharesOwnedFollowing`, `fileDate` (req), `uploaded`.

### 1.3b ✅ רשימת השדות האותנטית (live) מול מה ש-`QuiverInsiderRow` מצהיר

ה-probe מחזיר `fieldKeys: Object.keys(row).sort()` מהתשובה האמיתית. **הרשימה, מאומתת, 16 שדות בדיוק:**

```
AcquiredDisposedCode, Date, Name, PricePerShare, Shares, SharesOwnedFollowing,
Ticker, TransactionCode, directOrIndirectOwnership, fileDate,
isDirector, isOfficer, isOther, isTenPercentOwner, officerTitle, uploaded
```

**זהה למאה אחוז ל-`Form4Entry` בסכימה. אין שדה אחד מעבר.** פסק דין על שלוש ההצהרות שהאודיט חשד בהן:

| שדה ב-`QuiverInsiderRow` | קיים בתשובה החיה? | הוכחה |
|---|---|---|
| `TransactionDate` | 🔴 **לא קיים** | לא ב-`fieldKeys`; ה-probe מחזיר `TransactionDate: null` בכל 3 הדגימות |
| `Title` | 🔴 **לא קיים** | לא ב-`fieldKeys` |
| `AccessionNumber` | 🔴 **לא קיים** | לא ב-`fieldKeys`; `hasAccession: false` בכל הדגימות, בשתי הקריאות |
| `isOther` | ✅ **קיים** — והטיפוס שלנו **לא** מצהיר עליו | ב-`fieldKeys` |
| `isTenPercentOwner` | ✅ **קיים** — והטיפוס שלנו **לא** מצהיר עליו | ב-`fieldKeys` |
| `uploaded` | ✅ **קיים** — והטיפוס שלנו **לא** מצהיר עליו | ב-`fieldKeys` |

**הרשימה הסמכותית לשימוש (`QuiverInsiderRow` צריך להיות בדיוק זה):**

| שדה | type | הערה מאומתת |
|---|---|---|
| `Ticker` | `string` | 🔴 יכול להיות **המחרוזת `"N/A"`** — לא `null`. נצפה בפועל (`Nagpal Ankur`) |
| `Date` | `string` ISO | תאריך העסקה. פורמט אמיתי: `2026-09-16T00:00:00.000` (ללא `Z`) |
| `Name` | `string` | case לא עקבי — §0.3 |
| `AcquiredDisposedCode` | `string` | `A` / `D` |
| `TransactionCode` | `string` | §3 להלן |
| `Shares` | `number` | 🔴 **יכול להיות שברי** — נצפה `1523.944` |
| `PricePerShare` | `number` | 0 בהענקות/מתנות |
| `SharesOwnedFollowing` | `number` | 🔴 שברי גם כן — נצפה `51041.069` |
| `fileDate` | `string` ISO | פורמט אמיתי: `2026-09-17T19:59:35.000` — **עם שעה מדויקת** |
| `officerTitle` | `string \| null` | `null` ב-61% — §0.4 |
| `isDirector`, `isOfficer`, `isTenPercentOwner`, `isOther` | `boolean` | כולם קיימים בפועל |
| `directOrIndirectOwnership` | `string` | `D` / `I` |
| `uploaded` | `string` ISO | זמן הקליטה של Quiver |

> ⚠️ **באג נגזר:** `mapQuiverInsider` עושה `String(r.TransactionDate ?? r.Date ?? '')`.
> מכיוון ש-`TransactionDate` **תמיד לא קיים**, זה נופל ל-`Date` ועובד — **במקרה**.
> אבל `external_id` נבנה עם `r.AccessionNumber` אם קיים, ומכיוון שהוא **מעולם לא קיים**,
> ה-fallback (`quiver:ticker:date:name:shares:price`) הוא **תמיד** הנתיב שרץ.
> `Shares`/`PricePerShare` שבריים הופכים את המפתח לשביר. *(לא תיקנתי.)*

### 1.4 המסקנה הקריטית על ID

- **אין CIK** ב-`Form4Entry`. **אין `id`, אין `AccessionNumber`, אין slug.** בדקתי את כל 16 השדות.
- **אין שום מזהה יציב.** הריפו עצמו מודה בזה: `quiverQuant.ts` מגדיר
  `quiverInsiderRowKey()` עם ההערה «מפתח דה-דופ לשורת insider — **אין id יציב** בתשובה של Quiver»,
  ומרכיב מפתח מ-`Ticker|Name|Date|TransactionCode|Shares|PricePerShare|fileDate`.
- **היחיד ב-Quiver שיש לו `CIK` בהקשר בכירים הוא `ExecCompEntry`** (`CIK`, `Name`, `Role`, `Year`,
  `Salary`, `Bonus`, `StockAndOptionAwards`, `TotalCompensation`, `filerName`, `fileDate`, `uploaded`).
  אבל **האם ה-`CIK` שם הוא של האדם או של החברה — לא מאומת** (קיים גם `filerName`, מה שמרמז שזה
  CIK של החברה). גם אם זה CIK של אדם, **אין דרך לקשר אותו חזרה ל-`/beta/live/insiders`**, שם אין CIK כלל.

**שורה תחתונה:** רוסטר מובנה (curated) של בכירים **כן addressable, אבל רק בעקיפין** —
fan-out לפי `ticker` + התאמת string על `Name` בצד שלנו. אין ID, אין join key, אין endpoint לפי אדם.

### 1.5 מה `/beta/live/insiders` **לא** מחזיר (חשוב לסעיף 4)

השוואה מול מה שספק אחר (Unusual Whales) מחזיר על אותן שורות Form 4:

| מידע | Quiver `Form4Entry` | נדרש בשביל |
|---|---|---|
| 10b5-1 flag | ❌ **אין** | להבחין «מכירה מתוכננת» מ«מכירה יזומה» |
| `security_title` (Common / RSU / PSU / Phantom) | ❌ **אין** | לדעת אם `Shares` הן מניות או נגזר |
| person CIK | ❌ **אין** | זיהוי יציב |
| `shares_owned_before` | ❌ **אין** (יש רק `SharesOwnedFollowing`) | דלתא |
| `natureofownership` (By Trust / By Partnership) | ❌ **אין** (יש רק `D`/`I`) | הפרדת trust מהחזקה אישית |
| `formtype` (4 / 4/A / 144) | ❌ **אין** | לדעת אם זו הצהרת כוונה או עסקה |
| sector / marketcap | ❌ **אין** (מאושר ב-`QUIVER_API_AUDIT.md` §7) | הקשר |

זו **ההגבלה המרכזית** שקובעת את סעיף 4.

---

## 2. אימות חי — איך נתוני Form 4 נראים בפועל

> מקור: **Unusual Whales** (`get_insider_transactions`, `get_insider_activity_by_ticker`).
> **Quiver עצמו לא נשאל — לא מאומת.** המפתח לא הודפס ולא נחשף בשום שלב.

### 2.1 פורמט השם — הגלישה הכי מסוכנת במוצר

שמות Form 4 הם **שם חוקי, LAST FIRST [MIDDLE], באותיות גדולות** — ולא שם המותג המוכר:

| שם בציבור (מה שיופיע ב-UI) | ה-string האמיתי ב-Form 4 |
|---|---|
| Jensen Huang | `HUANG JEN HSUN` |
| Jim Farley | `FARLEY JR JAMES` |
| Jane Fraser | `FRASER JANE NIND` |
| Andy Jassy | `JASSY ANDREW` |
| Doug McMillon | `MCMILLON DOUGLAS` |
| Chris Kempczinski | `KEMPCZINSKI CHRISTOPHER` |
| Alex Karp | `KARP ALEXANDER` |
| Pat Gelsinger | `GELSINGER PATRICK` |

`HUANG JEN HSUN` הוא המקרה שממית כל התאמה נאיבית: אף חלק מ«Jensen Huang» לא מופיע בשם החוקי
מלבד שם המשפחה. `FARLEY JR JAMES` שם את הסופיקס **באמצע** ה-string.

### 2.2 דוגמה אמיתית מלאה — Jensen Huang / NVDA (15 השורות האחרונות)

| transaction_date | code | 10b5-1 | shares | price | shares_owned_after | ownership |
|---|---|---|---|---|---|---|
| 2026-06-17 | `F` | false | -45,723 | 207.41 | 70,146,252 | D |
| 2026-06-16 | `G` | false | -400,000 | 0.00 | 468,131,547 | I — By Trust |
| 2026-03-18 | `G` | false | -58,962,602 | 0.00 | 0 | I — By GRAT 2 |
| 2026-03-18 | `F` | false | -437,908 | 181.93 | 70,191,975 | D |
| 2026-03-18 | `G` | false | +58,962,602 | 0.00 | 109,040,602 | I — By Irrev. Remainder Trust |
| 2026-03-02 | `A` | false | +936,771 | 0.00 | 70,629,883 | D |
| 2025-12-18 | `J` | false | +9,639,142 | 0.00 | 521,735,113 | I — By Trust |
| 2025-12-18 | `J` | false | -49,489,560 | 0.00 | 0 | I — By Partnership |
| 2025-12-10 | `F` | false | -40,168 | 184.97 | 69,693,035 | D |
| 2025-10-29 | `S` | **true** | -25,000 | 207.91 | 69,733,203 | D |
| 2025-10-28 | `S` | **true** | -25,000 | 195.54 | 69,758,203 | D |
| 2025-10-27 | `S` | **true** | -25,000 | 190.73 | 69,783,203 | D |

**התפלגות קודים: `F`, `G`, `A`, `J`, `S` — ואף `P` אחד לא. אפס.**
`officerTitle` = `President and CEO`; `isOfficer`=true, `isDirector`=true, `isTenPercentOwner`=false.

### 2.3 מה זה אומר על הסינון `P`-only שלנו

`sync-insider-buys/index.ts` → `mapQuiverInsider()`:

```ts
if (code === 'S' || acquired === 'D') return null;
if (code && code !== 'P') return null;
```

**5 מתוך 6 הבכירים הבולטים שבדקתי הניבו 0 שורות ב-12 החודשים האחרונים** תחת הסינון הזה:

| בכיר | ticker | קודים שנצפו ב-12ח׳ | `P`? |
|---|---|---|---|
| HUANG JEN HSUN | NVDA | `F`,`G`,`A`,`J`,`S` | ❌ |
| COOK TIMOTHY | AAPL | `S`,`M`,`F` | ❌ |
| ZUCKERBERG MARK | META | `C`,`G` | ❌ |
| NADELLA SATYA | MSFT | `S`,`F`,`A`,`G` | ❌ |
| DIMON JAMES | JPM | `S`,`M`,`F`,`A`,`G` | ❌ |
| KARP ALEXANDER | PLTR | `C`,`M`,`S` | ❌ |
| **KHOSROWSHAHI DARA** | **UBER** | **`P`** (2026-09-10, 141,000 @ $70.96) | ✅ |

דגימה של רכישות `P` בקרב officers ב-S&P 500 מ-2026 מחזירה שורות כמו `MILLER JOSEPH` (VP & Controller,
Con Edison) שקנה **מניה אחת**, ו-`MARCUS JOEL` (ARE) שקנה 5,000. כלומר `P` אצל מגה-קאפ הוא
תופעה של דרג-ביניים ואירועים חד-פעמיים, לא של מנכ״לים.

### 2.4 עוד תופעות אמיתיות שחייבות טיפול

- **`PricePerShare` = 0** בכל grant / gift / conversion (`A`, `G`, `C`, `J`, ולרוב `M`).
  `mapQuiverInsider` מחשב `value: shares * price` → **`value = 0`**. בלי security title אין דרך
  לדעת אם 0 זה «מתנה» או «באג».
- **`SharesOwnedFollowing` הוא per-security-line, לא אחזקה כוללת.** אצל Huang אותו יום מחזיר
  גם `70,146,252` (D, common) וגם `468,131,547` (I, By Trust) — שתי שורות, שני מספרים, אותו אדם.
  **חיבור/שימוש בערך האחרון = מספר שקרי.** ב-Quiver אי אפשר להפריד כי אין `security_title`
  ואין `natureofownership`.
- **`M` (option/RSU exercise) בא בזוגות** — שורה `+` על ה-common ושורה `-` על ה-RSU (למשל
  Tim Cook 2026-04-01: `M +131,576` Common ו-`M -131,576` Restricted Stock Unit). בלי security title
  זה נראה כמו קנייה ומכירה של אותו נכס.
- **Form 144 מעורב בפידים**. UW מחזיר שורות עם `formtype: "144"` (McMillon/WMT, Narayen/ADBE,
  Gonzalez/ABBV, Narasimhan/SBUX). Quiver מצהיר `Form4Response` בלבד, **אבל אין ב-`Form4Entry`
  שדה `formtype`** — כלומר אם Quiver כן מכניס 144, אין לנו דרך לזהות. **לא מאומת.**
- **`officerTitle` לא מנורמל**: `President and CEO`, `Chair & CEO`, `COB and CEO`, `Executive Officer`,
  `ceo` (lowercase), `""` (מחרוזת ריקה — Thiel). לא ניתן לסנן «רק מנכ״לים» לפי השדה הזה.

### 2.5 ✅ סט קודי העסקה האמיתי של Quiver (מאומת)

היסטוגרמה מלאה מ-1000 שורות אמיתיות (כל השוק, 2026-09-16→17):

| `TransactionCode` | ספירה | % | משמעות (SEC Forms 3-4-5) | בטיפוס שלנו? |
|---|---|---|---|---|
| `S` | 461 | 46.1% | **Sale** — מכירה בשוק הפתוח | ✅ |
| `A` | 163 | 16.3% | **Award/Grant** — הענקה מהחברה (RSU/מניות), `PricePerShare=0` | ✅ |
| `M` | 117 | 11.7% | **Exercise/conversion** של אופציה או RSU לפי תנאי המכשיר | ✅ |
| `F` | 99 | 9.9% | **Tax withholding** — גריעת מניות לכיסוי מס. לא החלטת המחזיק | ✅ |
| `P` | 81 | 8.1% | **Purchase** — רכישה בשוק הפתוח. **הסיגנל האמיתי היחיד** | ✅ |
| `J` | 41 | 4.1% | **Other** — עסקה חריגה, מוסברת בהערת שוליים בלבד | 🔴 **חסר** |
| `D` | 14 | 1.4% | **Disposition to issuer** — החזרה לחברה | ✅ |
| `G` | 14 | 1.4% | **Gift** — מתנה/העברה לנאמנות או צדקה, `PricePerShare=0` | ✅ |
| `C` | 9 | 0.9% | **Conversion** של נייר נגזר | 🔴 **חסר** |
| `X` | 1 | 0.1% | **Exercise of in-the-money/at-the-money option** | 🔴 **חסר** |

**הטיפוס הקיים:** `'P'|'S'|'A'|'M'|'G'|'F'|'O'|'D'`.

- 🔴 **חסרים ונצפו בפועל ב-Quiver: `J` (41), `C` (9), `X` (1).** ביחד ~5% מהשורות.
- 🔴 **`I`** — לא נצפה ב-1000 השורות האלה, **אבל נצפה ב-Form 4 אמיתי של Arvind Krishna/IBM**
  (discretionary transaction, Phantom Stock). חייב להיכלל.
- ⚠️ **`O`** מוצהר בטיפוס שלנו אבל **לא נצפה** באף שורה. **לא מאומת** שהוא קיים בכלל.

**הסט המלא שחייבים לתמוך בו** (10 שנצפו + `I`):
`P`, `S`, `A`, `M`, `F`, `G`, `J`, `C`, `D`, `X`, `I`.
ולקודים שלא נצפו ב-Form 4 אבל מוגדרים ב-SEC (`H`, `L`, `U`, `W`, `Z`, `E`, `K`)
עדיף `CHECK` פתוח + עמודה `transaction_code_raw` מאשר לזרוק שורות.

### 2.6 ✅ הוכחה בפרודקשן: הסינון `P`-only מוציא את כל הרוסטר

שאילתה על `dark_pool_insider_buys` (REST, anon key) — נתוני פרודקשן אמיתיים:

| שאילתה | תוצאה |
|---|---|
| `source='quiverquant'` — סה״כ שורות | **247** |
| התפלגות `transaction_type` | **`{'P': 247}`** — 100% `P`, שום קוד אחר |
| השורה הטרייה ביותר | `filed_at = 2026-09-17` (ADAG, ACNB, ADC) — **ה-sync עובד ומעודכן** |
| `source='quiverquant'` **AND** `ticker` ב-39 טיקרי הרוסטר | 🔴 **0 שורות** |

**המשמעות:** ה-sync בריא ורץ, ובכל זאת **אף אחד מ-39 הטיקרים של הרוסטר לא ייצר אפילו שורה אחת**.
זו לא תיאוריה — זה מצב הפרודקשן. הטיקרים שכן נקלטים הם `AAT`, `ACNB`, `ADAG`, `ADC` —
small/mid-cap שבהם בכירים כן קונים בשוק הפתוח. **`P`-only הוא פילטר שמסנן בדיוק את 40 השמות שביקשנו.**

---

## 3. טבלת רזולוציה — 40 השמות

> 🔴 **אזהרת provenance — קריטית לקריאת הטבלה הזו.**
> עמודות `Name string` / `CIK` / `Last activity` / `Code` מקורן ב-**Unusual Whales** (Form 4 אמיתי).
> **אף אחת מ-39 המחרוזות בטבלה לא אומתה מול Quiver** — ראה §0.2 (אין ערוץ מותקן עם `?ticker=`).
> ו-§0.3 **הוכיח שהפורמטים של שני הספקים נבדלים בפועל**: UW מחזיר תמיד UPPERCASE,
> **Quiver מחזיר Title-Case ב-80% מהמקרים**.
> לכן נכון להתייחס לעמודה הזו כ**שם חוקי קנוני לזיהוי האדם** — ולא כ-string לביצוע exact-match.
> **אסור לגזור ממנה `form4_name_exact` ולנעול pin.** ראה §5.4 לתהליך האימות הנדרש.

| # | שם בציבור | Ticker | `Name` string (Form 4) | person CIK | Role status | Last activity | Code | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | Jensen Huang | NVDA | `HUANG JEN HSUN` | 0001197649 | מכהן | 2026-06-17 | F | ✅ שוטף, ללא `P` |
| 2 | Tim Cook | AAPL | `COOK TIMOTHY` | 0001214156 | מכהן | 2026-04-02 | S (10b5-1) | ✅ שוטף, ללא `P` |
| 3 | Mark Zuckerberg | META | `ZUCKERBERG MARK` | 0001548760 | מכהן | 2026-07-31 | C/G | ✅ שוטף, ברובו מתנות |
| 4 | Satya Nadella | MSFT | `NADELLA SATYA` | 0001513142 | מכהן | 2026-09-01 | S (10b5-1) | ✅ שוטף, ללא `P` |
| 5 | Sundar Pichai | GOOGL | `PICHAI SUNDAR` | 0001534753 | מכהן | 2026-09-14 | A | ✅ שוטף (GSU grants) |
| 6 | Jamie Dimon | JPM | `DIMON JAMES` | 0001195345 | מכהן | 2026-04-15 | S (10b5-1) | ✅ שוטף |
| 7 | David Solomon | GS | `SOLOMON DAVID` | 0001693709 | מכהן | 2026-05-01 | S | ✅ שוטף |
| 8 | Lisa Su | AMD | `SU LISA` | 0001405109 | מכהן | 2026-09-10 | G | ✅ שוטף |
| 9 | Brian Armstrong | COIN | `ARMSTRONG BRIAN` | 0001851492 | מכהן | 2026-01-05 | S (10b5-1) | ⚠️ ראה failure mode §3.2 |
| 10 | Andy Jassy | AMZN | `JASSY ANDREW` | 0001374545 | מכהן | 2026-08-21 | M | ✅ שוטף |
| 11 | Marc Benioff | CRM | `BENIOFF MARC` | 0001294693 | מכהן | 2026-04-22 | F | ✅ שוטף |
| 12 | Alex Karp | PLTR | `KARP ALEXANDER` | 0001823951 | מכהן | 2026-08-20 | C/M/S | ✅ שוטף, נפח גבוה |
| 13 | Brian Chesky | ABNB | `CHESKY BRIAN` | 0001834152 | מכהן | 2026-08-28 | C (`4/A`) | ✅ שוטף |
| 14 | Dara Khosrowshahi | UBER | `KHOSROWSHAHI DARA` | 0001184237 | מכהן | 2026-09-10 | **`P`** | ✅ **רכישה אמיתית** |
| 15 | Michael Dell | DELL | `DELL MICHAEL` | לא מאומת¹ | מכהן | 2025-10-09 | S | ✅ נפח גדול, תדירות נמוכה |
| 16 | Mary Barra | GM | `BARRA MARY` | 0001492154 | מכהן | 2026-07-28 | S (10b5-1) | ✅ שוטף |
| 17 | Doug McMillon | WMT | `MCMILLON DOUGLAS` | 0001335782 | לא מאומת² | 2026-06-25 | S (**form 144**) | ⚠️ סטטוס לא מאומת |
| 18 | Jane Fraser | C | `FRASER JANE NIND` | 0001644491 | מכהנת | 2026-02-20 | A | ✅ שוטף |
| 19 | Arvind Krishna | IBM | `KRISHNA ARVIND` | 0001629898 | מכהן | 2026-08-27 | I (Phantom) | ⚠️ ברובו phantom stock |
| 20 | Peter Thiel | PLTR | `THIEL PETER` | 0001211060 | **director בלבד** | 2026-03-02 | S (10b5-1) | ⚠️ לא officer; `officerTitle=""` |
| 21 | Hock Tan | AVGO | `TAN HOCK` | 0001211588 | מכהן | 2026-04-08 | G | ✅ שוטף |
| 22 | Safra Catz | ORCL | `CATZ SAFRA` | 0001205005 | לא מאומת³ | 2025-10-23 | A | ⚠️ נתון בן שנה |
| 23 | Shantanu Narayen | ADBE | `NARAYEN SHANTANU` | 0001224154 | מכהן | 2026-09-16 | S (**form 144**) | ✅ שוטף |
| 24 | Chuck Robbins | CSCO | `ROBBINS CHARLES` | 0001559655 | מכהן | 2026-08-14 | S (10b5-1) | ✅ שוטף |
| 25 | Brian Cornell | TGT | `CORNELL BRIAN` | 0001288709 | **לא מנכ״ל**⁴ | 2026-08-25 | S | ⚠️ `officerTitle`=«Executive Officer» |
| 26 | Jim Farley | F | `FARLEY JR JAMES` | 0001415834 | מכהן | 2026-03-04 | F | ✅ שוטף |
| 27 | Albert Bourla | PFE | `BOURLA ALBERT` | 0001595703 | מכהן | 2026-09-15 | A (Phantom SSP) | ⚠️ ברובו phantom |
| 28 | Richard Gonzalez | ABBV | `GONZALEZ RICHARD` | 0001239127 | **פרש מתפקיד** | 2025-08-22 | S (**form 144**) | 🔴 אין flow חדש |
| 29 | David Ricks | LLY | `RICKS DAVID` | 0001538604 | מכהן | 2026-02-09 | A | ✅ שוטף |
| 30 | Charles Scharf | WFC | `SCHARF CHARLES` | 0001195358 | מכהן | 2026-03-05 | M | ✅ שוטף |
| 31 | Brian Moynihan | BAC | `MOYNIHAN BRIAN` | 0001195071 | מכהן | 2026-08-15 | M | ✅ שוטף |
| 32 | Ryan McInerney | V | `MCINERNEY RYAN` | 0001578261 | מכהן | 2026-09-01 | S (10b5-1) | ✅ שוטף |
| 33 | Laxman Narasimhan | SBUX | `NARASIMHAN LAXMAN` | 0001620455 | **פרש** | 2024-11-11 | S (**form 144**) | 🔴 ~2 שנים ללא דיווח |
| 34 | Chris Kempczinski | MCD | `KEMPCZINSKI CHRISTOPHER` | 0001598115 | מכהן | 2026-02-13 | M | ✅ שוטף |
| 35 | Cristiano Amon | QCOM | `AMON CRISTIANO` | 0001559665 | מכהן | 2026-05-05 | S (10b5-1) | ✅ שוטף |
| 36 | Carlos Tavares | STLA | **not found** | — | **פרש** | — | — | 🔴 **אין Form 4 כלל** |
| 37 | Ed Bastian | DAL | `BASTIAN EDWARD` | 0001289878 | מכהן | 2026-08-04 | M | ✅ שוטף |
| 38 | Scott Kirby | UAL | `KIRBY SCOTT` | 0001249555 | מכהן | 2026-07-25 | A | ✅ שוטף |
| 39 | Michael Miebach | MA | `MIEBACH MICHAEL` | 0001771933 | מכהן | 2026-08-05 | S (10b5-1) | ✅ שוטף |
| 40 | Pat Gelsinger | INTC | `GELSINGER PATRICK` | 0001316331 | **פרש** (Dec 2024) | 2024-11-04 | **`P`** | 🔴 היסטורי בלבד |

**הערות:**
1. `DELL MICHAEL` — בשורה שהתקבלה `reporter_cik` היה `null`. ה-CIK קיים במקום אחר אך **לא מאומת** באימות הזה.
2. `MCMILLON DOUGLAS` — הדיווח האחרון הוא Form 144, ו-`is_officer=false`/`officer_title=null` באותה שורה.
   סטטוס התפקיד הנוכחי שלו ב-Walmart: **לא מאומת** באימות הזה.
3. `CATZ SAFRA` — הדיווח האחרון שנמצא הוא 2025-10-23. סטטוס תפקיד נוכחי: **לא מאומת**.
4. `CORNELL BRIAN` — `officerTitle` הוא «Executive Officer» ולא «CEO». אין תמיכה בשדה להבחנה בין
   Executive Chair למנכ״ל. סטטוס מדויק: **לא מאומת**.

### 3.1 חיפוש Carlos Tavares / Stellantis — התוצאה השלילית

חיפוש `owner_name=TAVARES` ללא סינון ticker מחזיר **`TAVARES CRAIG` ב-HIVE** — לא Carlos Tavares.
חיפוש `ticker=STLA` מחזיר שורות `formtype: 144` מאנשים לא-officer (`GENOVESE MONICA`, `LARANJO JOAO`)
עם `is_officer=false`, `is_director=false`, `is_s_p_500=false`.

**מאושר:** Stellantis רשומה בארה״ב כ-foreign private issuer. **בכירים ב-foreign private issuers
פטורים מ-Section 16 ולכן לא מגישים Form 4.** אין ולא יהיה נתון על Tavares. **פסול מהרוסטר.**

### 3.2 חוק ההתאמה (matching rule) ו-failure modes

**החוק המוצע (2 שלבים, curated-first):**

```
normalize(s):                       # כל הרכיבים חויבו ע"י ממצאים מאומתים ב-§0.3
  s.toUpperCase()                   # 80% מהשורות Title-Case, 20% UPPERCASE
   .replace(/[.,'"]/g, '')          # 'Ackerman Jonathan Z.'  'O'Dowd William IV'
   .replace(/-/g, ' ')              # 'A-6684 Ltd.'
   .replace(/\b(JR|SR|II|III|IV|DR)\b/g, '')   # 'PRICE BILLY L JR DR'
   .replace(/\s+/g, ' ').trim()

STEP 1 — Curated pin (חובה)
  לכל אדם ברוסטר נשמר seed ידני:
    { ticker, form4_name_exact, aliases[], display_name_he, display_name_en }
  ההתאמה:  normalize(row.Name) === normalize(seed.form4_name_exact)
            AND normalize_ticker(row.Ticker) === seed.ticker

STEP 0 — Guard rails (לפני כל התאמה)
  דחה שורה אם row.Ticker === 'N/A'            # נצפה בפועל, מחרוזת ולא null
  דחה שורה אם היא ישות ולא אדם:
    row.isOther === true  ||  /\b(LLC|L\.L\.C|INC|LTD|LP|CO|HOLDINGS|CAPITAL|TRUST|FUND|PARTNERS)\b/
    # נצפו בפועל: 'CASCADE INVESTMENT, L.L.C.', 'DONEGAL MUTUAL INSURANCE CO',
    #             'ADAR1 Capital Management, LLC', 'A-6684 Ltd.'

STEP 2 — Candidate detection (לא לתצוגה — להתראה בלוג בלבד)
  אם normalize(row.Name) מכיל את seed.surname AND row.Ticker === seed.ticker
  אבל אין exact match → לוג «roster_name_drift» + דורש אישור אנושי.
  לעולם לא לשייך אוטומטית.
```

**למה exact-match ולא fuzzy:** fuzzy על שם משפחה + ticker נכשל בצורה שקטה ומזיקה.

| Failure mode | דוגמה אמיתית שנצפתה | הנזק |
|---|---|---|
| **התנגשות שם משפחה באותה חברה** | `owner_name=ARMSTRONG` ב-COIN החזיר `ARMSTRONG ANTHONY` (director, CIK 0002149908) ולא את `ARMSTRONG BRIAN` (CIK 0001851492) | נתונים של אדם אחר מוצגים תחת שם המנכ״ל |
| **שם מותג ≠ שם חוקי** | «Jensen Huang» מול `HUANG JEN HSUN` | אין התאמה כלל → הפרופיל ריק |
| **middle name בתוך ה-string** | `FRASER JANE NIND` | exact match על «FRASER JANE» נכשל |
| **סופיקס באמצע** | `FARLEY JR JAMES` | כל היוריסטיקה של «LAST FIRST» נכשלת |
| **אותו אדם, שני tickers** | `THIEL PETER` הוא director ב-PLTR וגם reporter בחברות אחרות | fan-out ללא pin על ticker מערבב חברות |
| **`officerTitle` לא מנורמל / ריק** | `""` (Thiel), `ceo` (Narasimhan), `Executive Officer` (Cornell) | אי אפשר לסנן לפי תפקיד |
| 🔴 **case לא עקבי אצל Quiver** | `Agree Joey` (Title) מול `CHEN THOMAS C` (UPPER) — **80%/20% ב-165 מחרוזות אמיתיות** | exact-match ללא `toUpperCase()` מפספס 4 מכל 5 שורות |
| 🔴 **`Ticker` = `"N/A"` כמחרוזת** | `Nagpal Ankur`, code `P`, `Ticker: "N/A"` — נצפה ב-Quiver live | התאמה על ticker מקבלת `"N/A"` כטיקר חוקי |
| 🔴 **ישויות מעורבות באנשים** | `CASCADE INVESTMENT, L.L.C.`, `DONEGAL MUTUAL INSURANCE CO` ב-`Name` | «אדם» ברוסטר עלול להתאים לתאגיד |
| 🔴 **`officerTitle = null` ב-61%** | 151 מתוך 247 שורות Quiver | אי אפשר לאמת תפקיד, אי אפשר לסנן לפי תפקיד |
| ⚠️ **`Shares` שבריים** | `1523.944`, `SharesOwnedFollowing: 51041.069` | מפתח דה-דופ שמשרשר `Shares` שביר לשינויי עיגול |
| **שינוי conformed name ב-EDGAR** | לא נצפה באימות הזה — **לא מאומת** | pin נשבר בשקט → STEP 2 קיים בדיוק בשבילו |

**הערה קריטית על אחזור ה-seed:** אי אפשר לגזור את `form4_name_exact` מהשם בעברית/אנגלית המוכר.
חייבים **אימות ידני חד-פעמי per person** (מול Form 4 אמיתי או EDGAR), ואז לנעול את ה-string.

---

## 4. מה מותר להציג בכבוד — Honesty Audit

### 4.1 פריט-פריט

| מה שרוצים להציג | חישובי מ-Quiver לבד? | הערכה |
|---|---|---|
| **Transaction list** (shares, price, date) | ✅ כן — `Shares`, `PricePerShare`, `Date`, `fileDate` | ✅ **אמת.** הבסיס היחיד שאפשר לסמוך עליו |
| **$ value per transaction** | ⚠️ `Shares × PricePerShare` בלבד | ⚠️ **מטעה בחלק מהמקרים.** `PricePerShare=0` בכל `A`/`G`/`C`/`J` → value=0. חייב להסתיר, לא להציג «$0» |
| **Buy vs Sell** | ✅ `TransactionCode` + `AcquiredDisposedCode` | ✅ אמת — **אם** מציגים את הקוד המלא ולא ממפים הכול ל«קנייה/מכירה» |
| **הבחנה option-exercise / grant / gift** | ✅ `TransactionCode` = `M`/`A`/`G` | ✅ אמת ו**חובה**. זה 80% מהזרימה |
| **הבחנה 10b5-1 (מכירה מתוכננת)** | ❌ **אין שדה** | 🔴 **לא ניתן.** `is_10b5_plan` נשאר `null` בנתיב Quiver |
| **Cumulative holdings בחברה שלו** | ❌ | 🔴 **לא ניתן בכבוד.** `SharesOwnedFollowing` הוא per-security-line; בלי `security_title` ובלי `natureofownership` אי אפשר להפריד common מ-RSU ו-D מ-I. Huang: 70M (D) מול 468M (By Trust) באותו יום |
| **% ownership** | ❌ | 🔴 **לא ניתן.** אין shares outstanding ב-Quiver, ואין אחזקה אמינה במונה |
| **Portfolio value** | ❌ | 🔴 **חסר משמעות.** ראה §4.2 |
| **Performance / returns** | ❌ | 🔴 **חסר משמעות ומטעה.** ראה §4.2 |

> ניתן לשקול `/beta/live/topshareholders/{ticker}` (`ownership[]` = `owner_name`, `owner_title`, `shares`)
> כמקור לאחזקה כוללת. **אבל:** אין בו תאריך, אין security class, אין הגדרה מה נכנס ל-`shares`,
> ואין דרך לדעת אם הוא כולל trusts. **לא מאומת — אסור לבנות עליו מספר אחזקה לפני בדיקה חיה.**

### 4.2 האם «תשואה» או «שווי תיק» אומרים משהו על מנכ״ל?

**לא. ההיפך — זה מטעה אקטיבית.**

הזרימה של מנכ״ל בפועל, כמו שראינו בנתונים:

1. **`A` — grant.** החברה מנפיקה לו מניות. `PricePerShare=0`. זה **שכר**, לא החלטת השקעה.
2. **`M` — exercise/vesting.** RSU הופכת למניה. שתי שורות נגדיות. זה **לוח הבשלה**, לא תזמון שוק.
3. **`F` — tax withholding.** החברה גורעת מניות לכיסוי מס. **המנכ״ל לא בחר בכלום.**
4. **`S` — sale.** לרוב `is_10b5_1 = true` (Cook, Nadella, Dimon, Barra, Robbins, Amon, McInerney,
   Miebach, Armstrong) — **הוגדרה מראש, חודשים קודם, לא קשורה לדעה על המחיר היום.**
5. **`G` — gift.** העברה לצדקה/נאמנות. Huang העביר 400,000 מניות ב-`price=0`.
6. **`C`/`J` — conversion / other.** ארגון מחדש בין trusts. Zuckerberg: אותן 591,690 מניות
   יוצאות ונכנסות באותו יום בין ישויות — **אפס שינוי בחשיפה**.

לחשב «תשואה» מזרימה כזו זה למדוד את **מדיניות התגמול של החברה ואת לוח המס של האדם** — ולהציג
את זה למשתמש קצה כ«ביצועי השקעה». בנוסף:

- **אין דיברסיפיקציה מהגדרה.** «התיק» הוא טיקר אחד. תשואה של «התיק» = תשואת המניה.
  זה מחזיר נתון שהמשתמש יכול לקבל מגרף המניה, עטוף בתווית שמרמזת על מיומנות.
- **המכנה לא ידוע.** אנחנו רואים עסקאות ב-NVDA בלבד. אין לנו מושג מה עוד Huang מחזיק.
  «שווי תיק» של אדם שאנחנו רואים 5% מהעושר שלו הוא מספר שרירותי.
- **grants מייצרים «תשואה» פיקטיבית אינסופית.** קיבל ב-0, המניה ב-$200 → ROI אינסופי.
  זה לא תשואה, זה תגמול.

### 4.3 🔴 האזהרה על ה-Leaderboard

**אסור לערבב בכירים לתוך אותו leaderboard של «תיקים» עם פוליטיקאים או מנהלי קרנות.**

| קבוצה | מקור | מה המספר מייצג |
|---|---|---|
| Politicians | STOCK Act / PTR | החלטות **בחירה** בין נכסים מרובים — דומה לתיק |
| Fund managers | 13F | החזקות מרובות ברמת תיק — תיק |
| **Executives** | **Form 4** | **תגמול + לוח מס במניה אחת — לא תיק** |

דירוג משולב ישאל «למי התשואה הגבוהה» ויענה עם שלושה סוגי מספרים שאינם ברי-השוואה.
הבכירים ינצחו או יפסידו לפי מה שהטיקר שלהם עשה, ותווית «תשואה» תרמוז שזו מיומנות.
זה חשיפה רגולטורית ומוצרית ממשית באפליקציית קמעונאות.

### 4.4 המושג המומלץ ל-UI (לא «פרופיל תיק»)

**«יומן פעולות בכיר» / Insider Activity Timeline** — ישות UI **שונה** מ«פרופיל תיק».

מה כן נכנס:

| רכיב | תוכן | מקור |
|---|---|---|
| Hero | שם + תפקיד (`officerTitle`) + לוגו החברה + **badge של טיקר בודד** | curated + `officerTitle` |
| Banner | «הנתונים מתייחסים למניות **החברה שהאדם מכהן בה בלבד** — לא תיק השקעות» | טקסט קבוע |
| Timeline | פעולה-אחר-פעולה: תאריך, **תווית קוד מפורשת**, מניות, מחיר (מוסתר אם 0) | `Form4Entry` |
| Code legend | «הענקה» / «מימוש אופציה» / «גריעת מס» / «מכירה» / «מתנה» / «רכישה מהשוק» | `TransactionCode` |
| Buy/Sell badge | `AcquiredDisposedCode` + הבחנה D/I | `AcquiredDisposedCode`, `directOrIndirectOwnership` |
| Signal highlight | **`P` בלבד** — «רכישה מהשוק הפתוח» עם הדגשה חזקה. זה הסיגנל האמיתי היחיד | `TransactionCode='P'` |
| Attribution | «מקור: SEC Form 4 דרך Quiver Quant» + freshness | `QuiverAttribution.tsx` |

מה **לא** נכנס: גרף שווי תיק, אחוז תשואה, % ownership, pie של הקצאה, מקום ב-leaderboard תשואות,
כל השוואה ישירה לפוליטיקאי/קרן.

מה אפשר להוסיף בזהירות: **מונה נטו לפי קוד** («12 חודשים: 3 הענקות, 2 מימושים, 8 מכירות מתוכננות,
0 רכישות מהשוק»). זה תיאורי, מדיד, וכן — ובדיוק המידע שמשתמש קמעונאי צריך כדי להבין שאין פה סיגנל.

**Leaderboard חלופי שכן כשר לקבוצה הזו:** «רכישות בכירים מהשוק הפתוח» — מסונן `P` בלבד,
חתוך ב-30 יום, ממוין לפי `Shares × PricePerShare`. אבל אז מתוך 40 הרוסטר יופיע אדם אחד
(Khosrowshahi) — כלומר ה-leaderboard הזה חייב להיות **market-wide**, לא roster-based.

---

## 5. פסק דין כיסוי + הערות בנייה

### 5.1 כמה מה-40 באמת שמישים

| קטגוריה | ספירה | מי |
|---|---|---|
| נמצאו ב-Form 4 עם `Name` string מזוהה | **39 / 40** | כולם חוץ מ-Tavares |
| **פסולים לחלוטין** | **1** | Tavares (STLA — foreign private issuer, אין Form 4) |
| **היסטורי בלבד — אין flow חדש** | **3** | Gelsinger (INTC, 2024-11), Narasimhan (SBUX, 2024-11), Gonzalez (ABBV, 2025-08) |
| **סטטוס לא מאומת / נתון מתיישן** | **3** | McMillon (WMT), Catz (ORCL, 2025-10), Cornell (TGT — לא מנכ״ל) |
| **שמישים עם זרימת Form 4 פעילה** | **✅ 33** | היתר |
| מתוכם עם **רכישה `P` אמיתית** אחרונה | **1** | Khosrowshahi (UBER) |
| **שמישים תחת ה-sync הקיים (`P`-only)** | **🔴 1** | Khosrowshahi בלבד |

> **המספר הקובע: 33 מתוך 40 שמישים ל-UI של «יומן פעולות». 1 מתוך 40 שמיש תחת הקוד הקיים.**
> הפער הזה הוא כל הסיפור — הבעיה היא לא כיסוי ה-API אלא **סינון `P`-only** בצד שלנו.

### 5.2 עיצוב ה-Sync — fan-out מול bulk

| אופציה | קריאות / רענון | יתרון | חיסרון |
|---|---|---|---|
| **A — bulk (מה שקיים)** | 1 (`uploaded=YYYYMMDD`, `page_size=500`) | זול; תופס כל השוק | הרוסטר מופיע רק כשהוא מדווח באותו יום; 500 שורות/יום ל**כל** השוק עלולות לחתוך; אין backfill |
| **B — by-ticker fan-out** | **33** (`?ticker=X&page_size=200`) | דטרמיניסטי per-person; backfill היסטורי; דיוק גבוה | ×33 קריאות; היקף ה-history של `live/insiders` לכל ticker **לא מאומת** |
| **C — היברידי (מומלץ)** | 1 + 33 | bulk לפיד הכללי; fan-out לרוסטר | שני נתיבים לתחזק |

**המלצה: C.** bulk יומי לפיד הרחב + fan-out לרוסטר ב**תדירות נמוכה** (1×/יום מספיק — Form 4
מוגש עד יומיים אחרי העסקה; אין ערך ב-3×/יום).

**עלות בפועל (אופציה C, 1×/יום):** `1 + 33 = 34` קריאות/יום ≈ **238 קריאות/שבוע**.
לשם השוואה, ה-cron הנוכחי עושה 17 קריאות/שבוע ל-`/beta/live/insiders`.
**Rate limits של Quiver: לא מאומת** — האודיט קובע שאין להם אזכור לא ב-OpenAPI spec ולא בעמוד התמחור.
ה-`delay(120)` שבקוד הוא הגנה שלנו. עם 33 קריאות רצופות × 120ms ≈ 4 שניות — בטוח ל-Edge Function.

### 5.2b חמש השאלות הפתוחות — סטטוס לאחר האימות החי

| # | שאלה | סטטוס | תשובה |
|---|---|---|---|
| 1 | **`?ticker=` — היסטוריה או חלון recent?** | 🔴 **לא מאומת** | **חסום.** `fetchQuiverLiveInsiders` לא שולחת `ticker` אף פעם, ואין ערוץ מותקן אחר (§0.2). לאמת את זה דורש שינוי קוד פרודקשן. **זו השאלה החוסמת מספר 1.** |
| 2 | **`page_size` מקסימלי בפועל** | ✅ **מאומת חלקית** | `page_size=1000` עבד והחזיר `count=1000` — כלומר **נחסמנו ב-cap שלנו** (`Math.min(…,1000)` ב-`quiverQuant.ts`), לא בשרת. **התקרה האמיתית של Quiver: לא מאומת** (גבוהה מ-1000 או שווה לו). |
| 3 | **`Name` המדויק ל-33 הבכירים** | 🔴 **לא מאומת** | חסום מאותה סיבה. **מה שכן אומת:** הפורמט הכללי — `Last First`, case לא עקבי (§0.3). |
| 4 | **האם Quiver מכניס Form 144?** | ✅ **כנראה לא** | ב-1000 שורות, כל הקודים תקפים ל-Form 4 (`S,A,M,F,P,J,D,G,C,X`). אין `formtype` בתשובה, אבל התפלגות הקודים עקבית עם Form 4 בלבד. **UW כן מחזיר `formtype:"144"`, Quiver כנראה לא** — מה שהופך את Quiver ל**נקי יותר** בנקודה הזו. ודאות מלאה: לא מאומת. |
| 5 | **`topshareholders/{ticker}` — מכיל בכירים?** | 🔴 **לא מאומת** | אין פונקציה מותקנת שקוראת ל-`/beta/live/topshareholders/{ticker}` בכלל (`rg` על כל `supabase/functions` — אין קורא). לא נגיש דרך הערוץ הזה. |

**מה שנפתח מעבר לחמש השאלות (בונוס מאומת):** רשימת השדות האותנטית (§1.3b),
סט קודי העסקה המלא (§2.5), פורמט `Name` (§0.3), התפלגות `officerTitle` (§0.4),
וההוכחה בפרודקשן ש-`P`-only מסנן את כל הרוסטר (§2.6).

### 5.3 עמודות DB נדרשות

**חדש — טבלת רוסטר `darkpool_executive_roster`:**

| column | type | הערה |
|---|---|---|
| `id` | uuid PK | |
| `ticker` | text NOT NULL | pin — חלק ממפתח ההתאמה |
| `form4_name_exact` | text NOT NULL | ה-string המאומת ידנית מ-`Form4Entry.Name` |
| `name_aliases` | text[] | שמות חלופיים שאושרו ידנית |
| `display_name_he` / `display_name_en` | text | «ג'נסן הואנג» / «Jensen Huang» — **נפרד** מ-`form4_name_exact` (`HUANG JEN HSUN`) |
| `role_title` | text | תפקיד לתצוגה, מנורמל ידנית (`officerTitle` לא מנורמל) |
| `role_status` | text CHECK (`active`,`departed`,`unverified`) | Gelsinger/Narasimhan/Gonzalez = `departed` |
| `person_cik` | text NULL | **אין ב-Quiver.** למילוי ממקור אחר; nullable |
| `is_addressable` | boolean | false ל-Tavares |
| `last_verified_at` | timestamptz | מתי אומת ה-name string |

**הרחבות ל-`dark_pool_insider_buys`** (נגזר משדות `Form4Entry` שכיום נזרקים — מאושר ב-`QUIVER_API_AUDIT.md` §6.2):

| column | מקור | למה נדרש |
|---|---|---|
| `is_director` | `Form4Entry.isDirector` | להבחין director מ-officer (Thiel) |
| `is_officer` | `Form4Entry.isOfficer` | כנ״ל |
| `is_ten_percent_owner` | `Form4Entry.isTenPercentOwner` | «10% owner» ≠ «CEO» |
| `is_other` | `Form4Entry.isOther` | שלמות |
| `ownership_type` | `Form4Entry.directOrIndirectOwnership` (`D`/`I`) | **קריטי** — trust מול אישי |
| `uploaded_at` | `Form4Entry.uploaded` | freshness אמיתי ל-`QuiverAttribution` |
| `roster_person_id` | FK ל-`darkpool_executive_roster` | קישור מפורש במקום התאמת string בזמן קריאה |
| `acquired_disposed_code` | `Form4Entry.AcquiredDisposedCode` | כרגע לסינון בלבד, לא נשמר |

**שינוי סכימה נדרש (מאומת מול Quiver — §2.5):** `transaction_type` חייב לקבל לפחות
`J`, `C`, `X` (נצפו ב-Quiver live: 41 / 9 / 1 מתוך 1000) ו-`I` (נצפה ב-Form 4 של Krishna/IBM).
**כרגע ה-type בקוד `'P'|'S'|'A'|'M'|'G'|'F'|'O'|'D'`** — ו-`O` דווקא **לא נצפה בכלל**.
המלצה: `transaction_code_raw TEXT` ללא `CHECK` + עמודה נגזרת `transaction_kind` ממופה
(§5.5), כדי שקוד לא מוכר **לא יפיל שורה**.

**מה שאי אפשר למלא מ-Quiver** (ויישאר `null` — לא להציג UI שתלוי בזה):
`is_10b5_plan`, `security_title`, `shares_owned_before`, `natureofownership`, `formtype`,
`insider_cik`, `sector`, `marketcap`, `return_1d`…`return_6m`, `% ownership`.

### 5.4 טבלת ה-pin — 33 הבכירים השמישים

**חוק ההתאמה לכל שורה בטבלה** (זהה לכולם):

```
match(row) := normalize(row.Name) === normalize(pin.form4_name_exact)
              AND upper(trim(row.Ticker)) === pin.ticker
              AND STEP 0 guard rails עברו (§3.2)
```

**סטטוס אימות — חשוב:** עמודת `form4_name_exact (candidate)` היא **מועמד בלבד**, ממקור UW.
**אף שורה אינה `verified` מול Quiver.** `last_verified_at` נשאר `NULL` לכולן עד שלב האימות ב-§5.5b.

| # | display_name_en | ticker | `form4_name_exact` (candidate — **לא מאומת מול Quiver**) | Quiver status | סיכון התנגשות באותו ticker |
|---|---|---|---|---|---|
| 1 | Jensen Huang | NVDA | `HUANG JEN HSUN` | ⬜ unverified | ⚠️ **גבוה** — «Jensen» לא במחרוזת כלל |
| 2 | Tim Cook | AAPL | `COOK TIMOTHY` | ⬜ unverified | נמוך |
| 3 | Mark Zuckerberg | META | `ZUCKERBERG MARK` | ⬜ unverified | נמוך |
| 4 | Satya Nadella | MSFT | `NADELLA SATYA` | ⬜ unverified | נמוך |
| 5 | Sundar Pichai | GOOGL | `PICHAI SUNDAR` | ⬜ unverified | ⚠️ גם `GOOG` — שני טיקרים לאותו מדווח |
| 6 | Jamie Dimon | JPM | `DIMON JAMES` | ⬜ unverified | נמוך |
| 7 | David Solomon | GS | `SOLOMON DAVID` | ⬜ unverified | ⚠️ שם נפוץ |
| 8 | Lisa Su | AMD | `SU LISA` | ⬜ unverified | ⚠️ **גבוה** — `SU` שם משפחה קצר, התאמת substring מסוכנת |
| 9 | Brian Armstrong | COIN | `ARMSTRONG BRIAN` | ⬜ unverified | 🔴 **ודאי** — `ARMSTRONG ANTHONY` (director) באותו ticker |
| 10 | Andy Jassy | AMZN | `JASSY ANDREW` | ⬜ unverified | ⚠️ «Andy» ≠ `ANDREW` |
| 11 | Marc Benioff | CRM | `BENIOFF MARC` | ⬜ unverified | נמוך |
| 12 | Alex Karp | PLTR | `KARP ALEXANDER` | ⬜ unverified | ⚠️ «Alex» ≠ `ALEXANDER` |
| 13 | Brian Chesky | ABNB | `CHESKY BRIAN` | ⬜ unverified | נמוך |
| 14 | Dara Khosrowshahi | UBER | `KHOSROWSHAHI DARA` | ⬜ unverified | נמוך |
| 15 | Michael Dell | DELL | `DELL MICHAEL` | ⬜ unverified | ⚠️ שם המשפחה = שם הטיקר/החברה |
| 16 | Mary Barra | GM | `BARRA MARY` | ⬜ unverified | נמוך |
| 17 | Doug McMillon | WMT | `MCMILLON DOUGLAS` | ⬜ unverified | ⚠️ «Doug» ≠ `DOUGLAS`; `MC` מול `MAC` |
| 18 | Jane Fraser | C | `FRASER JANE NIND` | ⬜ unverified | ⚠️ **גבוה** — middle name; טיקר `C` באות אחת |
| 19 | Arvind Krishna | IBM | `KRISHNA ARVIND` | ⬜ unverified | ⚠️ `KRISHNA` נפוץ גם כשם פרטי |
| 20 | Peter Thiel | PLTR | `THIEL PETER` | ⬜ unverified | ⚠️ director בלבד; `officerTitle` ריק |
| 21 | Hock Tan | AVGO | `TAN HOCK` | ⬜ unverified | ⚠️ **גבוה** — `TAN` קצר ונפוץ |
| 22 | Safra Catz | ORCL | `CATZ SAFRA` | ⬜ unverified | נמוך |
| 23 | Shantanu Narayen | ADBE | `NARAYEN SHANTANU` | ⬜ unverified | נמוך |
| 24 | Chuck Robbins | CSCO | `ROBBINS CHARLES` | ⬜ unverified | ⚠️ «Chuck» ≠ `CHARLES` |
| 25 | Brian Cornell | TGT | `CORNELL BRIAN` | ⬜ unverified | נמוך |
| 26 | Jim Farley | F | `FARLEY JR JAMES` | ⬜ unverified | 🔴 **גבוה** — סופיקס באמצע; «Jim» ≠ `JAMES`; טיקר `F` באות אחת |
| 27 | Albert Bourla | PFE | `BOURLA ALBERT` | ⬜ unverified | נמוך |
| 28 | David Ricks | LLY | `RICKS DAVID` | ⬜ unverified | נמוך |
| 29 | Charles Scharf | WFC | `SCHARF CHARLES` | ⬜ unverified | נמוך |
| 30 | Brian Moynihan | BAC | `MOYNIHAN BRIAN` | ⬜ unverified | נמוך |
| 31 | Ryan McInerney | V | `MCINERNEY RYAN` | ⬜ unverified | ⚠️ `MC`/`MAC`; טיקר `V` באות אחת |
| 32 | Chris Kempczinski | MCD | `KEMPCZINSKI CHRISTOPHER` | ⬜ unverified | ⚠️ «Chris» ≠ `CHRISTOPHER` |
| 33 | Cristiano Amon | QCOM | `AMON CRISTIANO` | ⬜ unverified | ⚠️ `AMON` substring של `SALOMON`/`AMONSON` |
| 34 | Ed Bastian | DAL | `BASTIAN EDWARD` | ⬜ unverified | ⚠️ «Ed» ≠ `EDWARD` |
| 35 | Scott Kirby | UAL | `KIRBY SCOTT` | ⬜ unverified | נמוך |
| 36 | Michael Miebach | MA | `MIEBACH MICHAEL` | ⬜ unverified | ⚠️ טיקר `MA` בן שתי אותיות |
| — | Pat Gelsinger | INTC | `GELSINGER PATRICK` | ⬜ unverified | 🔴 פרש — היסטורי בלבד |
| — | Laxman Narasimhan | SBUX | `NARASIMHAN LAXMAN` | ⬜ unverified | 🔴 פרש — היסטורי בלבד |
| — | Richard Gonzalez | ABBV | `GONZALEZ RICHARD` | ⬜ unverified | 🔴 פרש; `GONZALEZ` נפוץ מאוד |
| — | Carlos Tavares | STLA | **not found** | 🔴 לא קיים | פסול — foreign private issuer |

> **36 שורות pin מועמדות** (33 «שמישים» + Cornell/Catz/McMillon שסטטוס התפקיד שלהם לא מאומת
> אך הזרימה קיימת) + 3 היסטוריים + 1 פסול = 40.
> **11 מהן מסומנות בסיכון התנגשות בינוני/גבוה** — כלומר כמעט שליש דורשות תשומת לב מיוחדת
> באימות, לא רק העתקה.

### 5.5 ✅ מדיניות הקודים — מה לקלוט, מה להציג, מה להנמיך

הבעיה בשורה אחת: **`P`-only נותן 1 מתוך 40 (§2.6, מאומת בפרודקשן).** ההצעה:

**(א) INGEST — לקלוט הכול, לזרוק כלום**

קלוט **את כל 11 הקודים** (`P,S,A,M,F,G,J,C,D,X,I`) ואת כל קוד עתידי לא מוכר.
שמור `transaction_code_raw` ללא `CHECK`, וגזור ממנו `transaction_kind`:

| `transaction_code_raw` | `transaction_kind` (נגזר) | תווית UI בעברית |
|---|---|---|
| `P` | `open_market_buy` | רכישה מהשוק הפתוח |
| `S` | `sale` | מכירה |
| `A` | `grant` | הענקה מהחברה |
| `M`, `X`, `C` | `exercise_conversion` | מימוש / המרה |
| `F` | `tax_withholding` | גריעת מניות למס |
| `G` | `gift` | מתנה / העברה |
| `D` | `disposition_to_issuer` | החזרה לחברה |
| `J`, `I` | `other` | פעולה אחרת |
| לא מוכר | `unknown` | מוצג עם הקוד הגולמי |

**נימוק:** `P` הוא 8% מהשוק ו-**0% מהרוסטר**. בלי `S`(46%)+`A`(16%)+`M`(12%)+`F`(10%)
אין לבכירים תוכן בכלל. הקליטה חייבת להיות מלאה; הסינון עובר ל-**שכבת התצוגה**.

**(ב) DISPLAY BY DEFAULT — בפרופיל הבכיר**

| קוד | מוצג כברירת מחדל? | נימוק |
|---|---|---|
| `P` | ✅ **מודגש חזק** | הסיגנל האמיתי היחיד — הבכיר הוציא כסף מכיסו |
| `S` | ✅ מוצג | חצי מהסיפור; **חייב תווית «מכירה»** ולא «מכירה יזומה» — אין דגל 10b5-1 ב-Quiver |
| `A` | ✅ מוצג, **מסומן «תגמול»** | 16% מהזרימה; להסתיר זה לעוות את התמונה |
| `M` | ✅ מוצג, מקובץ | חייב קיבוץ — בא בזוגות נגדיים |

**(ג) AVAILABLE BUT DE-EMPHASIZED — מאחורי «הצג הכול»**

| קוד | למה מונמך |
|---|---|
| `F` | **אין בו שום החלטה** — החברה גורעת מניות למס. 10% מהזרימה של רעש |
| `G` | מתנה/נאמנות — `PricePerShare=0`, לא קשור לדעה על המניה |
| `D` | החזרה לחברה — טכני |
| `J`, `I`, `C`, `X`, `unknown` | מוסברים רק בהערת שוליים שאין לנו; להציג עם הקוד הגולמי ובלי פרשנות |

**(ד) חוקי הצגה מחייבים (נגזרים מממצאים מאומתים)**

1. **לעולם לא להציג `$0`** כשווי. כש-`PricePerShare = 0` (כל `A`/`G`/`C`/`J`) — להסתיר את השדה.
2. **לעולם לא לכתוב «מכירה מתוכננת/יזומה»** — Quiver **לא מספק דגל 10b5-1** (§1.5).
3. **לא לחבר `SharesOwnedFollowing`** לאחזקה כוללת — per-security-line (§4.1).
4. **מונה נטו לפי `transaction_kind`** הוא התצוגה הכי כנה: «12 חודשים: 3 הענקות, 2 מימושים,
   8 מכירות, **0 רכישות מהשוק**».
5. **`Ticker='N/A'` ו-ישויות** — לסנן לפני תצוגה (STEP 0, §3.2).

### 5.5b צעד האימות שנותר (חוסם בנייה)

כדי לנעול את 36 ה-pins צריך **קריאה אחת** ל-`/beta/live/insiders?ticker=<T>` לכל טיקר.
זה **לא נגיש** כרגע (§0.2). שני מסלולים:

| מסלול | מה נדרש | הערה |
|---|---|---|
| **A** — להוסיף `ticker` ל-`fetchQuiverLiveInsiders` + לחשוף ב-probe | שינוי `_shared/quiverQuant.ts` + `sync-insider-buys` | **חורג ממשימה זו** (אסור לשנות קוד פרודקשן). תוספת קטנה ובטוחה: פרמטר אופציונלי |
| **B** — להסיר `P`-only ולהמתין למחזור sync | שינוי `mapQuiverInsider` | איטי; יאכלס `insider_name` אמיתי מ-Quiver לרוסטר תוך ימים |

**עד שאחד מהם יקרה: אין לבנות את ה-pins.** זו מסקנת הביקורת הזו.

---

## 6. סיכום ההחלטות

1. **מודל זיהוי:** אין ID. אין CIK. אין שאילתה לפי אדם. `Name` string + `Ticker` בלבד,
   עם pin ידני מאומת per person. 33 מ-40 שמישים.
2. **`P`-only שובר את הקבוצה הזו — מאומת בפרודקשן:** 247 שורות Quiver, 100% `P`,
   **0 מ-39 טיקרי הרוסטר** (§2.6). קולטים את כל 11 הקודים, מסננים בשכבת התצוגה (§5.5).
3. **אין «תיק» ואין «תשואה» לבכירים.** יומן פעולות עם legend של קודים, לא פרופיל תיק.
4. **אין leaderboard משולב** עם פוליטיקאים/קרנות.
5. **רשימת השדות וסט הקודים — אומתו live** (§1.3b, §2.5).
   `TransactionDate` / `Title` / `AccessionNumber` **לא קיימים** בתשובה האמיתית.
6. 🔴 **החסם שנותר: `?ticker=` לא נגיש דרך שום פונקציה מותקנת** (§0.2).
   לכן **36 מחרוזות ה-pin נשארות `unverified`**, ו**שאלת ההיסטוריה-מול-חלון לא נענתה**.
   **אין לבנות pins לפני שזה נפתר** (§5.5b).
