# ביקורת נתונים מזויפים / מוק באפליקציה

> **סטטוס: PHASE 1 בלבד — אינוונטר. אף תיקון לא בוצע.**
> העבודה נעצרה ביוזמת המשתמש לפני תחילת PHASE 2 (תיקונים).
> **אף קובץ קוד לא שונה בסבב הזה.** כל השורות בטבלאות מסומנות `⏳ לא תוקן`.

תאריך: 2026-09-17

## מקרא חומרה

| סימון | משמעות |
|---|---|
| 🔴 | מוצג כעובדה ושגוי מהותית / מטעה לגבי כסף |
| 🟡 | הערכה שמוצגת ללא תווית "משוער" |
| 🟢 | לא מזיק (שלד טעינה, fallback לתמונה, מזהה React, jitter רשת) |

## מקרא אימות

| סימון | משמעות |
|---|---|
| ✅ מאומת | מספרי השורות נבדקו מול הקובץ |
| 🔎 לא אומת | לוקליזציה מדויקת עדיין לא נבדקה שורה-שורה |

## היקף שנסרק ומה נשאר פתוח

| אזור | סטטוס סריקה |
|---|---|
| `screens/Portfolios`, `Journal`, `Markets`, `News`, `Watchlist`, `Learning`, `Tweets`, `Profile` | ✅ הושלם |
| `services/`, `hooks/`, `lib/`, `utils/`, `constants/`, `context/` | ✅ הושלם |
| `supabase/functions/_shared/congressPortfolio.ts` | 🟠 חלקי — אותרו הליבות (`STOCK_ACT_FLOOR_MID`, fallback notional, `computeWinRate`), קריאה מלאה נקטעה |
| `screens/DarkPool/**` + `components/` (ללא `components/ui/`) | ❌ **לא נסרק** — הסריקה נקטעה באמצע |
| שאר `supabase/functions/**` | ❌ **לא נסרק** |

**מחוץ ל-scope בכוונה (סוכן אחר):** `uw-fund-profile`, `sync-fund-13f`, `dark_pool_fund_holdings`, `FundManagerProfileScreen`, `components/ui/**`.

## סיכום כמותי (נכון לנקודת העצירה)

| חומרה | כמות |
|---|---|
| 🔴 פעיל (מוצג למשתמש היום) | 15 |
| 🔴 רדום (dead code שלא נקרא, אך מסוכן אם יוחזר) | 2 |
| 🟡 | 35 |
| 🟢 | 10 |
| **סה"כ** | **62** |

המספר הוא **רצפה, לא תקרה** — `screens/DarkPool/**` ורוב `supabase/functions/**` טרם נסרקו, ושם מרוכזת ליבת החישוב הפיננסי.

---

## 1. 🔴 מוצג כעובדה ושגוי מהותית

| # | file:line | מה מזויף | מה המשתמש רואה | אימות | סטטוס |
|---|---|---|---|---|---|
| 1 | `screens/Portfolios/tabs/OverviewTab.tsx:220` | `livePrice = q?.price ?? t.entry_price` — מחיר הכניסה מוצג כמחיר שוק כשאין quote | שווי תיק, רווח/הפסד לא-ממומש, movers, allocation — כאילו השוק לא זז | ✅ | ⏳ לא תוקן |
| 2 | `screens/Portfolios/tabs/OverviewTab.tsx:313` | אותו fallback בחישוב `livePortfolioValue` | `PortfolioSummaryHeader` — "שווי תיק" | ✅ | ⏳ לא תוקן |
| 3 | `screens/Portfolios/tabs/OverviewTab.tsx:349` | `liveDailyGain ?? 0` — היעדר נתון הופך ל-$0 שינוי יומי | "היום: $0 (0%)" גם כשאין `previous_close` כלל | ✅ | ⏳ לא תוקן |
| 4 | `screens/Portfolios/tabs/OverviewTab.tsx:389-398` | שכפול נקודת שווי בודדת ל"אתמול" → סדרה דו-נקודתית מלאכותית | `PortfolioValueChart` + מדדי TWR / תנודתיות / drawdown שנגזרים ממנה | ✅ | ⏳ לא תוקן |
| 5 | `screens/Portfolios/CommunityPortfoliosTab.tsx:121` | `[snapshots[0].value, snapshots[0].value]` — קו שטוח מנקודה אחת | sparkline ב-`CommunityPortfolioLeaderCard`, נראה כהיסטוריה נמדדת | ✅ | ⏳ לא תוקן |
| 6 | `screens/Portfolios/CommunityPortfoliosTab.tsx:137` | אותו דבר מ-`value_history` | אותו sparkline | ✅ | ⏳ לא תוקן |
| 7 | `screens/News/BreakingNewsTab.tsx:1006` | `view_count \|\| row.retweet_count` — מספר ריטוויטים מוצג כצפיות | "X צפיות" תחת כתבה | ✅ | ⏳ לא תוקן |
| 8 | `screens/News/ArticleDetailScreen.tsx:289` | מציג `view_count` ללא הבחנת מקור | "X צפיות" | ✅ | ⏳ לא תוקן |
| 9 | `services/portfolios/portfolioDisplaySummary.ts:78` | `livePrice` נופל ל-`entry_price` (תיקי Colmex) | header סיכום תיק: unrealized=0, שינוי יומי=0 — מוצג כ"חי" | ✅ | ⏳ לא תוקן |
| 10 | `services/portfolios/portfolioAggregator.ts:129` | `lastPrice = quote?.price ?? 0` → `value = qty × 0` | holding אמיתי מוצג כ-**שווי $0 והפסד מלא**; מעוות donut ו-top gainers | ✅ | ⏳ לא תוקן |
| 11 | `services/darkpool/featuredProfilesService.ts:73-74` → `screens/DarkPool/utils/curatedExploreProfiles.ts` | `activity_score` קשיח 85–101 = סדר תצוגה ידני, לא פעילות נמדדת | `DarkPoolHomeScreen` / `DarkPoolExploreScreen`: "ציון פעילות" ליד שם משקיע | ✅ | ⏳ לא תוקן |
| 12 | `screens/DarkPool/DarkPoolHomeScreen.tsx:123-137` | sparkline **סינתטי** שנבנה מ-`activity_score` הקשיח כשאין `sparkline_values` | גרף מיני ליד משקיע — נראה כגרף ביצועים, אינו מדידה | ✅ | ⏳ לא תוקן |
| 13 | `services/courseService.ts:267-268` | `rating: 4.8`, `students_count: 1250` נזרעים ל-DB | `CourseCard`: דירוג וכמות תלמידים — social proof מומצא | ✅ | ⏳ לא תוקן |
| 14 | `supabase/functions/_shared/congressPortfolio.ts:947-967` | מסלול fallback ל-notional כשאין סדרת מחירים מ-Yahoo — **עוקף את תקרת 250%** שמגנה על תשואות לא-אמינות | פרופיל פוליטיקאי: תשואות תקופתיות (1W/1M/3M/YTD/1Y/5Y) שיכולות להיות אבסורדיות | 🔎 | ⏳ לא תוקן |
| 15 | `supabase/functions/_shared/congressPortfolio.ts:597` (נקרא ב-`:824`) | `computeWinRate` סופר **רק מכירות**: קנה-והחזק → `null`; מכירה רווחית אחת → 100% | פרופיל פוליטיקאי: "אחוז הצלחה" — מספר חסר משמעות | 🔎 (מתועד גם ב-`docs/INSIDERWAVE_FEATURE_MAP.md:238`) | ⏳ לא תוקן |

### 🔴 רדום — dead code שאינו נקרא כיום

| # | file:line | מה יש שם | סטטוס |
|---|---|---|---|
| 16 | `services/economicCalendarService.ts:816-922` | `getBasicFutureEvents()` — אירועי CPI/NFP/FOMC עם תחזיות קשיחות (`220K`, `0.3%`, `180K`, `5.25%`) | ⏳ לא נמחק |
| 17 | `services/eodhdService.ts:393-453` | `getSampleEarningsData()` — נתוני EPS מומצאים ל-AAPL/MSFT/GOOGL/TSLA | ⏳ לא נמחק |

---

## 2. 🟡 הערכה ללא תווית

| file:line | מה מוערך | איפה נראה | אימות | סטטוס |
|---|---|---|---|---|
| `supabase/functions/_shared/congressPortfolio.ts:116,142` | `STOCK_ACT_FLOOR_MID` — נקודת אמצע של טווחי דיווח STOCK Act כסכום עסקה | כל סכום עסקה בפרופיל פוליטיקאי ובפיד הקונגרס | 🔎 | ⏳ |
| `services/darkpool/profilePortfolioEngine.ts:127-142` | `forwardFillDailyPrices` — מילוי מחירים לימים ללא מסחר | גרף פרופיל משקיע | ✅ | ⏳ |
| `services/darkpool/profilePortfolioEngine.ts:177-242` | `buildProfileValueSeries` — גרף שווי משוחזר מעסקאות, positions-only ללא cash flows | `PersonPortfolioProfileScreen` — גרף שווי ותשואות תקופתיות | ✅ | ⏳ |
| `services/darkpool/profilePortfolioEngine.ts:368-374` | `return_pct: 0` כש-basis לא אמין, אך `entry_price` עדיין מוצג | טבלת holdings בפרופיל | ✅ | ⏳ |
| `services/darkpool/profilePortfolioEngine.ts:538-543` | `totalReturnPct` נדחס ל-0 כש-\|pct\| > 250% | "תשואה כוללת: 0%" — מוצג כאילו נמדד | ✅ | ⏳ |
| `services/darkpool/profilePortfolioEngine.ts:53,422` | `DEFAULT_RF = 0.04` — ריבית חסרת סיכון מונחת ל-Sharpe/Sortino | מדדי סיכון בפרופיל | ✅ | ⏳ |
| `services/portfolios/portfolioDisplaySummary.ts:156` | `annualized_yield: 0` קשיח לכל תיק Colmex | שדה "תשואה שנתית" | ✅ | ⏳ |
| `services/darkpool/exploreFromDbClient.ts:74` | `activity_score: 50` קבוע | explore payload | ✅ | ⏳ |
| `services/darkpool/personPortraitService.ts:137` | `activity_score: 80/60` לפי מקור, לא לפי פעילות | `fetchExploreProfilesGrid` (deprecated) | ✅ | ⏳ |
| `services/courseService.ts:241-242,269-270` | `price: 299`, `original_price: 599` קשיחים ב-seed | מחיר קורס | ✅ | ⏳ |
| `services/fearAndGreedService.ts:164-177` | `parseInt(...) \|\| 50`; `buildHistorical` מחזיר את "עכשיו" כשאין היסטוריה | `FearAndGreedCard` — השוואות שבוע/חודש/שנה זהות לערך הנוכחי | ✅ | ⏳ |
| `services/fearAndGreedService.ts:339-342` | cache עד 7 ימים מוחזר בשגיאת fetch, מוצג כעדכני | אותו כרטיס | ✅ | ⏳ |
| `services/darkpool/darkPoolService.ts:120-121` | `insider_value \|\| 0`, `insider_days_ago \|\| 0` | כרטיס confluence בפיד | ✅ | ⏳ |
| `services/darkpool/darkPoolSignalEngine.ts:331-341` | `relative_volume` ברירת מחדל `1` כשאין ממוצע 30 יום | סיגנלים ב-`DarkPoolFeedScreen` | ✅ | ⏳ |
| `services/darkpool/darkPoolAiInsights.ts:90-94` | טקסט insight עם `$0` כשהערך חסר | כרטיס AI בפיד | ✅ | ⏳ |
| `hooks/useDarkPoolInsiderFeed.ts:64-68,107-108` | first paint ללא quotes; timeout 6ש → `sinceTradePct` null זמנית | `InsiderTradeCard` | ✅ | ⏳ |
| `hooks/useCongressFeed.ts:36-38,73` | אותו דפוס, timeout 5ש | `CongressTradeCard` | ✅ | ⏳ |
| `lib/queryPersist.ts:89-92` | rehydrate מ-AsyncStorage בלי סימון גיל — נתונים ישנים נראים טריים | cold start בכל המסכים | ✅ | ⏳ |
| `services/earningsService.ts:529-530` | נפילה ל-`legacyCache` בכשל fetch | earnings tabs | ✅ | ⏳ |
| `services/economicCalendarService.ts:601-669` | `generateKeyUpcomingEvents()` — dead code | לא נקרא | ⏳ |
| `screens/Portfolios/tabs/OverviewTab.tsx:241-243` | `dailyGain = unrealized` כשנפתח היום בלי `prevClose` | Movers: "שינוי היום" שאינו יומי | ✅ | ⏳ |
| `screens/Portfolios/tabs/OverviewTab.tsx:338` | `livePortfolioValue ?? summary?.total_value ?? 0` | מכנה לאחוז ההשפעה על התיק | ✅ | ⏳ |
| `screens/Portfolios/hooks/useRealtimeHoldings.ts:146-148` | `dailyBase = previous_close ?? last_price` | שינוי יומי ב-Holdings | ✅ | ⏳ |
| `screens/Portfolios/components/PortfolioValueChart.tsx:221-262` | benchmark מנורמל לשווי התיק ללא תווית "מנורמל" | גרף Overview | ✅ | ⏳ |
| `screens/Portfolios/components/PortfolioValueChart.tsx:236` | `maxX = Math.max(..., Date.now())` — מתיחת ציר הזמן עד היום | קטע גרף שמרמז המשכיות | ✅ | ⏳ |
| `screens/Portfolios/components/PortfolioValueChart.tsx:428` | `headerValue ?? 0` | "$0" ככותרת גרף כשאין סדרה | ✅ | ⏳ |
| `screens/Portfolios/components/JournalPreviewSheet.tsx:103-111` | שרשרת fallbacks לשווי תיק | preview ב-`PortfoliosTab` | ✅ | ⏳ |
| `screens/Portfolios/components/CommunityPortfolioLeaderCard.tsx:148-151` | sparkline מטרנזקציות ולא מ-snapshots | community (יש תווית חלקית) | ✅ | ⏳ |
| `screens/Portfolios/tabs/OpenTradesTab.tsx:121-137` | polling כל 30ש מוצג כ"חי" | uP&L | ✅ | ⏳ |
| `screens/Portfolios/tabs/OpenTradesTab.tsx:152-154` | prefill מחיר יציאה מ-`priceMap` | sheet סגירת עסקה | ✅ | ⏳ |
| `screens/Portfolios/tabs/CalendarTab.tsx:488,532-534` | `pnl ?? 0` → `+0` בתא יום | לוח שנה | ✅ | ⏳ |
| `screens/Learning/LearningScreen.tsx:431-433,1187` | משך שיעור מ-`DEMO_COURSE` לפני טעינת DB; `\|\| '00:00'` | badge משך על כרטיס שיעור | ✅ | ⏳ |
| `screens/News/EconomicCalendarTab.tsx:35-44,72` | `stripFlagImportance` — היוריסטיקה לדירוג חשיבות | פס צבע אדום/כתום | ✅ | ⏳ |
| `screens/Watchlist/components/WatchlistSymbolSheet.tsx:479` | `entryPrice: row.price ?? row.item.entry_price` | "פתח ביומן" עם מחיר ישן | ✅ | ⏳ |
| `screens/Tweets/TweetsFeed.tsx:571` | optimistic `likeCount ± 1` (עם rollback) | מונה לייקים | ✅ | ⏳ |

---

## 3. 🟢 לא מזיק — להשאיר

| file:line | מה |
|---|---|
| `screens/DarkPool/utils/investorPlaceholder.ts:5,148` | `transback.png` — fallback לתמונת פרופיל. לגיטימי |
| `hooks/useLearning.ts:28,39,50` | `placeholderData: (previous) => previous` — אנטי-הבהוב |
| `services/chat/chatRealtimeService.ts:336` | jitter ב-backoff לחיבור מחדש |
| `services/tweetsService.ts:389`, `services/newsService.ts:213`, `screens/News/BreakingNewsTab.tsx:1036` | `Math.random()` לשמות ערוצי Realtime |
| `services/chat/chatOfflineQueue.ts:167-169,205`, `services/chat/chatMediaService.ts:64` | מזהים זמניים / UUID |
| `screens/Auth/RegisterScreen.tsx:107-110`, `RegistrationPaymentScreen.tsx:98-101`, `components/chat/StoryViewer.tsx:85-86` | חלקיקי רקע לאנימציה |
| `components/chat/MediaMessageRenderer.tsx:496` | עמודות waveform אקראיות להודעה קולית — קישוט, לא מדידה פיננסית |
| `supabase/functions/uw-diagnostics/index.ts:11` | `SAMPLE_POLITICIAN_ID` — כלי דיאגנוסטיקה, לא UI |
| `screens/Portfolios/components/PortfolioTradesTable.tsx:41` | `price: 78` — רוחב עמודה בפיקסלים |
| `screens/Portfolios/ImportTransactionsScreen.tsx:284-288` | דוגמת CSV בהוראות import |
| `services/darkpool/darkpoolProvider.ts:489-491` | `MockDarkPoolProvider` — לא נקרא מהאפליקציה |

---

## 4. דורש החלטת משתמש

1. **`computeWinRate` (`congressPortfolio.ts:597`)** — המלצתי: **להסיר** את "אחוז הצלחה" מהתצוגה. גרסה נכונה דורשת עלות בסיס אמיתית לכל פוזיציה, ודיווחי STOCK Act נותנים רק טווחים; כל תיקון ייוותר הערכה. חלופה: להחליף ב-"Beat-S&P rate" כמוצע ב-`docs/INSIDERWAVE_FEATURE_MAP.md:338`. **טרם הוכרע.**
2. **`STOCK_ACT_FLOOR_MID`** — זו המוסכמה התעשייתית לדיווחי קונגרס. להשאיר אבל לתייג "משוער (טווח דיווח)" בכל מקום שמוצג סכום? או להציג את הטווח עצמו?
3. **`DEFAULT_RF = 0.04`** — להביא ריבית חסרת סיכון אמיתית (יש `get_ust_yield_rates` ב-EODHD) או לתייג.
4. **`price: 299 / original_price: 599`** בקורסים — ייתכן שזה מחיר עסקי אמיתי ולא מוק.
5. **benchmark מנורמל בגרף** — פרקטיקה מקובלת; השאלה רק אם לתייג.

---

## 5. מצב עץ העבודה בנקודת העצירה

- **קבצי קוד ששונו: 0.** לא בוצעה אף עריכה.
- **אין קובץ במצב חלקי, אין reference תלוי, אין סיכון קריסה** כתוצאה מהעבודה הזו.
- הקובץ היחיד שנוצר הוא מסמך זה.
- `npm test` / `npm run typecheck` **לא הורצו** (לפי הוראת העצירה), ולא היה צורך — הקוד לא נגע.
