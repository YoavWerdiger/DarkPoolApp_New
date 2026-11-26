# קטלוג קומפוננטות ומערכת עיצוב (פריטים 45–47)

מסך חדש נבנה **רק** מהרכיבים והטוקנים כאן. אין צבעי hex / rgba בקוד מסך (ESLint מזהיר — `npm run lint`),
אין `fontSize` מקומי מחוץ לסקאלות הטיפוגרפיה, ואין ריווח / רדיוס שלא מהסקאלה.

## טוקנים

```ts
const tokens = useDesignTokens();        // בתוך רכיב — לפי ערכת הנושא
import DesignTokens from 'components/ui/DesignTokens'; // סטטי — רק onMedia / ערכים שלא תלויים בערכה
```

### צבעים סמנטיים (נעולים ב-`__tests__/ui/semanticPalette.test.ts`)

| קבוצה | מפתחות | מתי |
|---|---|---|
| `colors.market` | `gain` · `loss` · `extended` · `flat` | **רק** שינויי מחיר / תשואה. תמיד עם ▲▼ או +/− — לא צבע לבד |
| `colors.status` | `success` · `danger` · `warning` · `info` | סטטוסים, הודעות, שגיאות — לא מחירים |
| `colors.neutral` | `0`…`7` | 0 = קנבס, 1 = כרטיס, 2–4 = משטחים / מפרידים, 5–7 = טקסט (חלש → ראשי) |
| `colors.text` | `primary` · `secondary` · `tertiary` | טקסט רגיל |
| `colors.background` | `primary` · `cardSolid` · `tertiary` | קנבס / כרטיס / משטח פנימי |
| `colors.primary.main` | — | **מותג** — רק לפעולה הראשית במסך |
| `colors.onMedia` | `text` · `textMuted` · `control` · `scrim*` · `base` · `record` | כרום מעל תמונה / מצלמה / סטורי. קבוע בשתי הערכות |

כל צבע ב-`market` / `status` עובר ניגודיות **4.5:1** מול הקנבס ומול הכרטיס, בבהיר ובכהה.
⚠️ `text.tertiary` בכהה (#6B6B6B) הוא ~3.2:1 — רק למטא-דאטה לא חיוני, לא לטקסט שצריך לקרוא.

### ריווח — `tokens.spacing`

`2xs 2 · xs 4 · sm 8 · md 12 · base 16 · lg 20 · xl 24 · 2xl 32 · 3xl 40 · 4xl 48 · 5xl 64`
פריסת מסך: `APP_LAYOUT` (`screenPaddingHorizontal`, `cardStackGap`, `sectionGap`...).

### רדיוס — `tokens.borderRadius`

`xs 4 · sm 8 · md 12 · lg 20 · xl 24 · 2xl 28 · full` (כפתורים / צ'יפים / חיפוש = `full`).

### טיפוגרפיה

`APP_TYPE` (`screenTitle` · `cardTitle` · `cardBody` · `body` · `caption`), ובמודולים: `DARK_POOL_TYPE`, `JOURNAL_TYPE`.
גופן מינימלי 11, הגדלת מערכת עד ×1.3 (גלובלי — `components/ui/appFont.ts`).

## רכיבים

| רכיב | קובץ | שימוש |
|---|---|---|
| **כפתור** `UIButton` | `components/ui/UIButton.tsx` | `variant`: primary (פעולה אחת במסך) · secondary · ghost · outline · hairline · danger. `size`: sm / md / lg. רטט מובנה |
| **כרטיס** `UICard` | `components/ui/UICard.tsx` | `variant="soft"` ברירת המחדל לתוכן. `padding`: none / md / lg |
| **שורה** `SettingsActionRow` / `SettingsSwitchRow` | `components/profile/ProfileSettingsUI.tsx` | רשימות הגדרות / תפריטים בתוך `SettingsGlassCard` |
| **מתג** `AppSwitch` | `components/ui/AppSwitch.tsx` | רטט מובנה |
| **טאבים** `SegmentedTabs` | `components/ui/SegmentedTabs.tsx` | בורר טאבים שקוף עם קו תחתון — כל טאבים בראש מסך |
| **שיט** `ChatBottomSheet` / `BottomSheet` | `components/chat/ChatBottomSheet.tsx`, `components/ui/BottomSheet/` | `fitContent` לגובה התוכן; `SheetActionButton` לפעולות |
| **דיאלוג** `showAppDialog` / `showAppConfirm` / `showAppAlert` | `utils/appDialog.ts` | במקום `Alert.alert`. יותר משני כפתורים → עמודה |
| **ריק** `EmptyState` | `components/ui/EmptyState.tsx` | רשימה ריקה — הזמנה לפעולה, לא התנצלות |
| **שגיאה** `ErrorState` | `components/ui/ErrorState.tsx` | שגיאת טעינה בתוך המסך + «נסה שוב» (לא Alert) |
| **שלד** `SkeletonBox` / `SkeletonLine` | `components/ui/SkeletonLoader.tsx` | טעינה — בצורת התוכן, לא ספינר |
| **מצב שוק** `MarketStatusPill` | `components/ui/MarketStatusPill.tsx` | Pre / פתוח / After / סגור + ספירה לאחור |
| **דיסקליימר** `InvestmentDisclaimer` | `components/legal/InvestmentDisclaimer.tsx` | בכל מסך עם תיק / עסקה / פוזיציה |
| **אין חיבור** `OfflineBanner` | `components/OfflineBanner.tsx` | גלובלי (App.tsx) |

## עיצוב מספרים ותאריכים

`utils/format/number.ts` — `formatPrice` · `formatPercentChange` (תמיד סימן + 2 ספרות) · `formatCompact` · `formatVolume`.
`utils/format/date.ts` — הכל בשעון ישראל; `formatTimeEt` רק כשמציינים ET במפורש.

## אייקונים

**ספרייה אחת: Ionicons** (`@expo/vector-icons`) — 152 קבצים.
חוב: `lucide-react-native` ב-38 קבצים, ו-MaterialCommunityIcons / Feather בתפריט הצדדי ובעורך הסטורי —
להעביר ל-Ionicons כשנוגעים בקובץ (לא בבת אחת — שינוי חזותי).

## מצב ההגירה

- צבעים קשיחים: 863 → ~750 (`npm run lint`, כלל `no-restricted-syntax`). המסכים הבאים בתור: ChatMessage, Portfolios, DarkPool.
- טסטי עיצוב ישנים שבדקו טקסט קוד של עיצובים שהוחלפו — הוסרו עם הערה «הוסר: <סיבה>».
