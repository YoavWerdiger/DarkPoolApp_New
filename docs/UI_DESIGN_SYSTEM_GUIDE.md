# מדריך מערכת העיצוב – UICard, DesignTokens ורקעים

## המבנה הנוכחי

### 1. DesignTokens (`components/ui/DesignTokens.ts`)

**רקעים (Dark Theme):**
| טוקן | ערך | שימוש |
|------|-----|-------|
| `background.primary` | `#0D1210` | רקע מסך ראשי (charcoal + ירוק) |
| `background.secondary` | `#131A18` | רקע משני |
| `background.tertiary` | `#1A2320` | כרטיסים, sheets |
| `background.elevated` | `#111111` | משטחים מורמים |
| `background.elevated2` | `#1A1A1A` | מודלים, tooltips, **טאב בר** |

**Glass (לכרטיסים):**
| טוקן | ערך | שימוש |
|------|-----|-------|
| `glass.card.bg` | `rgba(255,255,255,0.07)` | שכבת overlay על BlurView |
| `glass.card.border` | `rgba(255,255,255,0.12)` | גבול עדין |

---

### 2. UICard – איך הוא בנוי היום

**Variants קיימים:**
- `default` – רקע מוצק (`background.secondary`)
- `elevated` – רקע `#111111` + צל
- `outlined` – שקוף + גבול
- `accent` – שקוף + גבול ירוק
- `glass` / `blur` – **ברירת מחדל** – 3 שכבות:
  1. **BlurView** (iOS) או View מוצק (Android) – `rgba(28,28,30,0.92)`
  2. **Overlay** – `colors.glass.card.bg` = `rgba(255,255,255,0.07)`
  3. **Border** – `colors.glass.card.border` = `rgba(255,255,255,0.12)`

**הבעיה:** על רקע כהה, BlurView כמעט לא נראה – הכרטיס נראה כמלבן כהה. הגבול והעובי נראים "מוזרים" לפעמים.

---

## מה אפשר לעשות

### אופציה א': UICard מוצק (ללא Blur/Glass)

להוסיף variant חדש `solid` או לשנות את `elevated` כך שיהיה ברירת מחדל:

```tsx
<UICard variant="elevated" padding="lg">
```

- רקע: `#111111` או `background.elevated2` (#1A1A1A)
- ללא BlurView, ללא overlay, ללא גבול
- מראה נקי ועקבי – כמו הטאב בר

### אופציה ב': UICard מוצק עם variant חדש `surface`

```tsx
<UICard variant="surface" padding="lg">  // רקע elevated2, ללא blur
```

### אופציה ג': לפשט את `glass`/`blur` (בלי BlurView)

- להסיר BlurView
- להשאיר רק שכבת רקע: `backgroundColor: colors.background.elevated2` או `colors.background.tertiary`
- אופציונלי: גבול עדין מאוד `borderColor: colors.border.primary`

---

## איפה UICard בשימוש

| קובץ | שימוש |
|------|-------|
| `MarketsScreen.tsx` | header, tabs, widgets |
| `News/index.tsx` | header, tabs |
| `BreakingNewsTab.tsx` | כרטיסים |
| `EarningsReportsTab.tsx` | כרטיסים |
| `EconomicCalendarTab.tsx` | כרטיסים |
| `ChatGroupCard.tsx` | כרטיס קבוצה |
| `ChatInput.tsx` | input bar |
| `UserProfileScreen.tsx` | פרופיל |
| `SettingsScreen.tsx` | הגדרות |
| `LessonPlayerScreen.tsx` | שיעורים |
| `SubscriptionPlansScreen.tsx` | תוכניות |
| `FearAndGreedCard.tsx` | מדד פחד |

**רוב השימושים:** `variant="blur"` – כולם מושפעים מאותה לוגיקה.

---

## המלצה מעשית

1. **להחליף ברירת מחדל** מ-`glass` ל-`elevated` (או variant מוצק חדש)
2. **או** לשנות את `glass`/`blur` כך שיהיו **מוצקים** – רקע `elevated2`/`tertiary`, בלי BlurView
3. **רקע המסך** – `background.primary` (#0D1210) יישאר – הכרטיסים יבדלו ממנו עם `elevated2` (#1A1A1A)

זה ייתן עקביות עם הטאב בר (גם הוא `elevated2`) ומראה נקי בכל המסכים.
