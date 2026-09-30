# טופולוגיית טיפוגרפיה וטפסים — Dark Pool / Soft UI

> **מקור אמת בקוד:** `components/ui/appType.ts`, `components/ui/appLayout.ts`, `components/ui/formControl.ts`  
> **כיוון עיצוב:** [DARKPOOL_DESIGN_DIRECTION.md](./DARKPOOL_DESIGN_DIRECTION.md)  
> **כרטיסים ו-KPI:** ראו גם סקשן «כרטיס» ב-`appType` (cardTitle, cardMetricValue, …)

---

## 1. עקרונות

1. **סקאלה אחת** — אותם מספרים ביומן, Dark Pool, תיקים, רישום ו-settings (`APP_TYPE`). Heebo דרך `installAppFont`. בלי `fontSize` מקומי ובלי משקל 800.
2. **שלוש רמות צבע טקסט** — `textPrimary` / `textSecondary` / `textMuted` (`SoftUI`).
3. **כותרת + תת-כותרת צמודות** — מרווח **2px** (`APP_LAYOUT.titleSubtitleGap` / `cardTitleToSubtitleGap`).
4. **ירוק = accent** — `#00C805` למותג ולהצלחה. CTA ראשי בכהה הוא גלולה לבנה עם טקסט `#1A1918`. לא מסגרת שדה, לא פוקוס, לא טבעת אווטאר.
5. **RTL** — `appPhysicalRightText` (direction `ltr` + `textAlign: 'right'`) בתוך עץ `direction: 'rtl'`.
6. **טוקנים, לא hex במסך** — `useDesignTokens()` כדי שמצב בהיר יעקוב. מעבר ערכת נושא הוא crossfade ב-`ThemeContext` (blend), בלי כיסוי אטום.

---

## 1.1 משטחים — כרום מול תוכן

מקור: `softUiPalette.ts`, `designTokensStatic.ts` (`background.cardSolid` / `navChrome` / `border.divider`).

| | כהה | בהיר |
|--|------|------|
| קנבס | `#000000` | `#F4F2F1` |
| כרטיס תוכן (`UICard` `soft` / `cardSolid`) | `#1C1C1E` | `#FFFFFF` |
| טקסט ראשי | `#FFFFFF` | `#1E1A24` |
| טקסט משני / מושתק | `#8E8E93` / `#636366` | דרך טוקני `text` |
| מפריד | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.10)` |
| סכנה | `#EF4444` | אותו אדום |

**כרום מול תוכן**

- **תוכן** = כרטיס `soft` / `cardSolid` (`#1C1C1E` בכהה). אף פעם לא `#2C2C2E` כמילוי כרטיס.
- **כרום** = `surface2` `#2C2C2E` (`background.navChrome` / `background.tertiary`): ניווט, שדה מקונן, כפתור משני, בחירה שלישית. לא כרטיס תוכן.
- **דיאלוג** `UIAlert`: `cardSolid`, רדיוס `UI_CARD_RADIUS` (24), בלי זכוכית.
- **מפריד** 1px דרך `tokens.colors.border.divider`. בלי hex לבן קשיח, בלי `hairlineWidth` בשורות הגדרות. אין מפריד אחרי השורה האחרונה.
- רדיוס מעטפת: `UI_CARD_RADIUS` = **24**.

**שורת תפריט (הגדרות)**

- `paddingVertical` **15**, ריפוד אופקי `cardPadding` (16).
- אייקון מוביל → כותרת: **12** (`leadingIcon` `marginLeft: 12`, בלי `gap` נוסף על אותה שורה).
- אייקון מוביל: `text.primary`. סכנה נשארת `#EF4444`. שברון: `text.tertiary`.
- שורות תפריט פרופיל **בלי** תת-כותרת. מתגי התראות **שומרים** תת-כותרת ב-`cardTitleToSubtitleGap` (2px).
- תווית קבוצה (אישי, התראות, חיובים) **מחוץ** לכרטיס, מיושרת ל-inset של 20px (`groupLabel` 15/500, אפור, `groupLabelToContent` 8).

---

## 2. סקאלת `APP_TYPE`

| טוקן | גודל | משקל | line | שימוש |
|------|------|--------|------|--------|
| `screenTitle` | 24 | 700 | 28 | כותרת מסך ממורכזת (MainDrawer, Chat) |
| `flowTitle` | 28 | 700 | 34 | כותרת מסך **רישום / onboarding** (focused) |
| `flowTitleCompact` | 24 | 700 | 28 | כותרת רישום במסכים צפופים |
| `sectionTitle` | 22 | 700 | 28 | כותרת **תוכן** מחוץ לכרטיס (לבן, Heebo Bold) |
| `groupLabel` | 15 | 500 | 20 | תווית **קבוצה** מחוץ לכרטיס (אפור `#8E8E93`, 8px עד הכרטיס) |
| `sectionSubtitle` | 15 | 400 | 22 | תת-כותרת (אפור `#8E8E93`) |
| `cardTitle` | 17 | 600 | 22 | כותרת **בתוך** UICard (Heebo SemiBold) |
| `cardSubtitle` | 13 | 400 | 18 | משנה מתחת לכותרת כרטיס |
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
| `sectionHeaderToContent` | 12 | בלוק כותרת ↔ התוכן שמתחתיה |
| `groupLabelToContent` | 8 | תווית קבוצה אפורה ↔ כרטיס |
| `sectionGap` | 40 | בין סקשנים במסך |
| `screenPaddingHorizontal` | 20 | inset מסך (גם תוויות קבוצה) |
| `cardPadding` | 16 | ריפוד פנימי בכרטיס |
| `cardStackGap` | 12 | בין כרטיסים |

---

## 4. כרטיסים (UICard `soft`)

```
┌─ cardTitle (17 / 600 / primary) ─────────────┐
│ cardSubtitle (13 / 400 / secondary)  +2px   │  ← אופציונלי
│                    +12px                     │
│ cardBody / chart / KPI grid                  │
└──────────────────────────────────────────────┘
```

מילוי: `cardSolid` (`#1C1C1E` כהה / `#FFFFFF` בהיר). רדיוס 24. בלי stroke.

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

השורה יושבת על סקאלת הכרטיס, לא על caption.

- סימבול: **`cardTitle`** (17 / 600).
- מחיר: **`body`** (16 / 400).
- חברה, שינוי יומי, אחוז, ווליום, כותרת עמודה: **`cardSubtitle`** (13 / 400).

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
- **שגיאה:** רקע `#EF4444` שקוף (~10%) + טקסט `danger`
- **OTP:** `OtpInput` — אותה לוגיקת רקע (ללא מסגרת)
- **אייקונים:** **לא** בתוך תיבת הקלט (mail/lock/person). הצג/הסתר סיסמה — אייקון עין בצד שמאל בתוך מעטפת השדה

### מה לא לעשות

- ❌ `borderWidth` / `borderColor` על shell שדה (מלבד מקרים חריגים מחוץ ל-Auth)
- ❌ `borderColor: primary.main` על TextInput / shell
- ❌ רקע ירוק שקוף בפוקוס
- ❌ אייקוני Ionicons/Lucide **בתוך** שדה הקלט (מלבד עין הצג/הסתר סיסמה)
- ✅ ירוק `#00C805` נשאר accent / success. CTA ראשי (`UIButton` primary) בכהה הוא לבן, לא ירוק
- ✅ כפתור משני (למשל «יש לי כבר חשבון» במסך Welcome) — **`UIButton variant="secondary"`** (`navChrome`, טקסט primary)

### כפתורים גלובליים (Auth / רישום)

| variant | רקע | טקסט | דוגמה |
|---------|-----|------|--------|
| `primary` | בהיר `#010000` (`primary.lightCta`), כהה `#FFFFFF` — pill (`borderRadius.full`), תווית 600 | inverse (לבן בבהיר, `#1A1918` בכהה) | «המשך», «שמור» |
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
| **הגדרות / פרופיל** | `settingsType.ts` · `SETTINGS_TYPE` | ממורכז / stack | hero 22 · row 17 | `ProfileMenuRow` | `EditProfileScreen` · `formControl` (בלי מסגרת, בלי טבעת ירוקה) |
| **Auth / onboarding** | `APP_TYPE` ישירות | `appFlowTitle*` | — | `UICard` / glass | `OnboardingInput` · `UIInput` · `OtpInput` |

**מרווחים אחידים:** `APP_LAYOUT.screenPaddingHorizontal` (20), `cardStackGap` (12), `cardTitleToSubtitleGap` (2), `cardTitleToBodyGap` (12).

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

*עודכן לטופולוגיית התוכן: קנבס `#000000`, כרטיס `#1C1C1E`, רדיוס 24, ריפוד 16, רווח בין כרטיסים 12. הניווט לא השתנה. מצב בהיר: קנבס `#F4F2F1`, כרטיס `#FFFFFF`.*
