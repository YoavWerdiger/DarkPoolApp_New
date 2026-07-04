# מדריך Liquid Glass ב-Expo

## סקירה

**Liquid Glass** הוא שפת עיצוב של Apple מ-iOS 26 שמשתמשת באפקט זכוכית שקופה ומעומעמת (UIVisualEffectView). Expo תומך בכך דרך חבילת `expo-glass-effect`.

## אפשרויות ב-Expo

### 1. expo-glass-effect (מומלץ - כבר מותקן)

חבילה שמשתמשת ב-`UIGlassEffect` הנטיבי של Apple.

- **זמין ב:** iOS 26+, tvOS
- **הרכיבים:** `GlassView`, `GlassContainer`
- **Fallback:** על מכשירים ישנים – `GlassView` יוצג כ-`View` רגיל

```tsx
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';

// בדיקה לפני שימוש
if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
  return <GlassView glassEffectStyle="regular" tintColor="#1A1A1A" style={styles.glass} />;
}
```

**Props חשובים:**
- `glassEffectStyle`: `'regular'` | `'clear'`
- `tintColor`: צבע גוון (string)
- `isInteractive`: האם מגיב למגע (מוגדר פעם אחת ב-mount)

**הגבלות:**
- אין להשתמש ב-`opacity` < 1 על `GlassView` או על הורה שלו
- `isInteractive` לא ניתן לשינוי דינמי

### 2. expo-blur (BlurView)

אפקט blur קלאסי, לא Liquid Glass אמיתי.

- עובד ב-iOS וב-Android
- מתאים ל-fallback על מכשירים ישנים

```tsx
import { BlurView } from 'expo-blur';

<BlurView intensity={70} tint="dark" style={styles.container} />
```

### 3. @expo/ui (Expo UI + SwiftUI)

אינטגרציה של SwiftUI עם `glassEffect` modifier. מורכב יותר ודורש `Host` ופרימיטיבים של SwiftUI.

---

## מימוש ב-DarkPool

ב-`MainTabs.tsx` מותקן:

1. **iOS 26+:** `GlassView` עם `glassEffectStyle="regular"`
2. **iOS ישן:** `BlurView` עם `intensity={70}` ו-`tint="dark"`
3. **Android:** רקע מוצק

## דרישות

- **Expo SDK 54+**
- **iOS 26** ל-Liquid Glass אמיתי
- **Development Build** – Expo Go לא תומך ב-`expo-glass-effect` באופן מלא

## בדיקת Liquid Glass

```tsx
import { isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';

// בדיקת זמינות במכשיר
console.log('Liquid Glass available:', isLiquidGlassAvailable());
console.log('Glass Effect API available:', isGlassEffectAPIAvailable());
```

## קישורים

- [Expo Glass Effect Docs](https://docs.expo.dev/versions/v54.0.0/sdk/glass-effect/)
- [Expo Liquid Glass Blog](https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui)
- [Apple UIGlassEffect](https://developer.apple.com/documentation/uikit/uiglasseffect)
