# DarkPool — Blueprint של ארכיטקטורת מידע וניווט

> **סטטוס:** סבב read-only. **לא נגעתי בשום קובץ קוד, ניווט או UI.** המסמך הזה הוא התוכנית שתבוצע בסבב הבא.
> **תאריך:** 2026-09-17 · **מודל ייחוס:** InsiderWave (4 צילומי מסך)
> **מקורות חובה שהוצלבו:** [`INSIDERWAVE_FEATURE_MAP.md`](./INSIDERWAVE_FEATURE_MAP.md) · [`CURATED_ROSTER_PLAN.md`](./CURATED_ROSTER_PLAN.md) · [`ROSTER_EXECUTIVES.md`](./ROSTER_EXECUTIVES.md) · [`ROSTER_WHALES_13F.md`](./ROSTER_WHALES_13F.md) · [`UW_VS_QUIVER_GAP.md`](./UW_VS_QUIVER_GAP.md)
>
> **כלל ברזל למבצע:** כל שדה במסמך הזה הוצלב מול ביקורת הכנות. אם שדה לא מופיע כאן — הוא לא קיים או שאסור להציג אותו. אין להמציא נתון.

---

## 0. TL;DR — חמש ההכרעות

1. **שלושה טאבים תחתונים בתוך מודול DarkPool: `פיד` · `אנשים` · `מעקב`.** הקומפוננטה `DarkPoolBottomTabBar.tsx` **כבר קיימת בריפו עם בדיוק שלושת הטאבים האלה** ויושבת יתומה — זו החייאה, לא בנייה. ה-Overview של InsiderWave **לא** משוחזר (§3.1).
2. **שלוש האוכלוסיות מקבלות שלושה מסכי פרופיל נפרדים מעל shell משותף — לא מסך אחד עם וריאנטים.** route אחד (`DarkPoolInvestor`) נשאר כ-dispatcher, ולכן **אפס edges של ניווט משתנים**. §2.
3. **הפיד מאחד פוליטיקאים + בכירים בלבד. 13F לעולם לא נכנס לפיד** — ל-`sec13fchanges` אין תאריך עסקה, ולכן אין לו שורת פיד לגיטימית. §2.3.
4. **‎6 מסכים ו-‎11 קומפוננטות יתומים נמחקים.** מתוך ה-`screens/DarkPool/` היום, **7 מתוך 12 המסכים אינם מיובאים מאף מקום.** §1.
5. **RTL נשאר כירורגי לחלוטין.** התשתית הקיימת (`darkPoolRtlRoot` + `ScreenChrome rtl` + `utils/bidi.ts`) היא הפתרון — לא נוגעים ב-`index.ts`, לא ב-`App.tsx`, ולא ב-`I18nManager`. §4.

---

## 1. אינוונטר המסכים — מה יש היום ומה קורה לו

### 1.1 הממצא המרכזי: רוב המסכים מתים

`rg` על כל הריפו (מחוץ ל-`docs/`) מראה שמתוך ‎12 קבצי מסך ב-`screens/DarkPool/`, **רק 5 מגיעים מ-`DarkPoolStack.tsx`**. השאר לא מיובאים מאף קובץ חי.

| קובץ | שורות | מה הוא עושה היום | מיובא מ- | **פסק דין** |
|---|---|---|---|---|
| `DarkPoolHomeScreen.tsx` | 820 | פס "לוויתנים" אופקי **+** פיד ממוזג (קונגרס+Form4) **+** צ'יפי סינון. `initialRouteName` | `DarkPoolStack` | **redesign** → הופך ל-Feed tab; פס הלוויתנים עובר ל-Explore |
| `DarkPoolExploreScreen.tsx` | 239 | חיפוש + `ExploreKindFilterBar` + גריד `CURATED_EXPLORE_PROFILES` | `DarkPoolStack` (`DarkPoolPeople`) | **redesign** → הופך ל-Explore tab (מ-push ל-tab) |
| `DarkPoolTickerScreen.tsx` | 508 | טאבי insider / darkpool, hero, signals | `DarkPoolStack` | **keep + retarget** — מקבל טאב «מי עוד מחזיק» ובית עתידי ל-prints |
| `DarkPoolTradeDetailScreen.tsx` | 717 | פרטי עסקת קונגרס, כנה לחלוטין | `DarkPoolStack` | **keep as-is** — נכתב ע"י ה-agent המקביל. **לא לגעת** |
| `DarkPoolInvestorProfileScreen.tsx` | 29 | עטיפת route → `PersonPortfolioProfileScreen` | `DarkPoolStack` | **keep + expand** → הופך ל-dispatcher לפי `kind` |
| `PersonPortfolioProfileScreen.tsx` | **1130** | מסך אחד שמשרת `politician`/`insider`/`fund_manager` | `DarkPoolInvestorProfileScreen` (+2 יתומים) | **split** → shell + 3 מסכים. §2 |
| `DarkPoolFeedScreen.tsx` | 372 | פיד טאבי ישן. **מייבא `DarkPoolTabs` המיושן** | 🔴 **אף אחד** | **delete** — התוכן מתמזג ל-Feed tab |
| `DarkPoolFollowingScreen.tsx` | 286 | רשימת מעקב + «פעילות אחרונה». **מייבא `DarkPoolTabs` המיושן** | 🔴 **אף אחד** | **revive + redesign** → Following tab |
| `DarkPoolOverviewScreen.tsx` | 197 | ‎5 מונים: «עסקאות בפיד», «מ-Form4», «מ-UW», «עם תמונת בכיר» | 🔴 **אף אחד** | **delete** — אלה מוני צנרת פנימיים שהוצגו למשתמש קצה |
| `DarkPoolScreen.tsx` | 4 | `export { default } from './DarkPoolHomeScreen'` | 🔴 **אף אחד** | **delete** |
| `PoliticianProfileScreen.tsx` | 31 | עטיפה `@deprecated` | 🔴 **אף אחד** | **delete** — והשם מתפנה למסך האמיתי |
| `FundManagerProfileScreen.tsx` | 31 | עטיפה `@deprecated` | 🔴 **אף אחד** | **delete** — והשם מתפנה למסך האמיתי |
| `navigation/DarkPoolTabs.tsx` | 12 | shim `@deprecated`: `export { default } from DarkPoolHomeScreen` | ‎2 המסכים היתומים בלבד | **delete ואז ליצור מחדש** עם תוכן אמיתי. §6, PR2 |

### 1.2 מה מיותר בבירור — התשובה הישירה

**המודול סובל מארבע שכבות של אותו מסך.** בשמות מפורשים:

| הכפילות | הקבצים | ההכרעה |
|---|---|---|
| **פיד כפול** | `DarkPoolHomeScreen` (חי) ו-`DarkPoolFeedScreen` (מת) מרנדרים את אותם `CongressTradeCard`/`InsiderTradeCard` מאותם hooks | Home מנצח; Feed נמחק. ה-`DarkPoolTabToggle` שב-Feed מהגר ל-Home כ-`עוקב/הכל` |
| **פרופיל מרובע** | `PersonPortfolioProfileScreen` + `DarkPoolInvestorProfileScreen` + `PoliticianProfileScreen` + `FundManagerProfileScreen` — ארבעה קבצים, מימוש אחד | ‎2 העטיפות ה-`@deprecated` נמחקות; ה-`InvestorProfileScreen` הופך ל-dispatcher; ה-`PersonPortfolio` מתפצל ל-3 |
| **Explore מרובע** | `ExploreProfileGrid` (חי) מול `ExplorePeopleGrid`, `ExploreSection`, `ExploreCongressSection`, `ExploreTrendingSection` (כולם מתים) | נשאר `ExploreProfileGrid` + `ExplorePortraitCard`; היתר נמחקים |
| **Overview מדומה** | `DarkPoolOverviewScreen` מציג `stats.form4` / `stats.uw` — כמה שורות הגיעו מאיזה ספק | נמחק. זה דף דיאגנוסטיקה, לא מסך מוצר |

### 1.3 קומפוננטות יתומות — רשימת מחיקה מדויקת

נמדד ב-`rg` על כל הריפו. **‎0 יבואים** ל: `AccumulationCard`, `ConfluenceCard`, `DarkPoolNavHint`, `ExploreCongressSection`, `ExplorePeopleGrid`, `ExploreSection`, `ExploreTrendingSection`, `FlowAlertStrip`, `InsiderLatestTradesLabel`, `PeopleAvatarCard`, `darkPoolFeedCardStyles`.

🟢 **שתי יתומות שאסור למחוק — הן הבסיס לתוכנית:**

| קובץ | למה שומרים |
|---|---|
| **`DarkPoolBottomTabBar.tsx`** | סרגל pill מוכן עם **בדיוק** `DarkPoolFeed`/`DarkPoolExplore`/`DarkPoolFollowing` ותוויות `פיד`/`אנשים`/`מעקב`, כולל `DARK_POOL_TAB_BAR_HEIGHT` ו-`useDarkPoolTabBarHeight` הקיימים. PR2 מחיה אותו |
| **`ExploreTopPerformersSection.tsx`** | מכיל כבר בורר תקופות `1D…ALL` מלא. ה-**מעטפת** נשמרת; **מפתח המיון מוחלף** מ-`returns[period]` (אסור — §3.2) לפעילות מדודה |

---

## 2. הבעיה המרכזית — שלוש אוכלוסיות, והכרעה

### 2.1 למה זו בעיה אמיתית ולא סמנטיקה

| אוכלוסייה | מקור | מה המספר הראשי מייצג | קיים «תיק»? | קיימת «תשואה»? | קיים «תאריך עסקה»? |
|---|---|---|---|---|---|
| **Politicians** | STOCK Act (PTR) דרך Quiver | טווחי דיווח + אחזקות מוערכות לפי `bioguide_id` | ✅ כן (88% כיסוי) | ⚠️ רק כ-`ExcessReturn` לעסקה | ✅ `transaction_date` |
| **Executives** | SEC Form 4 | **תגמול ולוח מס במניה אחת** | 🔴 **לא — מושגית לא קיים** | 🔴 **לא — מטעה אקטיבית** | ✅ `Date` |
| **Fund managers** | SEC 13F רבעוני | פוזיציות long בניירות אמריקאיים, נכון לסוף רבעון | ⚠️ «פוזיציות מדווחות», לא תיק | 🔴 **לא — מספרים שקריים מדידים** | 🔴 **לא — אין תאריך בכלל** |

הראיות מהמסמכים: לבכיר, «התיק» הוא טיקר אחד ולכן תשואתו = תשואת המניה עטופה בתווית שמרמזת על מיומנות (`ROSTER_EXECUTIVES.md` §4.2). ל-13F, החישוב הקיים בפרודקשן נותן לבאפט **−65.97%** ולקאתי wood **+3,557.8%** (`ROSTER_WHALES_13F.md` §4.2). אלה לא אי-דיוקים — אלה קטגוריות שונות.

### 2.2 ההכרעה: **שלושה מסכים, shell אחד, route אחד**

**לא** מסך אחד עם וריאנטים. **לא** שלושה מסכים עצמאיים.

```
components:
  ProfileScreenShell            ← chrome בלבד: hero, back/bell/share, Follow, attribution.
                                   אפס סמנטיקה של מטריקות.
    ├── PoliticianPortfolioScreen   (kind='politician')
    ├── ExecutiveActivityScreen     (kind='insider')      ← "יומן פעולות בכיר"
    └── FundPositionsScreen         (kind='fund_manager') ← "פוזיציות מדווחות · 13F"

navigation:
  DarkPoolInvestor { id, kind, ticker?, nameHint?, imageHint? }
    → DarkPoolInvestorProfileScreen  (dispatcher, switch על kind)
```

**הנימוק, בשתי שורות:** ההבדל בין האוכלוסיות אינו בנתונים אלא ב**תוויות** — «שווי תיק» מול «אין תיק» מול «שווי פוזיציות מדווחות». וריאנט-props על מסך אחד מבטיח drift של תוויות: ברגע שמישהו מוסיף `<StatTile label="תשואה">` בלי תנאי `kind`, הבכיר מקבל תשואה. קבצים נפרדים הופכים את הטעות הזו ל**בלתי-אפשרית מבנית** ולא ל«צריך לזכור».

**מה זה עולה:** הכפלה של ~15% מהקוד (hero, follow, share, skeleton) — וזה בדיוק מה ש-`ProfileScreenShell` סופג.

**מה נשאר משותף כ-route:** `DarkPoolInvestor` עם אותם params בדיוק. יש היום **‎8 קריאות `navigate('DarkPoolInvestor', …)`** ב-‎5 קבצים — אף אחת מהן לא משתנה.

> ⚠️ **החלטת wire-format:** ערך ה-param נשאר `kind: 'insider'` לבכירים (ולא `'executive'`), למרות שהמושג ב-UI הוא «בכיר». שינוי הערך היה נוגע בכל ‎8 הקריאות **וגם** במפתחות האחסון של `darkPoolFollowService`. התווית משתנה, ה-wire לא.

### 2.3 כיסוי חלקי ≠ אוכלוסייה נפרדת — ההבחנה שמונעת פיצול-יתר

`CURATED_ROSTER_PLAN.md` §5.6 מגדיר ‎5 פוליטיקאים כ-`trades_only` (Khanna, McCaul, Harshbarger, Mark Green, Fleischmann) ואת Trump כ-`reconstruction_actual_usd`.

**אלה אינם אוכלוסיות נוספות — הם מצבים של אותו מסך.** הסמנטיקה זהה (דיווחי STOCK Act); רק ה**שלמות** שונה. לכן:

| `holdings_source` | המסך | מה מוצג |
|---|---|---|
| `quiver_live_holdings` | `PoliticianPortfolioScreen` | מלא |
| `quiver_thin` (`qv_n < 5`) | אותו מסך | אחזקות + תג «אחזקות מדווחות בודדות», בלי טענת «תיק מלא» |
| `trades_only` | אותו מסך, **מצב `trades_only`** | פיד עסקאות בלבד. סקשנים 3/4/8 מוחלפים בכרטיס הסבר אחד |
| `reconstruction_actual_usd` (Trump) | אותו מסך | **היחיד** שמקבל תיק **וגם** גרף **וגם** תשואה בלי תג «מוערך» — `Amount` שלו הוא דולר ממשי |
| אין אחזקות ואין עסקאות (AOC/Warren/Schumer) | אותו מסך, **מצב `no_equities`** | «לא מחזיק/ה מניות בודדות» — **מצב מכובד, לא שגיאה ולא פרופיל ריק** |

### 2.4 הכרעת הפיד: מאוחד לשתיים, מופרד לשלישית

```
פיד כרונולוגי  =  Politicians  ∪  Executives
13F            =  לעולם לא בפיד
```

**הנימוק:** לפוליטיקאי ולבכיר יש `transaction_date` **וגם** `filed_at` אמיתיים, ולכן שניהם ניתנים למיון כרונולוגי ולשורת «נחשף לפני X · בוצע לפני Y». ל-13F אין תאריך עסקה בכלל — `Change` הוא דלתא בין שני snapshots רבעוניים (`ROSTER_WHALES_13F.md` §4.3). שורת פיד שכותבת «הגדילה פוזיציה ב-NVDA» ומתיישבת לצד «קנה לפני יומיים» היא טענה עובדתית שגויה.

**היכן 13F כן מופיע:**
1. בתוך `FundPositionsScreen` → סקשן «שינויי פוזיציה ברבעון», תמיד מנוסח ברמת רבעון.
2. ב-Explore → מדף קרנות נפרד עם תג התיישנות.
3. **אופציונלי, עתידי:** באנר חד-פעמי ב-Feed בחלון ההגשה («דיווחי הרבעון פורסמו») שמנווט ל-Explore — באנר, לא שורת פיד.

בתוך הפיד המאוחד, ההפרדה בין פוליטיקאי לבכיר נשמרת בשלוש דרכים: צ'יפי סינון `הכל/קונגרס/בכירים` (קיימים ב-Home), תג `קונגרס`/`בכיר` בכל שורה (קיים ב-`DarkPoolTradeFeedCard`), ושורת הסכום — טווח לפוליטיקאי מול מניות/קוד עסקה לבכיר.

---

## 3. עץ הניווט

### 3.1 שאלת שלושת הטאבים — הטיעון לשני הכיוונים, ואז ההכרעה

**נגד טאבים:** המודול כבר יושב בתוך Drawer. טאבים תחתונים מוסיפים שכבת ניווט שנייה, מחזירים את חישובי ה-`useDarkPoolTabBarHeight` לכל `contentContainerStyle`, והם **הוסרו בעבר בכוונה** (`DarkPoolTabs.tsx`: «הטאבים הוסרו»).

**בעד טאבים — שלוש עובדות מדידות:**
1. **פיצ'ר המעקב הוא write-only היום.** `toggleFollowInvestor` ו-`useFollowedInvestors` פעילים ומאוכלסים, אבל `DarkPoolFollowingScreen` יתום — **למשתמש אין שום מסך שמראה את מי הוא עוקב.** זה באג מוצרי, לא חוסר טאב.
2. **Explore קבור מאחורי אייקון.** הדרך היחידה אליו היא כפתור החיפוש בהדר של Home. InsiderWave נותנת לו טאב מלא — כי גילוי אנשים **הוא** המוצר.
3. **Home סובל מפיצול אישיות.** ‎820 שורות שמרנדרות רכיב גילוי (פס לוויתנים) ורכיב זרימה (פיד) באותו גלילה, עם `whaleSparkValues()` שמייצר **סדרת sparkline סינתטית מ-modulo של `activity_score`** כשאין נתון — כלומר גרף מפוברק. פיצול פותר גם את זה.

**ההכרעה: כן לשלושה טאבים.** הפשטות של InsiderWave נשמרת — שלושה, לא ארבעה.

**המיפוי שונה מהם במכוון:**

| InsiderWave | אצלנו | נימוק |
|---|---|---|
| Overview | **`מעקב`** | אין לנו מטריקת-שוק שניתן להציג ביושר; כל מועמד (GEX, tide, seasonality) נפסל ב-`UW_VS_QUIVER_GAP.md` §6. הסלוט השלישי שווה יותר כ-read surface לפיצ'ר שכבר קיים |
| Explore | `אנשים` | זהה |
| Feed | `פיד` | זהה, ו-**טאב הפתיחה** |

### 3.2 העץ הנוכחי

```
Drawer (MainTabs.tsx)
└── DarkPool  →  DarkPoolStack   [View direction:'rtl']
    ├── DarkPoolHome        → DarkPoolHomeScreen          ★ initial
    ├── DarkPoolPeople      → DarkPoolExploreScreen        (push, slide_from_right)
    ├── DarkPoolTicker      → DarkPoolTickerScreen         { ticker, tab? }
    ├── DarkPoolInvestor    → DarkPoolInvestorProfileScreen{ id, kind, ticker?, nameHint?, imageHint? }
    └── DarkPoolTradeDetail → DarkPoolTradeDetailScreen    { trade }          ← נוסף בסבב המקביל

יתומים מחוץ לעץ:  DarkPoolFeedScreen · DarkPoolFollowingScreen · DarkPoolOverviewScreen
                  DarkPoolScreen · PoliticianProfileScreen · FundManagerProfileScreen
```

### 3.3 העץ המוצע

```
Drawer (MainTabs.tsx)                                       ← ללא שינוי
└── DarkPool  →  DarkPoolStack   [View direction:'rtl']     ← ללא שינוי במעטפת
    │
    ├── DarkPoolHome  →  DarkPoolTabs                       ★ initial   [שם ה-route נשמר!]
    │   │                (Bottom Tabs, tabBar={DarkPoolBottomTabBar})
    │   ├── DarkPoolFeed       → DarkPoolFeedScreen      ★ tab initial
    │   ├── DarkPoolExplore    → DarkPoolExploreScreen
    │   └── DarkPoolFollowing  → DarkPoolFollowingScreen
    │
    ├── DarkPoolInvestor    → DarkPoolInvestorProfileScreen  (dispatcher)   push
    │        kind='politician'   → PoliticianPortfolioScreen  ┐
    │        kind='insider'      → ExecutiveActivityScreen    ├ ProfileScreenShell
    │        kind='fund_manager' → FundPositionsScreen        ┘
    │
    ├── DarkPoolTradeDetail → DarkPoolTradeDetailScreen      { trade }       push
    └── DarkPoolTicker      → DarkPoolTickerScreen           { ticker, tab? } push
```

**`DarkPoolHome` נשאר שם ה-route של המעטפת** — קריטי, כי `MainTabs.tsx:95` עושה `DarkPool: { screen: 'DarkPoolHome' }` ב-`navigateDrawerItem`. אפס שינוי ב-`MainTabs.tsx`.

### 3.4 טבלת ה-routes המלאה

| Route | Navigator | Params | Push / Modal | הערה |
|---|---|---|---|---|
| `DarkPoolHome` | Stack | — | initial | מעטפת הטאבים |
| `DarkPoolFeed` | Tabs | — | tab initial | |
| `DarkPoolExplore` | Tabs | — | tab | |
| `DarkPoolFollowing` | Tabs | — | tab | |
| `DarkPoolInvestor` | Stack | `{ id: string; kind: 'politician'\|'insider'\|'fund_manager'; ticker?: string; nameHint?: string; imageHint?: string\|null }` | **push** `slide_from_right` | לא modal: זה יעד ניווט עמוק עם ניווט משנה |
| `DarkPoolTradeDetail` | Stack | `{ trade: CongressFeedTrade }` | **push** `slide_from_right` | קיים. **לא לשנות את החתימה** |
| `DarkPoolTicker` | Stack | `{ ticker: string; tab?: 'insider'\|'darkpool'\|'holders' }` | **push** `slide_from_right` | `'holders'` הוא הערך החדש היחיד |
| ~~`DarkPoolPeople`~~ | — | — | — | **נמחק.** ‎2 call sites בלבד |

**Push בכל מקום, אפס modals.** נימוק: המודול כולו רץ בתוך `View direction:'rtl'` שעוטף את ה-Navigator; modal ב-React Navigation מוצג מחוץ לעץ ה-Stack ולכן **לא יורש את ה-`direction`** — בדיוק סוג הבאג שהפיל את ה-RTL בעבר (ראה `EntityAttachPickerSheet.tsx`: «Modal + forceRTL לא יציב»). גיליונות שכן חייבים להיות modal (ShareDestinationSheet) כבר עושים זאת ומנהלים direction בעצמם.

### 3.5 כל edge של ניווט שמשתנה

| # | מקור | היום | אחרי | סיבה |
|---|---|---|---|---|
| 1 | `DarkPoolHomeScreen.goSearch` | `navigate('DarkPoolPeople')` | `navigate('DarkPoolExplore')` (tab) | Explore הפך לטאב |
| 2 | `DarkPoolFollowingScreen.goExplore` | `tabNav.navigate('DarkPoolExplore')` על `DarkPoolTabs` **המיושן** | אותה קריאה, על ה-Tabs האמיתי | הקריאה כבר נכונה — רק היעד יהיה קיים |
| 3 | `DarkPoolExploreScreen` header | `ChatSubScreenHeader` עם `onBack={goBack}` | `MainDrawerScreenHeader` עם `onMenuPress` | לטאב אין «חזרה» |
| 4 | פס הלוויתנים ב-Home | ב-Feed | **עובר ל-Explore** כ-«הנצפים ביותר» | הפרדת גילוי מזרימה |
| 5 | `DarkPoolInvestorProfileScreen` | render ישיר של `PersonPortfolioProfileScreen` | `switch (kind)` ל-3 מסכים | §2.2 |
| 6 | שורת אחזקה בפרופיל | (אין ניווט) | `navigate('DarkPoolTicker', { ticker, tab:'holders' })` | זו **לא** שורת פיד — הניווט מותר |
| 7 | `DarkPoolFeedScreen` היתום | `tabNav` על `DarkPoolTabs` המיושן | — | הקובץ נמחק |

**שלושה edges ש-אסור לשנות:**
- 🔴 **כרטיס פיד → טיקר: אסור.** החלטת משתמש קודמת, מתועדת ב-`DarkPoolTradeFeedCard.tsx:10`: «פס הטיקר אינפורמטיבי בלבד — אין ניווט לתיק המניה (הוסר בכוונה)». כרטיס פיד מנווט ל-`DarkPoolTradeDetail` (גוף הכרטיס) או ל-`DarkPoolInvestor` (דיוקן/שם). **נקודה.**
- 🔴 `DarkPoolTradeDetail` — נכתב עכשיו ע"י agent מקביל. **לא לשנות params, לא לשנות קבצים, לא «לשפר».**
- 🔴 `MainTabs.tsx` — מחוץ ל-scope.

---

## 4. מפרט לכל מסך

> מוסכמות: כל המסכים ב-`<ScreenChrome rtl>` + `SafeAreaView edges={['top']}`. כל כרטיס דרך `UICard variant="glass"` — **צריכה** של `tokens.glassmorphism`, בלי לגעת ב-`DesignTokens.ts`.

### 4.1 `DarkPoolFeedScreen` — טאב פיד

| # | סקשן | תוכן | שדות |
|---|---|---|---|
| 1 | Header | `MainDrawerScreenHeader inRtlTree`, כותרת «אינסיידרים», כפתור מגירה, אייקון חיפוש ← מעבר לטאב אנשים | — |
| 2 | **Segment `עוקב \| הכל`** | `DarkPoolTabToggle` הקיים (עובר מ-`DarkPoolFeedScreen` היתום) | `follow_edges` מ-`darkPoolFollowService` |
| 3 | כותרת + **בורר מיון** | «עסקאות אחרונות» מימין, `Recent ⇅` משמאל. אפשרויות: `אחרונות` / `הגדולות` / `הטובות ביותר` | מיון על `filed_at` / `amount_high_usd` / `price_change_pct` |
| 4 | צ'יפי אוכלוסייה | `הכל` / `קונגרס` / `בכירים` — קיימים ב-Home | `kind` |
| 5 | שורות עסקה | `CongressTradeCard` / `InsiderTradeCard` → `DarkPoolTradeFeedCard` | `politician_name`, `politician_image_url`, `ticker`, `transaction_type`, `amount_label`, `filed_at`, `transaction_date`, `price_change_pct`, `quote.price` |

**מה שמוחלף לעומת InsiderWave:** הם מציגים בכרטיס הטיקר המשובץ `Stock price $71.99` + `Stock since trade +0.43%`. אצלנו `price_change_pct` מגיע מ-`PriceChange` של Quiver ולא משחזור מקומי — **וכשהוא `null` לא מוצג כלום, לעולם לא `0%`**. הסכום הוא **טווח** (`$15K–$50K`), ואם אין טווח — המחרוזת «סכום לא זמין», לא אומדן.

| מצב | תצוגה |
|---|---|
| Loading | `TradeCardSkeleton ×6` |
| Empty (`עוקב`) | «אין עסקאות מהמעקב» + CTA לטאב אנשים |
| Empty (`הכל`) | «אין עסקאות להצגה» + הסבר על סנכרון ‎~20 דק' |
| Error | `UICard` עם `border.danger` + «משוך למטה לרענון» |

### 4.2 `DarkPoolExploreScreen` — טאב אנשים

| # | סקשן | תוכן | הערת כנות |
|---|---|---|---|
| 1 | Header | `MainDrawerScreenHeader`, «אנשים» | אין back |
| 2 | חיפוש | placeholder **«שם או טיקר»** | 🔴 InsiderWave מחפשת גם לפי party/state. `Party`/`State`/`Chamber` **נזרקים היום** (`INSIDERWAVE_FEATURE_MAP` §7.2). placeholder שמבטיח מפלגה ולא מוצא — באג. להרחיב רק אחרי ש-R1 של הרוסטר יאחסן אותם |
| 3 | **«הנצפים ביותר»** — רייל אופקי | דיוקן + שם + שורת מטריקה | 🔴 **אסור «$95.6K copied»** — אין לנו copy-trading ואין בסיס משתמשים. wave-1 מציג `‎126 עסקאות מדווחות · עדכון אחרון 28/07`. `follower_count` רק כשטבלת ה-follows מאוכלסת באמת |
| 4 | **«הפעילים ביותר»** + בורר תקופה | `ExploreTopPerformersSection` הקיים, מפתח מיון מוחלף | 🔴 **לא «Top Performers».** InsiderWave מציגה `ALL +3,051.84%`. דירוג תשואה חוצה-אוכלוסיות אסור מפורשות (`ROSTER_EXECUTIVES` §4.3). המיון = מספר עסקאות בחלון. **הרחבה עתידית מותרת אחת:** לשונית «עודף תשואה חציוני», **פוליטיקאים בלבד**, רק אחרי ש-`excess_return_pct` נשמר, בתווית «חציון עודף תשואה מול S&P 500» |
| 5 | שלושה מדפים לפי אוכלוסייה | `פוליטיקאים` · `בכירים` · `קרנות` — רייל לכל אחד, **עיצוב כרטיס ושורת מטריקה שונים** | כאן ההפרדה הופכת גלויה למשתמש. כרטיס קרן נושא תג התיישנות; כרטיס בכיר נושא תג טיקר בודד |
| 6 | גריד מלא | `ExploreProfileGrid` + `ExploreKindFilterBar` הקיימים | ללא שינוי |

| מצב | תצוגה |
|---|---|
| Loading | `ProfileGridSkeleton` |
| חיפוש ללא תוצאה | «לא נמצא פרופיל» |
| ריק | «אין פרופילים — משוך לרענון» |

### 4.3 `DarkPoolFollowingScreen` — טאב מעקב

| # | סקשן | תוכן |
|---|---|---|
| 1 | Header | `MainDrawerScreenHeader`, «מעקב», subtitle `N במעקב` |
| 2 | רשימת נעקבים | `InvestorPortrait` + שם + תווית `פוליטיקאי`/`בכיר`/`קרן · 13F` + כפתור הסרה. **התווית היא ההפרדה הוויזואלית** |
| 3 | «פעילות אחרונה» | `ActivityFeedCard` מ-`useDarkPoolFollowingFeed` |
| 4 | *(עתידי)* «1 עסקה חדשה» | דורש `dark_pool_user_seen.last_seen_at` — טבלה שלא קיימת. **לא לזייף** |

Empty: האייקון + הטקסט + `UIButton` הקיימים. רק `goExplore` משתנה ליעד אמיתי.

### 4.4 `PoliticianPortfolioScreen`

| # | סקשן | תוכן | שדות | תנאי הצגה |
|---|---|---|---|---|
| 1 | Hero | דיוקן full-bleed, שם, `Chamber · Party · State` | `image_url`, `name` | תמיד |
| 2 | פעולות | `Follow` · 🔔 · ↗ | `toggleFollowInvestor` | תמיד |
| 3 | **שווי** | `שווי אחזקות מוערך · $150M–$260M` | `SUM(current_holding_usd)` | 🔴 **טווח, בלי סנטים.** מתחת: «אחזקות מניות ו-ETF מוערכות · Quiver». **לעולם לא «שווי נטו»** |
| 4 | גרף + בורר תקופה | `PortfolioValueChart` + `PeriodSelector` | `value_series`, `period_returns` | 🔴 **רק `chart_reliable === true`.** היום ‎6 מתוך ‎32. אחרת הסקשן **נעלם** — `uw-investor-profile` כבר מרוקן `series: []` בנתיב Quiver |
| 5 | **3 אריחי סטטיסטיקה** | `עיכוב דיווח ממוצע` · `היכה את S&P` · `עסקאות ב-12 ח׳` | `avg_delay_days`, `beat_spy_rate_pct`, `trade_count` | 🔴 **לא Win Rate** (`computeWinRate` סופר רק `sells`). 🔴 **לא Expectancy** (חסר-ממדים). `avg_delay_days` הוא **המדד היחיד מהשלושה שאמיתי לחלוטין** — להבליט. `beat_spy` מוצג רק כש-`excess_return_pct` קיים |
| 6 | «עסקאות אחרונות» מקובצות לפי תאריך | שורות → `DarkPoolTradeDetail` | `recent_trades` | תמיד |
| 7 | «אחזקות» | טיקר · `%` · שווי · שורה → `DarkPoolTicker` | `ticker`, `allocation_pct`, `current_holding_usd` | 🔴 «‎86% מהאחזקות המדווחות», **לא** «מהתיק». דלתא מתחת לסף מהותיות — לא מוצגת |
| 8 | «איך אנחנו עוקבים אחרי התיק הזה» + `QuiverAttribution` | סטטי | — | תמיד |

**מצבים:**

| מצב | מה משתנה |
|---|---|
| `trades_only` | סקשנים 3·4·7 → כרטיס הסבר יחיד: «לאדם זה מדווחות עסקאות רבות מחשבונות מנוהלים. אנחנו מציגים את העסקאות המדווחות ולא מציגים תיק או שווי». הפיד נשאר מלא |
| `quiver_thin` | סקשן 7 עם תג «אחזקות מדווחות בודדות» |
| `no_equities` | «לא מחזיק/ה מניות בודדות» — מצב מכובד |
| זרימה מתה (`last_trade_at > 12 חודשים`) | תג «אין דיווח חדש מאז 11/2025» |
| Trump | מלא, בלי תג «מוערך» |
| Loading / Error | `ProfileSkeleton`+`ChartSkeleton` / כרטיס שגיאה + rerty |

### 4.5 `ExecutiveActivityScreen` — «יומן פעולות בכיר»

**זו ישות UI שונה מפרופיל תיק, ולא וריאציה שלו.**

| # | סקשן | תוכן |
|---|---|---|
| 1 | Hero | דיוקן + `role_title` **ידני מהרוסטר** (לא `officerTitle` — `null` ב-61% ומופיע ב-4 איותים) + **תג טיקר בודד** + לוגו החברה |
| 2 | **באנר חובה** | «הנתונים מתייחסים למניות החברה שהאדם מכהן בה בלבד — לא תיק השקעות» |
| 3 | מונה ‎12 חודשים לפי `transaction_kind` | «‎3 הענקות · ‎2 מימושים · ‎8 מכירות · **‎0 רכישות מהשוק**» — תיאורי, מדיד, וכן |
| 4 | ציר זמן | תאריך · **תווית קוד מפורשת** · מניות · מחיר (**מוסתר כש-`PricePerShare = 0`**) |
| 5 | מקרא קודים | `P` רכישה מהשוק **(מודגש)** · `S` מכירה · `A` הענקה · `M` מימוש. `F`/`G`/`D`/`J`/`C`/`X`/`I` מאחורי «הצג הכול» |
| 6 | Attribution | «מקור: SEC Form 4 דרך Quiver» + טריות |

**רשימת האיסורים (כולה נגזרת מ-`ROSTER_EXECUTIVES.md` §4-5):** אין גרף שווי · אין `%` תשואה · אין `%` ownership · אין עוגת הקצאה · אין מקום ב-leaderboard · **לעולם לא `$0`** · **לעולם לא «מכירה מתוכננת»** (אין דגל 10b5-1 ב-Quiver) · **לא לסכום `SharesOwnedFollowing`** (הוא per-security-line).

**מצבים:** `role_status='departed'` (Gelsinger/Narasimhan/Gonzalez) → «אין דיווח חדש מאז X · ארכיון». אין שורות → «לא דווחו פעולות ב-12 החודשים האחרונים» + המונה מציג אפסים אמיתיים.

> ⚠️ **חסם ידוע:** `sync-insider-buys` מסנן `P`-only, ולכן ‎1 מתוך ‎40 הבכירים מייצר ולו שורה אחת (מאומת בפרודקשן, `ROSTER_EXECUTIVES` §2.6). **המסך הזה ריק לחלוטין עד שהסינון נפתח.** תלות חוסמת ב-§6.

### 4.6 `FundPositionsScreen` — «פוזיציות מדווחות · 13F»

| # | סקשן | תוכן |
|---|---|---|
| 1 | Hero | **לוגו מוסד**, לא דיוקן, כשהאדם אינו המנהל בפועל (`is_person_active_manager=false`) |
| 2 | **תג התיישנות — חובה, תמיד גלוי** | `נתוני 13F · נכון ל-30/06/2026 · פורסם 14/08/2026 · בן 79 ימים` |
| 3 | שווי | «שווי הפוזיציות המדווחות». מתחת: «פוזיציות long בניירות אמריקאיים בלבד. לא כולל שורט, מזומן, אג״ח, נכסים בחו״ל והשקעות פרטיות» |
| 4 | גרף | **עמודות בדידות לפי רבעון.** 🔴 **אין קו, אין אינטרפולציה, אין בורר תקופה, אין equity curve** |
| 5 | אחזקות | טיקר · `%` · שווי · **תג `PUT`/`CALL`** |
| 6 | שינויי פוזיציה | «בין 31/03/2026 ל-30/06/2026 הפוזיציה גדלה ב-12%» — **לעולם לא «קנה», לעולם לא «לפני 3 ימים»** |
| 7 | Disclaimers לפי דגל | short-book (Icahn/Einhorn/Klarman/Burry) · person≠institution (Dalio/Soros/Mandel/Black) · misleading |
| 8 | באנר «אין עדכון» | «הדיווח הבא של הרבעון המסתיים 30/09/2026 יתפרסם עד 14/11/2026» — פעיל ‎58 ימים בשנה |

**מוסר במפורש:** `total_return_pct`, `period_returns`, בורר תקופה, `win_rate`, `avg_delay` (קבוע ‎45 לכולם ולכן לא מבדיל).

> ⚠️ **חסם:** התג בסקשן 2 **בלתי-אפשרי כרגע** — `dark_pool_fund_holdings.filing_date` מאכלס בפועל את ה-`report_period`, ואין עמודה לתאריך ההגשה. חוסם את PR6.

### 4.7 `DarkPoolTradeDetailScreen`

**נכתב בסבב המקביל. שמור כמות שהוא.** הבלופרינט מניח שהוא קיים ומתכנן סביבו:
- יעדים נכנסים: גוף כרטיס פיד · שורה ב-«עסקאות אחרונות» בפרופיל.
- יעדים יוצאים: `DarkPoolInvestor` (לחיצה על האדם) בלבד.
- הבית העתידי לפיצ'רים D/F של `INSIDERWAVE_FEATURE_MAP`: «למה זה חשוב» וציר זמן `(bioguide_id, ticker)`.
- 🔴 אסור להוסיף לו: מספר חוזים, strike, מחיר-לחוזה, משקל בתיק.

### 4.8 `DarkPoolTickerScreen`

| טאב | מצב | מקור |
|---|---|---|
| `בכירים` | קיים | `insiderBuys`, `UwTickerInsightsSection` |
| **`מי עוד מחזיק`** ← חדש | פיצ'ר G. הפער הכי זול לסגירה: endpoint אחד + טאב אחד | `live/topshareholders/{ticker}` + `live/congress_stock_holdings?ticker=` |
| `Dark Pool` | קיים, מגודר ב-`DARK_POOL_FORM4_ONLY` | **הבית המתוכנן ל-prints של UW** — רזולוציית שנייה, NBBO, `premium`. 🔴 חובה לסנן `sale_cond_codes != 'average_price_trade'` |

**כניסות מותרות:** שורת אחזקה בפרופיל · חיפוש. **כניסה אסורה:** כרטיס פיד.

---

## 5. RTL — לפי מסך, כירורגי

### 5.1 המצב הקיים — לקרוא לפני שנוגעים

```
index.ts               I18nManager.forceRTL(true)        ← גלובלי, פעיל
App.tsx                עץ השורש נשאר  direction:'ltr'    ← מכוון! Yoga בפרודקשן LTR
DarkPoolStack.tsx      <View style={darkPoolRtlRoot}>    ← המודול מצטרף ל-RTL נקודתית
                       contentStyle { direction:'rtl' }
מסך                    <ScreenChrome rtl>  → styles.rtlRoot { direction:'rtl' }
טקסט                   utils/bidi.ts  →  hebrewText · dataText · rowMixed · toDataIsland()
```

> 🔴 **האיסור המוחלט:** שינוי גורף RTL הפיל בעבר את כל האפליקציה וגולגל אחורה. **אין לגעת ב-`index.ts`, ב-`App.tsx`, ב-`I18nManager`, או להוסיף `direction` לשורש משותף.** כל תיקון חי בקובץ המסך או הקומפוננטה שלו.

**החוק הבסיסי:** בתוך תת-עץ `direction:'rtl'`, `flexDirection:'row'` כבר זורם ימין→שמאל. `row-reverse` שם מחזיר אותך ל-LTR. זה מתועד ב-`darkPoolLayout.ts` («בשורה בתוך עץ RTL — השתמש ב-row»), ו-`rowMixed` ב-`bidi.ts` הוא `'row'` בדיוק מהסיבה הזו.

### 5.2 לפי מסך

| מסך | מה עושים |
|---|---|
| **Feed** | `contentContainerStyle: { direction:'rtl' }` (קיים). Segment ו-צ'יפים ב-`rowMixed`. שורת «עסקאות אחרונות ⟷ מיון» ב-`justifyContent:'space-between'` בתוך `row` — הכותרת נוחתת בימין, הבורר בשמאל |
| **Explore** | ⚠️ **רייל אופקי — אזור הסיכון מספר 1.** `DarkPoolHomeScreen` מגדיר היום `peopleRail:{direction:'rtl'}` **וגם** `peopleRailContent:{flexDirection:'row-reverse'}` — שני היפוכים שמבטלים זה את זה. **למדוד על מכשיר אמיתי (iOS ו-Android) לפני שינוי; לא «לתקן» לפי היגיון.** הכלל לרייל חדש: סדר המקור = הכי חשוב ראשון; `direction:'rtl'` על ה-ScrollView; `'row'` על ה-content. אם offset ההתחלה שגוי — לתקן עם `contentOffset` **באותו רייל**, לא גלובלית |
| **בורר תקופה** (`1D…ALL`) | 🔴 **לא למראה את סדר הטוקנים.** `1D 1W 1M 3M YTD 1Y 5Y ALL` הם טוקנים לטיניים שכל אפליקציה פיננסית מציגה שמאל→ימין. פתרון: `direction:'ltr'` **על מיכל הבורר בלבד**, ו-`alignSelf:'flex-end'` כדי שהרצועה כולה תיצמד לימין. זה בדיוק הדפוס של `profileFooterRow` ב-`MainTabs.tsx` (`flexDirection:'row-reverse'` + `direction:'ltr'`) |
| **Hero של פרופיל** | InsiderWave: דיוקן full-bleed, שם בתחתית-שמאל. אצלנו — תחתית-**ימין**. חץ חזרה = `chevron-forward` (הדפוס כבר קיים ב-`DarkPoolTickerScreen:177` וב-`DarkPoolTradeDetailScreen:154`). 🔔 ו-↗ בפינה הנגדית. **הדיוקן עצמו לא נמרח ולא נמראה** |
| **אריחי סטטיסטיקה 3-up** | `row` בתוך RTL → האריח הראשון בקוד יושב בימין. הערך ב-`dataText` (`ltr` + `tabular-nums`), התווית ב-`hebrewText`. **רוחב קבוע לאריח** — אחרת «עיכוב דיווח ממוצע» דוחף את השכנים |
| **שורות אחזקה / פיד** | הדפוס נפתר כבר ב-`DarkPoolTradeFeedCard`: `RETURN_COL_WIDTH = 86` עמודה נעולה, כך ששם עברי ארוך לא מוציא את המספר מהמסך. **לשכפל לשורת אחזקה ולאריח סטטיסטיקה** |
| **מספרים וטיקרים בתוך טקסט עברי** | `toDataIsland()` (LRI…PDI) לכל `$`, `%`, טיקר ותאריך. 🔴 **לעולם לא לעטוף מחרוזת מעורבת עברית+מספר** — זה הופך את סדר המילים. הדפוס הנכון קיים כבר: `isolateIfData()` ב-`DarkPoolTradeFeedCard.tsx:43` בודק `HEBREW_RE` לפני שהוא עוטף |
| **גרפים** | ציר הזמן נשאר שמאל→ימין. `PortfolioValueChart` ועמודות רבעוניות — **לא למראה**. רק המקרא והתוויות עוברות ל-`hebrewText` |
| **סרגל טאבים תחתון** | `DarkPoolBottomTabBar` מרנדר `state.routes.map` בתוך `row`. הסדר הנראה נגזר מסדר ה-`<Tab.Screen>` ב-`DarkPoolTabs.tsx`. היעד: `פיד` בימין. **לכוון בסדר הרישום, לא ב-style גלובלי** |
| **Modals** | אין. §3.4 |

### 5.3 בדיקות קבלה ל-RTL בכל PR

1. הצ'יפים/סגמנטים מתחילים מימין.
2. `$15K–$50K` לא הופך ל-`50K–15K$`.
3. שם עברי באורך ‎24 תווים לא דוחף את עמודת התשואה.
4. `1D…ALL` לא הפוך.
5. חץ חזרה מצביע ימינה בכל מסך push.
6. הרייל האופקי מתחיל בכרטיס הראשון (iOS **וגם** Android).
7. **רגרסיה:** צ'אט, יומן מסחר ו-Onboarding לא זזו — כולם רגישים ל-`forceRTL`.

---

## 6. קומפוננטות לשימוש חוזר

### 6.1 קיימות — להרחיב, לא לכתוב מחדש

| קומפוננטה | תפקיד בבלופרינט | שינוי |
|---|---|---|
| `DarkPoolBottomTabBar` | סרגל ‎3 הטאבים | **החייאה** — הקוד מתאים ‎1:1 |
| `DarkPoolTabToggle` | סגמנט `עוקב \| הכל` | מהגר מהמסך היתום |
| `DarkPoolTradeFeedCard` | שורת עסקה | ללא שינוי. **התקן** ל-RTL מעורב |
| `CongressTradeCard` / `InsiderTradeCard` | עטיפות פר-אוכלוסייה | ללא שינוי |
| `InvestorPortrait` · `ProfileHeroAvatar` · `InsiderAvatar` | דיוקנים (‎5/‎1/‎2 שימושים) | ללא שינוי |
| `ExplorePortraitCard` · `ExploreProfileGrid` · `ExploreKindFilter` | גריד וכרטיס אדם | ללא שינוי |
| `ExploreTopPerformersSection` | **בורר תקופה + רייל** | המעטפת נשמרת; **מפתח המיון מוחלף** (§4.2 שורה 4). מומלץ לחלץ מתוכו `PeriodSelector` |
| `HoldingsPieSection` | עוגת הקצאה | **רק** ב-`PoliticianPortfolioScreen`. 🔴 אסור בבכיר (טיקר בודד) ובקרן |
| `QuiverAttribution` | ייחוס + טריות | חובה בשלושת הפרופילים |
| `TickerLogo` · `DarkPoolSectionHeader` · `darkPoolCardMetrics` | תשתית | ללא שינוי |
| `SkeletonLoader` (`TradeCard`/`Profile`/`Chart`/`ProfileGrid`/`ListItem`) | כל מצבי ה-loading | ללא שינוי |
| `UICard variant="glass"` | כל כרטיס | **צריכה בלבד** |
| `PortfolioValueChart` | גרף שווי | **רק** בפוליטיקאי, ורק `chart_reliable` |
| `MainDrawerScreenHeader inRtlTree` | הדר של ‎3 הטאבים | ללא שינוי |
| `useDarkPoolTabBarHeight` | padding תחתון | **החייאה** יחד עם הטאבים |

### 6.2 חדשות

| קומפוננטה | תפקיד | הערה |
|---|---|---|
| `ProfileScreenShell` | hero, back/bell/share, Follow, skeleton, attribution | **אפס סמנטיקה של מטריקות** — שם עובר החוזה |
| `StatTile` | אריח סטטיסטיקה עם רוחב נעול | חילוץ מ-`PersonPortfolioProfileScreen` |
| `HoldingRow` | שורת אחזקה עם עמודה נעולה | חילוץ. `DarkPoolTradeFeedCard` הוא המודל |
| `PeriodSelector` | `1D…ALL`, `direction:'ltr'` מקומי | חילוץ מ-`ExploreTopPerformersSection` — משותף ל-Explore ולפרופיל |
| `StalenessBadge` | `נכון ל-X · פורסם Y · בן Z ימים` | חובה ב-13F |
| `EstimateLabel` | תג «מוערך» + tooltip | מונע ניסוח אד-הוק בכל מסך |
| `SourceScopeNote` | הערת scope מתחת לשווי | נוסח קבוע מ-`ROSTER_WHALES_13F` §4.6 |
| `TradeSortControl` | בורר מיון | InsiderWave: `Recent ⇅` |
| `PopulationBadge` | `קונגרס`/`בכיר`/`קרן · 13F` | מאחד את התוויות המפוזרות |
| `TransactionCodeLegend` | מקרא קודי Form 4 | בכיר בלבד |
| `ActivityCounterRow` | «‎3 הענקות · ‎0 רכישות» | בכיר בלבד |
| `QuarterlyBarsChart` | עמודות בדידות לפי רבעון | קרן בלבד. **לא** `PortfolioValueChart` |

### 6.3 טוקנים

`components/ui/DesignTokens.ts` תוקן לאחרונה — **צריכה בלבד, אפס עריכה.** הנתיבים: `glassmorphism.blurIntensity` · `.cardBackground.dark` · `.baseFill` · `.border` · `.topHighlight`. הגישה המומלצת היא דרך `UICard variant="glass" glassIntensity=…`. 🔴 **אין להוסיף צבע חדש** — `whaleCard` ב-`DarkPoolHomeScreen` מקודד היום ‎6 ערכי `rgba` קשיחים; הכרטיס המפוצל צריך לצרוך טוקנים.

---

## 7. סדר ביצוע

### 7.1 תלויות חוסמות

| חסם | מה תקוע | בעלות |
|---|---|---|
| 🔴 עבודת הפיד המקבילה | **PR1 ו-PR2** — ה-agent השני נוגע ב-`DarkPoolStack.tsx` וב-`DarkPoolFeedScreen.tsx` | לתאם לפני מחיקה |
| 🔴 `P`-only ב-`sync-insider-buys` | **PR3b** — מסך הבכיר ריק ל-39 מ-40 | data |
| 🔴 `report_period` ≠ `filing_date` בסכימה | **PR6** — תג ההתיישנות בלתי-אפשרי | data |
| 🟡 `excess_return_pct` לא נשמר | «היכה את S&P» + «עודף תשואה» ב-Explore | data (זול: השדה כבר חוזר בכל קריאה) |
| 🟡 `Party`/`State` נזרקים | חיפוש לפי מפלגה/מדינה | data |
| 🟡 `topshareholders` לא בשימוש | **PR7** | data |
| 🟡 `put_call` נזרק | תג PUT ב-13F | data |

### 7.2 ה-PRs

| PR | תוכן | גודל | תלוי ב- | אפליקציה שבורה? |
|---|---|---|---|---|
| **PR1** | **טאטוא קוד מת.** מחיקת ‎5 מסכים (`DarkPoolFeedScreen`, `DarkPoolOverviewScreen`, `DarkPoolScreen`, `PoliticianProfileScreen`, `FundManagerProfileScreen`) + ‎11 קומפוננטות (§1.3) + shim `navigation/DarkPoolTabs.tsx`. **לא למחוק** `DarkPoolFollowingScreen`, `DarkPoolBottomTabBar`, `ExploreTopPerformersSection` | S | 🔴 עבודת הפיד המקבילה | לא — אפס יבואים |
| **PR2** | **החייאת ‎3 הטאבים.** `navigation/DarkPoolTabs.tsx` חדש; `DarkPoolHome` → Tabs; פיצול `DarkPoolHomeScreen` (רייל→Explore, פיד נשאר); `DarkPoolExploreScreen` מ-push ל-tab (החלפת הדר); החייאת `DarkPoolFollowingScreen`; מחיקת `DarkPoolPeople` + ‎2 ה-call sites | **L** | PR1 | לא, אם באותו commit |
| **PR3a** | `ProfileScreenShell` + `PoliticianPortfolioScreen`. **שימור התנהגות** — אותם סקשנים, מקור אחד | M | — (מקבילי ל-PR2) | לא |
| **PR3b** | `ExecutiveActivityScreen` — יומן פעולות, מונה קודים, מקרא | M | PR3a · פתיחת `P`-only | לא (מצב ריק מכובד) |
| **PR3c** | `FundPositionsScreen` — **הסרת** תשואות/בורר/win-rate, הוספת scope note | M | PR3a | לא |
| **PR3d** | הפיכת `DarkPoolInvestorProfileScreen` ל-dispatcher; **מחיקת `PersonPortfolioProfileScreen`** (‎1130 שורות) | S | 3a+3b+3c | לא |
| **PR4** | **שדרוג הפיד:** סגמנט `עוקב\|הכל` + בורר מיון | M | PR2 · **ומיזוג עבודת הפיד המקבילה** | לא |
| **PR5** | **שדרוג Explore:** רייל «הנצפים ביותר», «הפעילים ביותר» + `PeriodSelector` מחולץ, ‎3 מדפי אוכלוסייה | M | PR2 | לא |
| **PR6** | כנות 13F: `StalenessBadge`, `QuarterlyBarsChart`, disclaimers, באנר «אין עדכון» | M | PR3c · **סכימה** | לא |
| **PR7** | טאב «מי עוד מחזיק» ב-`DarkPoolTickerScreen` | S | endpoint | לא |
| **PR8** | פני שטח ל-dark-pool prints מ-UW | L | אינטגרציית UW | לא |

### 7.3 הנתיב הקריטי

```
PR1  ──▶  PR2  ──┬──▶  PR4   (פיד)        ← ממתין גם לעבודת הפיד המקבילה
                  └──▶  PR5   (Explore)

PR3a ──┬──▶ PR3b  ──┐
       ├──▶ PR3c  ──┼──▶ PR3d  ──▶ PR6
       └────────────┘

PR7 · PR8  —  אורתוגונליים לגמרי, תלויים רק בדאטה
```

**ההמלצה: להתחיל ב-PR3a במקביל ל-המתנה לעבודת הפיד.** הוא נוגע רק בקבצי פרופיל, לא ב-`DarkPoolStack.tsx` ולא במסכי הפיד — כלומר **אפס סיכון התנגשות** עם ה-agent המקביל, והוא הקדם-תנאי לשלושה PRים אחרים.

### 7.4 שערי קבלה

| שער | תנאי |
|---|---|
| **G1** אחרי PR1 | `tsc --noEmit` נקי; `rg` מאשר אפס יבואים למחוקים |
| **G2** אחרי PR2 | ‎3 הטאבים עוברים; deep-link מהמגירה נוחת על הפיד; ‎7 בדיקות RTL (§5.3) |
| **G3** אחרי PR3d | `PersonPortfolioProfileScreen` לא קיים; ‎3 המסכים מציגים תוויות שונות לאותו שדה |
| **G4** אחרי PR6 | אף מסך 13F לא מציג `%` תשואה — `rg` על `total_return_pct` בנתיב הקרן מחזיר ‎0 |

---

## 8. מה מכוון לא בבלופרינט

| פריט של InsiderWave | הסיבה |
|---|---|
| `$95.6K copied` | אין copy-trading ואין בסיס משתמשים. מספר חברתי בלי משתמשים מאחוריו = פברוק |
| `Top Performers ALL +3,051.84%` | דירוג תשואה חוצה-אוכלוסיות אסור; `MAX_DISPLAYABLE_PERIOD_RETURN_PCT` שלנו הוא החלטה נכונה שיש לשמר |
| `Win Rate 68.8%` | לא ניתן לחישוב מטווחים; המימוש הקיים סופר רק `sells` |
| `Expectancy 1.57` | חסר-ממדים |
| `1,000 contracts · $20.00/contract` | לא מדווח ב-PTR, והמספרים שלהם סותרים את עצמם (מכפיל ‎100 חסר) |
| `$520 → $5,164.02` | backtest עם lookahead bias — הדיווח מגיע ‎29 יום אחרי העסקה |
| טאב Overview | אין מטריקת-שוק שניתן להציג ביושר |
| `Portfolio Value $206,053,131.12` | הסנטים הם רעש מתמטי מטווח ברוחב ‎$35,000 |
