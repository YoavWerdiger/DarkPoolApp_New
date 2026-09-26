# טופולוגיית טיפוגרפיה וטפסים — Dark Pool / Soft UI

> **מקור אמת בקוד:** `components/ui/appType.ts`, `components/ui/appLayout.ts`, `components/ui/formControl.ts`  
> **כיוון עיצוב:** [DARKPOOL_DESIGN_DIRECTION.md](./DARKPOOL_DESIGN_DIRECTION.md)  
> **כרטיסים ו-KPI:** ראו גם סקשן «כרטיס» ב-`appType` (cardTitle, cardMetricValue, …)

---

## 1. עקרונות

1. **סקאלה אחת** — אותם מספרים ביומן, Dark Pool, תיקים, רישום ו-settings (`APP_TYPE`).
2. **שלוש רמות צבע טקסט** — `textPrimary` / `textSecondary` / `textMuted` (`SoftUI`).
3. **כותרת + תת-כותרת צמודות** — מרווח **2px** (`APP_LAYOUT.titleSubtitleGap` / `cardTitleToSubtitleGap`).
4. **ירוק = פעולה (CTA)** — לא מסגרת/רקע של שדה קלט בפוקוס.
5. **RTL** — `appPhysicalRightText` (direction `ltr` + `textAlign: 'right'`) בתוך עץ `direction: 'rtl'`.

---

## 2. סקאלת `APP_TYPE`

| טוקן | גודל | משקל | line | שימוש |
|------|------|--------|------|--------|
| `screenTitle` | 24 | 700 | 28 | כותרת מסך ממורכזת (MainDrawer, Chat) |
| `flowTitle` | 28 | 700 | 34 | כותרת מסך **רישום / onboarding** (focused) |
| `flowTitleCompact` | 24 | 700 | 28 | כותרת רישום במסכים צפופים |
| `sectionTitle` | 22 | 800 | 28 | כותרת סקשן **מחוץ** לכרטיס |
| `sectionSubtitle` | 15 | 400 | 22 | תת-כותרת (אפור `#AAA5A0`) |
| `cardTitle` | 17 | 700 | 22 | כותרת **בתוך** UICard |
| `cardSubtitle` | 13 | 500 | 18 | משנה מתחת לכותרת כרטיס |
| `cardBody` | 15 | 400 | 22 | פסקה / הסבר בכרטיס |
| `body` | 16 | 400 | 24 | טקסט כללי, **תוכן שדה קלט** |
| `cardMetricLabel` | 12 | 600 | 16 | תווית KPI / תווית שדה |
| `cardMetricValue` | 28 | 700 | 32 | ערך ראשי (P&L, Win Rate) |
| `cardMetricValueSecondary` | 20 | 700 | 24 | ערך משני בתא KPI |
| `caption` / `caption2` | 12 / 11 | 500 | 16 / 14 | רמז, footnote |

### Styles מוכנים (ייבוא מ-`appType`)

| Style | מתי |
|--------|-----|
| `appScreenTitleStyle` + `appScreenSubtitleStyle` | הדר מגירה, ממורכז |
| `appFlowTitleStyle` + `appFlowSubtitleStyle` | `OnboardingLayout` / `CashAppScreen` |
| `appSectionTitleStyle` | כותרת מעל רשימת כרטיסים |
| `appCardTitleStyle` + `appCardSubtitleStyle` | כותרת+משנה בכרטיס |
| `appCardBodyStyle` | גוף כרטיס |
| `appFormFieldLabelStyle` + `appFormFieldHelperStyle` | תווית + helper לשדות |
| `appCardMetricLabelStyle` / `appCardMetricValueStyle` | KPI |

---

## 3. מרווחים (`APP_LAYOUT`)

| טוקן | px | שימוש |
|------|-----|--------|
| `titleSubtitleGap` | 2 | כותרת ↔ תת-כותרת (מסך / רישום) |
| `cardTitleToSubtitleGap` | 2 | כותרת כרטיס ↔ משנה |
| `cardTitleToBodyGap` | 12 | כותרת כרטיס ↔ גרף / רשימה |
| `cardMetricLabelToValueGap` | 4 | תווית KPI ↔ ערך |
| `sectionHeaderToContent` | 16 | בלוק כותרת רישום ↔ שדות |
| `sectionGap` | 40 | בין סקשנים במסך |
| `cardStackGap` | 16 | בין כרטיסים |

---

## 4. כרטיסים (UICard `soft`)

```
┌─ cardTitle (17 / 700 / primary) ─────────────┐
│ cardSubtitle (13 / 500 / secondary)  +2px   │  ← אופציונלי
│                    +12px                     │
│ cardBody / chart / KPI grid                  │
└──────────────────────────────────────────────┘
```

**מימוש:** `JournalDataTab`, `PortfolioCard`, `OverviewTab`, `WatchlistRow` — פירוט ביררכיה בסקשן 4.5.

---

## 4.5 היררכיית KPI ומספרים

> **מקור:** `APP_TYPE` ב-`appType.ts` · ייבוא מודולי דרך `journalLayout` / `portfolioLayout` · רישום מודולים ב-`productTopology.ts` (סקשן 8).

### שלוש רמות + רשימות צפופות

| טוקן | px | משקל | מתי (כלל אצבע) |
|------|-----|--------|----------------|
| **`cardMetricValue`** | 28 | 700 | **מספר דומיננטי אחד** בכרטיס / בראש מסך — שווי תיק, ערך בכותרת גרף, KPI «גיבור» כשהוא באמת היחיד שצריך לבלוט |
| **`cardMetricValueSecondary`** | 20 | 700 | **רשת KPI** — שורת מדדים מתחת לערך ראשי, תאים קטנים (`KpiBlock`), pills, Win Rate / P&L ביומן כשלא רוצים להתחרות בגודל עם שווי תיק |
| **`cardBody`** (15) / **`body`** (16) | 15 / 16 | 400–600 | **מחירים ומספרים בשורות רשימה** — watchlist, טקסט חיפוש, סימבול; לא tier KPI |

**אל תשתמשו ב-28 לכל KPI בשורה** — משוב מוצר: מספרים «גיבור» ביומן וב-watchlist היו גדולים מדי; שווי תיק בכרטיס תיק נשאר **28**, שאר המדדים **20** או **15**.

### יומן (`JournalDataTab`)

| אזור | Style | הערה |
|------|--------|------|
| `JournalHeroKpis` — P&L כולל + Win Rate | `journalCardMetricValueSecondaryStyle` (**20**) | כרטיס אחד, שתי עמודות; `kpiMetricValueHero` |
| `KpiBlock` / שורת KPI משנית | `journalCardMetricValueSecondaryStyle` (**20**) | `kpiMetricValue` |
| Mini pills / coverage | secondary (**20**) | לא 28 |
| כותרת סקשן מחוץ לכרטיס | `journalSectionTitleStyle` (22) | סקשן 9 |

בדיקות: `journalHeroKpi.test.ts`, `journalTypography.test.ts`.

### תיקים — כרטיס (`PortfolioCard`)

```
cardTitle (17) + cardSubtitle (13)
        ↓
שווי תיק — cardMetricLabel (12) + cardMetricValue (28)   ← דומיננטי
        ↓
יומי | רווח כולל | הצלחה — cardMetricLabel + cardMetricValueSecondary (20)
```

- **`valueAmount`** → `journalCardMetricValueStyle` (28).
- **`kpiValue`** → `journalCardMetricValueSecondaryStyle` (20).
- אותה לוגיקה ב-`PortfolioSummaryHeader`, `PortfolioValueChart` (כותרת), `CommunityPortfolioLeaderCard`.

### רשימת תיקים — חיפוש ומיון (`PortfoliosTab`)

אותה **שפה ויזואלית כמו `formControl`** (רקע, בלי מסגרת) — לא חובה לייבא `formFieldShellStyle` במסך רשימה.

| אלמנט | מימוש |
|--------|--------|
| **שדה חיפוש** | `searchCardWrap`: `background.input`, **`borderWidth: 0`**; טקסט `JOURNAL_TYPE.body` (16) + `journalPhysicalRightText` |
| **כפתור מיון / פילטר** | עיגול 44×44, **`background.navChrome`**, **`borderWidth: 0`** — chrome משני (כמו `UIButton variant="secondary"`), לא CTA ירוק |
| אייקון פילטר פעיל | `primary.main`; ברירת מחדל `text.secondary` |

מרווח אופקי: `tokens.layout.screenPadding` / `PRODUCT_TOPOLOGY.screenPaddingHorizontal` (20).

### Watchlist — מחיר בשורה

- מחיר / מספר עיקרי: **`APP_TYPE.cardBody`** (15, weight 600) — `WatchlistRow` `num`.
- סימבול: **`body`** (16, 700).
- שינוי יומי: **`caption`** (12).

### Styles מוכנים (KPI)

| Style | טוקן |
|--------|------|
| `appCardMetricValueStyle` / `journalCardMetricValueStyle` | 28 |
| `appCardMetricValueSecondaryStyle` / `journalCardMetricValueSecondaryStyle` | 20 |
| `appCardMetricLabelStyle` | 12 |

### קשר לסקשנים 8–12

- **8** — כל מודול חייב `*_TYPE === APP_TYPE`; תיקים + יומן משתפים `journalLayout` ל-KPI.
- **9** — פירוט יומן/תיקים; טפסי תיק נפרדים (`formControl`).
- **10** — `portfolioFormFields.test.ts` (טפסים + guards רשימת תיקים), `portfoliosTypography.test.ts` (כרטיס), `productTopology.test.ts`.
- **11** — מסך חדש: tier אחד דומיננטי 28, שאר KPI ב-20, רשימות ב-15/16.
- **12** — Cursor rule מסכם card KPI 28 + שדות ללא border.

---

## 5. זרימת רישום (Auth)

### מעטפת מסך

- **`CashAppScreen`** → **`OnboardingLayout`**
- כותרת: `appFlowTitleStyle` (או `appFlowTitleCompactStyle`)
- תת-כותרת: `appFlowSubtitleStyle` — **אפור secondary, 2px מתחת לכותרת**
- מרווח עד שדות: `sectionHeaderToContent` (16)

**דוגמה — שם מלא (`RegistrationNameScreen`):**

| שכבה | טקסט | Style |
|------|------|--------|
| כותרת | «איך קוראים לך?» | `appFlowTitleStyle` |
| תת-כותרת | «השם יופיע בפרופיל…» | `appFlowSubtitleStyle` |
| תווית שדה | «שם מלא» | `formFieldLabelStyle` / metric label |
| קלט | 16 / body | `formFieldInputStyle` |
| helper | «לפחות שני תווים» | `appFormFieldHelperStyle` |

### שדות קלט

- **`OnboardingInput`** / **`CashAppInput`** → **`formControl.ts`**
- **מסגרת:** **ללא border** — רק `background.input` / `background.tertiary` בפוקוס
- **פוקוס:** רקע `background.tertiary` — **בלי** ירוק ובלי `borderColor`
- **שגיאה:** רקע `#F87171` שקוף (~10%) + טקסט `danger`
- **OTP:** `OtpInput` — אותה לוגיקת רקע (ללא מסגרת)
- **אייקונים:** **לא** בתוך תיבת הקלט (mail/lock/person). הצג/הסתר סיסמה — קישור טקסט ליד התווית

### מה לא לעשות

- ❌ `borderWidth` / `borderColor` על shell שדה (מלבד מקרים חריגים מחוץ ל-Auth)
- ❌ `borderColor: primary.main` על TextInput / shell
- ❌ רקע ירוק שקוף בפוקוס
- ❌ אייקוני Ionicons/Lucide **בתוך** שדה הקלט
- ✅ ירוק רק ב-`UIButton` / `OnboardingButton` **primary**, progress bar, success states מכוונים
- ✅ כפתור משני (למשל «יש לי כבר חשבון» במסך Welcome) — **`UIButton variant="secondary"`** (`navChrome`, טקסט primary)

### כפתורים גלובליים (Auth / רישום)

| variant | רקע | טקסט | דוגמה |
|---------|-----|------|--------|
| `primary` | `#00C805` | inverse | «המשך», «התחבר» |
| `secondary` / `hairline` | `navChrome` (`surface2`) | primary | «יש לי כבר חשבון» |
| `ghost` | שקוף | primary (לא לקישורי טקסט ירוקים) | שימוש מצומצם |

`CashAppButton` = `OnboardingButton` — secondary מיושר ל-`UIButton.secondary`.

---

## 6. `formControl.ts` — API

```ts
formFieldBorderColor({ tokens, focused, error })
formFieldShellStyle({ tokens, focused, error, multiline })
formFieldLabelStyle({ tokens, focused, error })
formFieldInputStyle()
```

`formFieldBorderColor` — legacy (OTP/tests); shell לא משתמש בגבול. קבוע: `FORM_FIELD_FOCUS_BORDER`.

---

## 7. מיפוי מסכי רישום (Auth stack)

| מסך | כותרת / משנה | שדות |
|-----|----------------|------|
| `RegistrationNameScreen` | flow title + subtitle | `CashAppInput` שם מלא |
| `RegistrationPhoneScreen` | flow | טלפון (autoFormat) |
| `RegistrationEmailScreen` | flow | אימייל |
| `RegistrationPasswordScreen` | flow | סיסמה |
| `Registration*Verification*` | flow | `OtpInput` |
| `RegistrationProfileImageScreen` | flow | בחירת תמונה (לא TextInput) |
| `RegistrationIntroQuestionScreen` | flow | בחירות (לא shell ירוק) |
| `RegistrationSummaryScreen` | compact | סיכום — halo/neutral, לא ירוק על ring |

Onboarding (`screens/Onboarding/*`) — אותה מעטפת אם משתמשים ב-`OnboardingLayout` + `OnboardingInput`.

---

## 8. מפת מוצר — כל המערכות

מקור רישום: `components/ui/productTopology.ts` (`PRODUCT_MODULES`).

| מערכת | Layout / Type | כותרת מסך | כותרת סקשן | כרטיס | טפסים |
|--------|----------------|-----------|------------|--------|--------|
| **יומן מסחר** | `journalLayout.ts` · `JOURNAL_TYPE` | MainDrawer | `journalSectionTitleStyle` (22) | `journalCard*` + KPI | — |
| **תיקים** | `portfolioLayout.ts` · `PORTFOLIO_TYPE` | `PortfolioScreenHeader` | section 22 | `UICard soft` + KPI | `PortfolioFormFields` · `formControl` |
| **Dark Pool** | `darkPoolLayout.ts` · `DARK_POOL_TYPE` | MainDrawer | `darkPoolSectionTitleStyle` | פיד: `FEED_CARD_TYPE` ← `APP_TYPE` | — |
| **אקדמיה** | `academyLayout.ts` · `ACADEMY_TYPE` | MainDrawer / stack | section 22 | `CourseCard` · `LessonRow` · `appCard*` | — |
| **צ'אט** | `chatLayout.ts` · `CHAT_TYPE` | `ChatSubScreenHeader` / מגירה | section / sheet | בועות (נפרד) · הגדרות קבוצה → `settingsType` | — |
| **שווקים / מדדים** | `marketsLayout.ts` · `MARKETS_TYPE` | MainDrawer | section 22 | כרטיסי movers / grid | — |
| **הגדרות / פרופיל** | `settingsType.ts` · `SETTINGS_TYPE` | ממורכז / stack | hero 22 · row 17 | `ProfileMenuRow` | — |
| **Auth / onboarding** | `APP_TYPE` ישירות | `appFlowTitle*` | — | `UICard` / glass | `OnboardingInput` · `UIInput` · `OtpInput` |

**מרווחים אחידים:** `APP_LAYOUT.screenPaddingHorizontal` (20), `cardStackGap` (16), `cardTitleToSubtitleGap` (2), `cardTitleToBodyGap` (12).

---

## 9. יומן ותיקים (פירוט)

- ייבוא דרך `journalLayout.ts` / `screens/Portfolios/portfolioLayout.ts` (אותה סקאלה).
- כותרת סקשן **מחוץ** לכרטיס: `journalSectionTitleStyle` (22).
- כותרת **בתוך** `UICard variant="soft"`: `journalCardTitleStyle` (17) + `journalCardSubtitleStyle` (+2px).
- KPI בכרטיס: תווית `journalCardMetricLabelStyle` (12); **שווי דומיננטי** `journalCardMetricValueStyle` (28); **שורת מדדים** `journalCardMetricValueSecondaryStyle` (20) — ראו **4.5**.
- Hero יומן (`JournalHeroKpis`): secondary (20), לא 28.
- רשימת תיקים: `PortfolioCard` + **`PortfoliosTab`** (חיפוש ללא border, פילטר `navChrome`) — סקשן 4.5.
- קהילה, Holdings, ייבוא CSV — מיושרים לטופולוגיה זו.
- **טפסי תיקים:** `portfolioFormLayout.ts` · `PortfolioFormFields` (`formControl`, `SectionHeader` = sectionTitle 22) · `PortfolioFormFooter` (`UIButton` primary). מסכים: `CreatePortfolio`, `ConnectBroker`, `SelectBrokerAccount`, `AddTransaction`, `ImportTransactions`.

---

## 10. בדיקות (Jest)

| קובץ | מה נשמר |
|------|---------|
| `__tests__/ui/productTopology.test.ts` | כל `*_TYPE` === `APP_TYPE` · רישום מודולים · guards cross-module |
| `__tests__/ui/appType.test.ts` | מספרי סקאלה · Journal / Dark Pool / Settings |
| `__tests__/ui/formControl.test.ts` | פוקוס לא ירוק |
| `__tests__/journal/journalTypography.test.ts` | יומן ↔ APP_TYPE |
| `__tests__/onboarding/onboardingLayoutTypography.test.ts` | flow styles |
| `__tests__/portfolios/portfoliosTypography.test.ts` | כרטיס תיק — value 28 vs KPI 20 |
| `__tests__/portfolios/portfolioFormFields.test.ts` | טפסי תיק · formControl · רשימת תיקים (חיפוש/פילטר) |
| `__tests__/learning/lessonCardTypography.test.ts` | אקדמיה · card gaps |
| `__tests__/ui/settingsTypography.test.ts` | הגדרות / קבוצה |
| `__tests__/darkpool/feedCardType.test.ts` | פיד · FEED_CARD_TYPE |

---

## 11. Checklist למסך חדש

- [ ] כותרת + תת-כותרת מ-`appFlow*` / `appScreen*` עם `titleSubtitleGap: 2`
- [ ] שדות через `OnboardingInput` / `UIInput` + `formControl` (לא styling ירוק מקומי)
- [ ] תוכן בכרטיס: `cardTitle` → (אופציונלי `cardSubtitle`) → `cardBody` / KPI
- [ ] CTA יחיד ירוק (`UIButton` primary)
- [ ] לא להוסיף גדלי פונט חד-פעמיים — הרחיבו `APP_TYPE` אם חסר tier
- [ ] ייבוא טיפוגרפיה מ-`*Layout.ts` של המודול (ראו `productTopology.ts`)

---

## 12. Cursor rule

`.cursor/rules/typography-form-topology.mdc` — הנחיה לסוכן בעת עריכת מסכים/קומפוננטות.

---

*עודכן עם Soft UI — canvas `#0E0D0D`, כרטיסים `UICard variant="soft"`.*
