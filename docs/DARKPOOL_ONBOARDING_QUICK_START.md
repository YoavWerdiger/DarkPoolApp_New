# 🚀 Quick Start - DarkPool Onboarding

**מדריך מהיר להתחלה עם מערכת ה-Onboarding החדשה**

---

## ⚡ התחלה מהירה ב-5 דקות

### 1️⃣ בדוק שהכל קיים

```bash
# וודא שכל הקבצים נוצרו
ls components/ui/CashApp*.tsx
ls screens/Onboarding/*.tsx
ls context/OnboardingContext.tsx
ls navigation/OnboardingStack.tsx
```

צריך לראות:
```
✅ components/ui/CashAppButton.tsx
✅ components/ui/CashAppInput.tsx
✅ components/ui/CashAppProgressIndicator.tsx
✅ components/ui/CashAppScreen.tsx
✅ screens/Onboarding/index.ts
✅ screens/Onboarding/OnboardingPhoneScreen.tsx
✅ screens/Onboarding/OnboardingVerificationScreen.tsx
✅ ... (עוד 7 מסכים)
✅ context/OnboardingContext.tsx
✅ navigation/OnboardingStack.tsx
```

---

### 2️⃣ הרץ את הפרויקט

```bash
# התקן dependencies (אם צריך)
npm install

# הרץ את הפרויקט
npx expo start

# בחר פלטפורמה:
# - לחץ i ל-iOS simulator
# - לחץ a ל-Android emulator
# - סרוק QR code במכשיר
```

---

### 3️⃣ בדוק את ה-Onboarding

**Option A: בדיקה ישירה**

עדכן זמנית את `App.tsx`:

```tsx
import OnboardingStack from './navigation/OnboardingStack';

export default function App() {
  return <OnboardingStack />;
}
```

**Option B: בדיקה עם logic**

```tsx
import { useEffect, useState } from 'react';
import OnboardingStack from './navigation/OnboardingStack';
import { checkOnboardingCompleted } from './context/OnboardingContext';

export default function App() {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingCompleted().then((done) => {
      setCompleted(done);
      setLoading(false);
    });
  }, []);

  if (loading) return null; // או <LoadingScreen />

  return completed ? <MainTabs /> : <OnboardingStack />;
}
```

---

### 4️⃣ Reset (לבדיקות חוזרות)

```tsx
import { resetOnboarding } from './context/OnboardingContext';

// בכל מקום שתרצה (למשל, Dev Menu):
const handleReset = async () => {
  await resetOnboarding();
  // Reload app or navigate to onboarding
};
```

---

### 5️⃣ בדוק את כל המסכים

עבור דרך ה-flow:
1. ✅ Phone Entry - הכנס `0541234567`
2. ✅ Verification - הכנס כל 6 ספרות (לא באמת בודק עכשיו)
3. ✅ Name - שם פרטי + משפחה
4. ✅ Date of Birth - `18/02/1995`
5. ✅ Investor Type - בחר Retail או Institutional
6. ✅ Risk Tolerance - בחר או דלג
7. ✅ Interests - בחר לפחות אחד
8. ✅ Notifications - אשר או דלג
9. ✅ Security - הבא או אחר כך
10. ✅ Welcome - "בואו נתחיל"

---

## 🎨 התאמה מהירה

### שינוי צבעים

`components/ui/DesignTokens.ts`:

```typescript
cashAppStyle: {
  colors: {
    buttonPrimary: '#FF0000',  // שנה לאדום, למשל
    buttonSecondary: '#00FF00', // שנה לירוק
    // ...
  }
}
```

### שינוי טקסטים

`screens/Onboarding/OnboardingPhoneScreen.tsx`:

```tsx
<CashAppScreen
  title="הכנס את המספר שלך"  // שנה כאן
  subtitle="נשלח לך קוד"      // ושנה כאן
  ...
>
```

### הוספת validation נוסף

`screens/Onboarding/OnboardingPhoneScreen.tsx`:

```tsx
const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  
  // הוסף validation משלך:
  if (cleaned.startsWith('050')) return true;  // רק 050
  if (cleaned.startsWith('052')) return true;  // רק 052
  // ...
  
  return false;
};
```

---

## 🔌 Integration עם Backend

### 1. Phone Verification

`screens/Onboarding/OnboardingPhoneScreen.tsx`:

```tsx
const handleNext = async () => {
  try {
    // קריאה לשרת שלך:
    const response = await fetch('https://your-api.com/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    if (response.ok) {
      setPhone(phone);
      navigation.navigate('OnboardingVerification');
    } else {
      setError('שגיאה בשליחת קוד');
    }
  } catch (err) {
    setError('שגיאה בשרת');
  }
};
```

### 2. OTP Verification

`screens/Onboarding/OnboardingVerificationScreen.tsx`:

```tsx
const handleNext = async () => {
  try {
    const response = await fetch('https://your-api.com/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: data.phone, code }),
    });

    if (response.ok) {
      setPhoneVerified(true);
      navigation.navigate('OnboardingName');
    } else {
      setError('קוד שגוי');
    }
  } catch (err) {
    setError('שגיאה באימות');
  }
};
```

### 3. Save User Data

`screens/Onboarding/OnboardingWelcomeCompleteScreen.tsx`:

```tsx
const handleStart = async () => {
  try {
    // שמור את כל הנתונים בשרת:
    const response = await fetch('https://your-api.com/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        investorType: data.investorType,
        riskTolerance: data.riskTolerance,
        interests: data.interests,
        notificationsEnabled: data.notificationsEnabled,
      }),
    });

    if (response.ok) {
      completeOnboarding();
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' as never }],
      });
    }
  } catch (err) {
    console.error('Failed to save user:', err);
  }
};
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] כל 10 המסכים נפתחים ללא שגיאות
- [ ] Validation עובד (טלפון, תאריך, שם)
- [ ] Auto-formatting עובד (טלפון, תאריך)
- [ ] Progress indicator מתעדכן
- [ ] כפתור Back עובד בכל מקום
- [ ] דילוג עובד במסכים אופציונליים
- [ ] RTL נראה טוב
- [ ] Keyboard לא מכסה inputs
- [ ] אין crashes
- [ ] Haptic feedback עובד (iOS)
- [ ] Animations חלקות

### Reset ל-Testing חוזר

```tsx
// בדיקה מהירה - איפוס מלא
import { resetOnboarding } from './context/OnboardingContext';
await resetOnboarding();
```

---

## 📱 Platform-Specific

### iOS
```bash
npx expo run:ios
```

- ✅ Safe area insets
- ✅ Haptic feedback
- ✅ BlurView (אם משתמשים)
- ✅ Gestures

### Android
```bash
npx expo run:android
```

- ✅ Back button
- ✅ Status bar
- ✅ Keyboard behavior
- ✅ Permissions (notifications)

---

## 🐛 Troubleshooting מהיר

### "Cannot find module"
```bash
npm install
# או
yarn install
```

### "AsyncStorage not found"
```bash
npx expo install @react-native-async-storage/async-storage
```

### "Reanimated not found"
```bash
npx expo install react-native-reanimated
```

### Keyboard מכסה Input
כבר קיים `KeyboardAvoidingView` ב-`CashAppScreen`. אם זה לא עובד:

```tsx
<CashAppScreen ...>
  <KeyboardAvoidingView 
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
    <CashAppInput ... />
  </KeyboardAvoidingView>
</CashAppScreen>
```

---

## ✅ Checklist לפני Production

- [ ] חיבור ל-backend (OTP, user creation)
- [ ] Analytics tracking
- [ ] Error monitoring (Sentry?)
- [ ] Phone validation אמיתי
- [ ] Notifications permissions
- [ ] Security - PIN/Biometrics
- [ ] Legal text עדכני
- [ ] Privacy policy
- [ ] Terms & conditions
- [ ] בדיקות על מכשירים אמיתיים
- [ ] Performance testing
- [ ] Accessibility testing

---

## 📚 קישורים מהירים

- **[README](./DARKPOOL_ONBOARDING_README.md)** - מדריך כללי
- **[Implementation Guide](./DARKPOOL_ONBOARDING_IMPLEMENTATION.md)** - מדריך מפורט
- **[Plan](./DARKPOOL_ONBOARDING_PLAN.md)** - תכנון
- **[Changelog](./DARKPOOL_ONBOARDING_CHANGELOG.md)** - שינויים
- **[Cash App Analysis](./CASH_APP_ONBOARDING_ANALYSIS.md)** - ניתוח מקור

---

## 🎉 זהו!

אתה מוכן להתחיל! 🚀

יש שאלות? קרא את התיעוד המפורט או פנה למפתח.

**Have fun!** ✨
