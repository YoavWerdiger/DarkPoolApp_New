# OnboardingSwipeCards - תיעוד

קומפוננטה של כרטיסים אופקיים למסכי onboarding עם FlatList פשוט וחלק.

## תכונות

### 🎨 עיצוב
- כרטיס גדול ומרכזי עם glass effect
- Gradient ייחודי לכל כרטיס (ירוק, כחול, סגול, ורוד)
- Border צבעוני מותאם לכל אופציה
- Shadow לעומק ולהדגשה
- Emoji או אייקון גדול לכל אופציה
- טקסט גדול וברור (28px)

### 🎯 אינטראקציה
- **גלילה אופקית:** FlatList horizontal עם snapToInterval
- **כפתורים:** חצים בצדדים לניווט
- **Dots:** אינדיקטור למיקום הנוכחי (ניתן ללחוץ)
- **Haptic feedback:** רטט עדין בכל שינוי
- **עצירה חכמה:** decelerationRate="fast" לעצירה על כל פריט

### 📊 מידע נוסף
- חיווי של מספר הכרטיס (1/4, 2/4 וכו') בתחתית הכרטיס
- גלילה חלקה ופשוטה ללא אנימציות מורכבות

## שימוש

### דוגמה בסיסית

```tsx
import OnboardingSwipeCards from '../components/onboarding/OnboardingSwipeCards';

const options = [
  { label: 'עושה צעדים ראשונים', value: 'first_steps', emoji: '🌱' },
  { label: 'סוחר מתחיל', value: 'beginner', emoji: '📚' },
  { label: 'סוחר בינוני', value: 'intermediate', emoji: '📈' },
  { label: 'סוחר מתקדם', value: 'advanced', emoji: '🚀' },
];

<OnboardingSwipeCards
  options={options}
  currentValue={selectedValue}
  onValueChange={(value) => setSelectedValue(value)}
/>
```

### שימוש ב-RegistrationIntroQuestionScreen

```tsx
const experienceConfig: IntroQuestionConfig = {
  field: 'experienceLevel',
  stepKey: 'experience',
  title: 'מה רמת הניסיון שלך במסחר?',
  subtitle: 'בחר את האפשרות הקרובה ביותר',
  options: [
    { label: 'עושה צעדים ראשונים', value: 'first_steps', emoji: '🌱' },
    { label: 'סוחר מתחיל', value: 'beginner', emoji: '📚' },
    { label: 'סוחר בינוני', value: 'intermediate', emoji: '📈' },
    { label: 'סוחר מתקדם', value: 'advanced', emoji: '🚀' },
  ],
  nextRoute: 'RegistrationTradingFocus',
  displayMode: 'swipe', // 👈 זה מפעיל את ה-swipe mode!
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ label: string; value: string; emoji?: string }[]` | ✅ | רשימת האופציות להצגה |
| `currentValue` | `string` | ❌ | הערך הנוכחי (נבחר) |
| `onValueChange` | `(value: string) => void` | ✅ | callback שנקרא כשהמשתמש בוחר אופציה |

## התאמה אישית

### צבעי Gradient
ניתן לשנות את ה-gradients בקובץ:
```tsx
const gradients = [
  ['rgba(0, 200, 5, 0.08)', 'rgba(0, 200, 5, 0.02)'], // ירוק
  ['rgba(59, 130, 246, 0.08)', 'rgba(59, 130, 246, 0.02)'], // כחול
  // ... הוסף צבעים נוספים
];
```

### צבעי Border
```tsx
const borderColors = [
  'rgba(0, 200, 5, 0.3)', // ירוק
  'rgba(59, 130, 246, 0.3)', // כחול
  // ... הוסף צבעים נוספים
];
```

## RTL Support
הקומפוננטה תומכת ב-RTL באופן מלא:
- החצים והטקסט מותאמים ל-RTL
- הגלילה עובדת בצורה טבעית

## Performance
- שימוש ב-FlatList מובנה של React Native
- `snapToInterval` לעצירה מדויקת על כל כרטיס
- `decelerationRate="fast"` לתגובה מהירה
- `getItemLayout` לביצועים אופטימליים
- מינימום re-renders עם `useCallback` ו-`useRef`

## דוגמאות למסכים נוספים

### מסך מיקוד מסחר (עם swipe)
```tsx
const focusConfig: IntroQuestionConfig = {
  // ...
  options: [
    { label: 'מסחר יומי', value: 'day_trading', emoji: '⚡' },
    { label: 'מסחר סווינג', value: 'swing', emoji: '📊' },
    { label: 'השקעה לטווח ארוך', value: 'long_term', emoji: '🎯' },
  ],
  displayMode: 'swipe',
};
```

### מסך פלטפורמה (רשימה רגילה)
```tsx
const platformConfig: IntroQuestionConfig = {
  // ...
  options: TRADING_PLATFORM_OPTIONS,
  displayMode: 'list', // או פשוט לא לכתוב - ברירת מחדל
};
```

## תלויות נדרשות
- `expo-linear-gradient`
- `@expo/vector-icons`
- `react-native` (FlatList built-in)
