# InsiderWave — מפרט בנייה כנה

> **סטטוס:** מקור האמת הוא ארכיטקטורת הכנות שאושרה (2026-09-18).  
> **לא** מיישמים שחזור מניות / שווי תיק מדויק / Win Rate / Expectancy מדיווחי STOCK Act.  
> קשור: [`INSIDERWAVE_FEATURE_MAP.md`](./INSIDERWAVE_FEATURE_MAP.md) · [`QUIVER_API_AUDIT.md`](./QUIVER_API_AUDIT.md) · [`CURATED_ROSTER_PLAN.md`](./CURATED_ROSTER_PLAN.md) · [`DARKPOOL_IA_BLUEPRINT.md`](./DARKPOOL_IA_BLUEPRINT.md)

מקרא: ✅ כבר יש · ✅ Quiver מחזיר — להשתמש · ⚠️ הערכה רק עם תווית · 🚫 אי אפשר ביושר

---

## 0. עובדות שהספק המקורי טעה בהן

1. **STOCK Act = טווחי סכום, לא מניות.** `Q_i,t = sum(bought − sold shares)` **לא ניתן לחישוב** מדיווחי קונגרס. «25 shares at $545.83» של InsiderWave הוא היסק. **אסור להעתיק לפוליטיקאים.**
2. **`GET /beta/historical/congresstrading/{member_name}` שגוי.** ב-`schema.json` ההיסטוריה היא `{ticker}`. לפי אדם: `GET /beta/bulk/congresstrading?bioguide_id=`. אצלנו: `quiverQuant.ts` + `dark_pool_congress_trades`.
3. **Win Rate מ-round-trips** — אין lots. **Expectancy מ-R משוחזר** — אסור. חלופה כנה: % עסקאות עם `ExcessReturn > 0` («היכה את S&P»).
4. **Options strike / expiration / contracts** — אין ב-PTR. Form 4 זה מסלול אחר (`InsiderTradeCard` / `insiderTradeDisplay.ts`).
5. **לא ליצור טבלאות `trades` / `investors` מקבילות.** מרחיבים את `dark_pool_congress_trades`, `dark_pool_followed_investors`, `dark_pool_uw_snapshots`, `dark_pool_person_portfolio_snapshots`.
6. **אחזקות אמת:** cache `quiver_congress_holdings` (`CurrentHolding`, `Allocation`) לפי `bioguide_id` — לא buy-minus-sell.
7. **מאז העסקה:** `price_change_pct` / `excess_return_pct` (מיגרציה `20260917210000_congress_trade_quiver_returns.sql`). Yahoo רק כש-null, ועם תווית.
8. **Avg Delay** = `filed_at − transaction_date` — כנה.
9. **Most Followed** = COUNT מ-`dark_pool_followed_investors` (+ AsyncStorage). בלי «$ copied».
10. **Top Performers ALL +3051%** — 🚫. אופציונלי: חציון `ExcessReturn` עם תווית «עודף תשואה מול S&P (Quiver)».

---

## 1. פיד

| שדה / endpoint / נוסחה | פסק דין | במקום / קובץ |
|---|---|---|
| `live/congresstrading` + `dark_pool_congress_trades` לפי `filed_at` | ✅ כבר יש | `useCongressFeed` · `darkPoolDbCacheService.listCongressTradesFromDb` |
| תאריך כפול `filed_at` + `transaction_date` | ✅ כבר יש | `buildDualDateLine` · `DarkPoolTradeFeedCard` |
| טווח `amount_label` (לא מניות) | ✅ כבר יש | `formatDisclosedAmountRangeCompact` · `CongressTradeCard` |
| `PriceChange` → `price_change_pct` | ✅ Quiver מחזיר | `CongressTradeCard` `changeSinceTradePct={trade.price_change_pct}` |
| `ExcessReturn` בכרטיס | ✅ שמור ב-DB; מוצג בפרטי עסקה | `DarkPoolTradeDetailScreen` |
| מחיר quote חי | ⚠️ אופציונלי | `DARK_POOL_FEED_ENRICH_QUOTES` — כבוי ב-SEC |
| Form 4 shares/price | ✅ אמיתי לבכיר | `InsiderTradeCard` · `insiderTradeDisplay.ts` |
| צ'יפי בכיר/קונגרס | הוסרו בכוונה | אל תחזיר |
| טאבים פיד / גילוי / מעקב | ✅ | `navigation/DarkPoolTabs.tsx` |
| `Q_i,t` מניות משוחזרות | 🚫 | טווח מדווח |
| חוזים / strike | 🚫 | לא בכרטיס |

---

## 2. גילוי

| שדה / נוסחה | פסק דין | במקום / קובץ |
|---|---|---|
| חיפוש שם / טיקר | ✅ | `useInvestorSearch` + `explorePersonMatchesQuery` |
| חיפוש מפלגה / מדינה / בית | ⚠️ מול `subtitle` מאוצר (Party/State נזרקים מה-sync) | `exploreGrid.ts` · placeholder «שם, מפלגה, מדינה או טיקר» |
| Most Followed = COUNT follows | ✅ כנה | `countFollowedInvestors` · `dark_pool_followed_investors` |
| `$ copied` | 🚫 | לא מציגים |
| Top Performers מ-TWR / ALL +3051% | 🚫 | לא `ExploreTopPerformersSection` על `returns[period]` |
| חציון `ExcessReturn` | ✅ Quiver | `listPoliticianMedianExcessLeaders` · תווית «עודף תשואה מול S&P» |
| גרף/תשואה מ-`chart_unreliable` | 🚫 | משמיטים את הרייל אם אין `excess_return_pct` |

---

## 3. פרופיל

| שדה / נוסחה | פסק דין | במקום / קובץ |
|---|---|---|
| אחזקות `CurrentHolding` + `Allocation` | ✅ Quiver | cache `quiver_congress_holdings` · `listCongressHoldingsByBioguide` · `holdings_source === 'quiver_estimate'` |
| `amount_usd` / `company_name` בסכימת Quiver | 🚫 לא קיימים | `Ticker` + `CurrentHolding` + `Allocation` (`Name` = הפוליטיקאי) |
| שחזור buy−sell כמקור אמת | 🚫 | `congressPortfolio.ts` לא הופך ל-SoT |
| עקומת equity | ⚠️ רק `chart_reliable === true` | `prepareReconstructedChartSeries` · אחרת בלי גרף |
| Avg Delay | ✅ | `fetchCongressPersonHonestyStats` · `disclosureDelayDays` |
| Beat-S&P מ-`ExcessReturn` | ✅ עם שם עברי כנה | `beatSpyRate` — **לא** «Win Rate» |
| Expectancy | 🚫 | לא מוצג |
| `computeWinRate` על מכירות | 🚫 | לא ב-UI |
| Trump `Amount` דולר ממשי | ✅ מסלול נפרד | `reconstruction_actual_usd` |

---

## 4. פרטי עסקה

| שדה | פסק דין | קובץ |
|---|---|---|
| טבלה כנה: פעולה, טווח, שני תאריכים, delay | ✅ | `DarkPoolTradeDetailScreen` |
| `PriceChange` / `ExcessReturn` / `SPYChange` | ✅ Quiver | אותם שדות DB |
| Strike / contracts לקונגרס | 🚫 | אין שורה |
| Form 4 shares/price | ✅ מסך `kind:'insider'` | לא לערבב בנוסחאות קונגרס |
| הקשה על טיקר | ✅ | `DarkPoolTicker` |

---

## 5. מיפוי טיפוסים (בלי `src/types/insider.ts`)

| הספק | אצלנו |
|---|---|
| `amountRange` | `CongressFeedTrade.amount_label` + `CongressTradeHonestyFields.amountRange` |
| `priceChange` | `price_change_pct` |
| `excessReturn` | `excess_return_pct` |
| `report_date` | `filed_at` |
| `ActualHolding.currentValueUSD` | Quiver `CurrentHolding` |
| `ActualHolding.portfolioPercent` | Quiver `Allocation` (שבר 0–1 → %) |
| `congress_stock_holdings` table | **אין.** `dark_pool_uw_snapshots` / `quiver_congress_holdings` |

---

## 6. מה אומץ / מה נדחה

**אומץ:** תאריך כפול, טווח סכום, `PriceChange`/`ExcessReturn` מ-DB, Avg Delay, Beat-S&P, אחזקות bioguide, Most Followed מ-COUNT, רייל עודף תשואה מתויג, טאבים פיד/גילוי/מעקב.

**נדחה:** שחזור `Q_i,t`, שווי תיק לסנט, Win Rate, Expectancy, חוזי אופציות, `$ copied`, ALL +3051%, טבלאות `trades` מקבילות, historical לפי שם אדם.
