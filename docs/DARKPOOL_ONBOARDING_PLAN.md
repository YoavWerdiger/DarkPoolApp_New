# תכנון Onboarding Flow - DarkPool בהשראת Cash App

## סיכום המצב הקיים

### קומפוננטות קיימות
- ✅ UIInput - שדה קלט בסיסי
- ✅ UIButton - כפתורים עם וריאנטים
- ✅ UICard - כרטיסים עם glass effect
- ✅ OnboardingLayout - layout למסכי onboarding
- ✅ OnboardingInput - input ייעודי ל-onboarding
- ✅ OnboardingButton - כפתור ייעודי ל-onboarding

### מערכת העיצוב הקיימת
- ✅ DesignTokens מפותחת עם צבעים, טיפוגרפיה, spacing
- ✅ תמיכה ב-RTL מלאה
- ✅ Glass morphism effects
- ✅ צבע ירוק ראשי: #00C805

### מסכי Onboarding קיימים
1. RegistrationNameScreen - שם מלא
2. RegistrationPhoneScreen - טלפון
3. RegistrationPhoneVerificationScreen - אימות OTP
4. RegistrationEmailScreen - אימייל
5. RegistrationEmailVerificationScreen - אימות אימייל
6. RegistrationPasswordScreen - סיסמה
7. RegistrationAgeInputScreen - גיל
8. RegistrationIntroScreen - מסך פתיחה
9. RegistrationSummaryScreen - סיכום
10. RegistrationPaymentScreen - תשלום

---

## תכנון Flow החדש - בהשראת Cash App

### עקרונות מנחים (מתוך ניתוח Cash App)

1. **Progressive Disclosure** - מסך אחד = שאלה אחת
2. **Friction Reduction** - auto-formatting, smart defaults
3. **Trust Building** - שקיפות, הסברים, אבטחה
4. **Optional Steps** - אפשרות לדלג על מידע לא הכרחי
5. **Visual Identity** - צבע ירוק (#00C805), טיפוגרפיה נקייה
6. **Mobile-First** - כפתורים גדולים, thumb-friendly

### Flow המוצע (10 מסכים)

```
1. PhoneEntryScreen          → כניסה ראשונית (טלפון/אימייל)
2. VerificationScreen         → אימות OTP
3. NameScreen                 → שם מלא
4. DateOfBirthScreen          → תאריך לידה
5. InvestorTypeScreen         → סוג משקיע (Retail/Institutional)
6. RiskToleranceScreen        → סובלנות סיכון (אופציונלי)
7. InterestsScreen            → תחומי עניין
8. NotificationsScreen        → התראות (אופציונלי)
9. SecuritySetupScreen        → PIN/Biometrics (אופציונלי)
10. WelcomeCompleteScreen     → סיום וברכות
```

---

## שינויים נדרשים ב-DesignTokens

### 1. צבעים - התאמה ל-Cash App

```typescript
// Cash App Colors להשראה:
const cashAppColors = {
  primary: '#00D632',      // Neon Green
  black: '#000000',        // כפתורים ראשיים
  white: '#FFFFFF',        // רקעים
  lightGray: '#F5F5F5',    // כפתורים משניים
  mediumGray: '#E0E0E0',   // borders
  darkGray: '#666666',     // טקסט משני
};

// DarkPool - נשמור על הצבע הירוק שלנו (#00C805) אבל נתאים את השאר
const onboardingColors = {
  primary: '#00C805',           // DarkPool Green (כבר קיים)
  primaryLight: '#33D43B',
  buttonPrimary: '#000000',     // כפתור ראשי שחור (כמו Cash App)
  buttonSecondary: '#F5F5F5',   // כפתור משני אפור בהיר
  background: {
    screen: '#FFFFFF',          // רקע נקי לבן
    card: '#FAFAFA',           // כרטיסים בהירים
    input: '#F8F8F8',          // שדות קלט
  },
  text: {
    primary: '#000000',
    secondary: '#666666',
    tertiary: '#999999',
    placeholder: '#BBBBBB',
  },
  border: {
    input: '#E0E0E0',
    inputFocus: '#00C805',
    subtle: '#F0F0F0',
  },
};
```

### 2. טיפוגרפיה - הלך רוח Cash App

```typescript
const onboardingTypography = {
  // Headlines - גדולות ו-bold כמו Cash App
  headline: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#000000',
  },
  
  // Body - נקי וקריא
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#666666',
  },
  
  // Button - bold וברור
  button: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
  },
};
```

### 3. Spacing - נדיב כמו Cash App

```typescript
const onboardingSpacing = {
  screenPadding: 20,        // מרווח מסכים
  elementGap: 16,           // בין אלמנטים
  sectionGap: 24,           // בין סקשנים
  buttonHeight: 56,         // גובה כפתור סטנדרטי
  inputHeight: 56,          // גובה שדה קלט
};
```

### 4. Border Radius - עיגול עדין

```typescript
const onboardingBorderRadius = {
  input: 12,                // שדות קלט
  button: 28,               // כפתורים (pill)
  card: 16,                 // כרטיסים
};
```

---

## קומפוננטות חדשות נדרשות

### 1. CashAppInput.tsx
קומפוננטה חדשה בסגנון Cash App:
- עיצוב מינימליסטי
- Auto-formatting (טלפון, תאריך)
- Real-time validation
- States: empty, filled, error, disabled

### 2. CashAppButton.tsx
כפתור בסגנון Cash App:
- Primary: שחור עם טקסט לבן
- Secondary: אפור בהיר עם טקסט שחור
- Disabled: אפור
- Border radius עגול מלא (pill)

### 3. CashAppProgressIndicator.tsx
אינדיקטור התקדמות:
- Dots או bar
- מינימליסטי
- מיקום למעלה

### 4. CashAppScreen.tsx
Layout wrapper למסכי onboarding:
- רקע לבן נקי
- כותרת גדולה bold
- כפתורים בתחתית
- Safe area insets

---

## מסכים חדשים - מפרט מפורט

### מסך 1: OnboardingPhoneScreen

**מטרה**: כניסה ראשונית עם טלפון או אימייל

**Layout**:
```
┌─────────────────────────┐
│ [?]              [X]    │ <- אייקוני עזרה ויציאה
│                         │
│  מה מספר הטלפון שלך?   │ <- כותרת גדולה bold
│  נשתמש בו ליצירת קשר   │ <- תיאור משני
│                         │
│ ┌─────────────────────┐ │
│ │ +972 | 054-0000000 │ │ <- שדה קלט עם country code
│ └─────────────────────┘ │
│                         │
│                         │
│ צריך עזרה בכניסה?      │ <- קישור עזרה
│                         │
│ טקסט משפטי קטן...      │
│                         │
│ ┌─────────┐ ┌─────────┐│
│ │ אימייל  │ │  המשך   ││ <- כפתורים
│ └─────────┘ └─────────┘│
└─────────────────────────┘
```

**Props**:
- אין navigation back (מסך ראשון)
- כפתור X בפינה (יציאה מ-onboarding)
- כפתור ? לעזרה

**Validation**:
- טלפון ישראלי תקין (10 ספרות)
- פורמט אוטומטי: 054-000-0000

**States**:
- Empty: כפתור המשך מושבת (אפור)
- Valid: כפתור המשך פעיל (שחור)

---

### מסך 2: OnboardingVerificationScreen

**מטרה**: אימות קוד OTP

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│  הכנס את הקוד שנשלח    │
│  ל-054-000-0000        │
│                         │
│ ┌─────────────────────┐ │
│ │    422-400         │ │ <- שדה קוד (6 ספרות)
│ └─────────────────────┘ │
│                         │
│ ניתן לבקש קוד נוסף     │
│ בעוד 45 שניות          │ <- טיימר
│                         │
│ צריך עזרה?             │
│                         │
│ ┌──────────┐ ┌────────┐│
│ │שלח שוב   │ │ המשך  ││
│ └──────────┘ └────────┘│
└─────────────────────────┘
```

**Logic**:
- טיימר 60 שניות
- כפתור "שלח שוב" disabled עד תום הטיימר
- אוטו-המשך כשהקוד תקין (אופציונלי)

---

### מסך 3: OnboardingNameScreen

**מטרה**: שם מלא

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│  איך קוראים לך?        │
│  השם יופיע בפרופיל    │
│                         │
│ ┌─────────────────────┐ │
│ │ שם מלא             │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ שם משפחה           │ │
│ └─────────────────────┘ │
│                         │
│ הערה: השם חייב להתאים  │
│ לשם המופיע בת.ז.       │
│                         │
│        ┌───────┐        │
│        │ המשך  │        │
│        └───────┘        │
└─────────────────────────┘
```

**Validation**:
- שני שדות: שם פרטי + שם משפחה
- לפחות 2 תווים כל אחד
- אין ספרות

---

### מסך 4: OnboardingDateOfBirthScreen

**מטרה**: תאריך לידה (לקביעת גיל וסוג חשבון)

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│  מה תאריך הלידה שלך?   │
│                         │
│ ⚠️ אזהרה חשובה:        │
│ תאריך לידה שגוי יפגע   │
│ בגישה לרוב התכונות     │
│                         │
│ ┌─────────────────────┐ │
│ │ 18 / 02 / 1995    │ │ <- auto-format
│ └─────────────────────┘ │
│                         │
│                         │
│        ┌───────┐        │
│        │ המשך  │        │
│        └───────┘        │
└─────────────────────────┘
```

**Logic**:
- פורמט אוטומטי: DD / MM / YYYY
- חייב להיות מעל גיל 18 (לפי דרישות DarkPool)
- אם מתחת ל-18: הצגת מסך שגיאה או חשבון קטין

---

### מסך 5: OnboardingInvestorTypeScreen

**מטרה**: זיהוי סוג המשקיע (ייחודי ל-DarkPool)

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│  מה סוג המשקיע שלך?    │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 משקיע פרטי      │ │ <- radio selected
│ │ השקעות אישיות       │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 🏢 משקיע מוסדי     │ │
│ │ קרנות, חברות       │ │
│ └─────────────────────┘ │
│                         │
│                         │
│        ┌───────┐        │
│        │ המשך  │        │
│        └───────┘        │
└─────────────────────────┘
```

**Options**:
1. **Retail (פרטי)**: משקיע פרטי, השקעות אישיות
2. **Institutional (מוסדי)**: קרנות, חברות, ניהול כספים

---

### מסך 6: OnboardingRiskToleranceScreen (אופציונלי)

**מטרה**: הבנת סובלנות הסיכון

**Layout**:
```
┌─────────────────────────┐
│ [←]               [X]   │
│                         │
│  מה רמת הסיכון שלך?    │
│  (אופציונלי)           │
│                         │
│ ┌─────────────────────┐ │
│ │ 🟢 שמרני           │ │
│ │ סיכון נמוך         │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🟡 מאוזן           │ │
│ │ סיכון בינוני       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🔴 אגרסיבי         │ │
│ │ סיכון גבוה         │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────┐        ┌───────┐│
│ │דלג  │        │ המשך  ││
│ └─────┘        └───────┘│
└─────────────────────────┘
```

**Options**:
- שמרני (Conservative)
- מאוזן (Moderate)
- אגרסיבי (Aggressive)
- אפשרות לדלג (X או כפתור דלג)

---

### מסך 7: OnboardingInterestsScreen

**מטרה**: תחומי עניין למעקב

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│  מה מעניין אותך?       │
│  (בחר לפחות אחד)       │
│                         │
│ ┌───┐ ┌───┐ ┌───┐     │
│ │✓📈│ │ 🏛️│ │ 💼│    │ <- multi-select pills
│ │מניות│ │קונגרס│ │אופציות││
│ └───┘ └───┘ └───┘     │
│                         │
│ ┌───┐ ┌───┐ ┌───┐     │
│ │ 🏦│ │ 📊│ │ 🎯│    │
│ │בנקים│ │קריפטו│ │קרנות││
│ └───┘ └───┘ └───┘     │
│                         │
│                         │
│        ┌───────┐        │
│        │ המשך  │        │
│        └───────┘        │
└─────────────────────────┘
```

**Options** (multi-select):
- 📈 מניות (Stocks)
- 🏛️ מסחר קונגרס (Congress Trades)
- 💼 אופציות (Options)
- 🏦 מוסדיים (Institutional)
- 📊 קריפטו (Crypto)
- 🎯 קרנות נאמנות (Mutual Funds)

**Logic**:
- חובה לבחור לפחות אחד
- כפתור המשך disabled עד שיש בחירה

---

### מסך 8: OnboardingNotificationsScreen (אופציונלי)

**מטרה**: הפעלת התראות

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│   🔔                    │ <- אייקון פעמון ירוק
│                         │
│  קבל התראות בזמן אמת  │
│                         │
│  • התראות אבטחה        │
│  • עסקאות של קונגרס    │
│  • פעילות insider      │
│  • עדכוני מחירים        │
│                         │
│  ניתן לשנות בכל עת     │
│  בהגדרות               │
│                         │
│ ┌─────┐        ┌───────┐│
│ │דלג  │        │הפעל  ││
│ └─────┘        └───────┘│
└─────────────────────────┘
```

**Logic**:
- אופציונלי לחלוטין
- אם מדלגים - אפשר להפעיל מאוחר יותר בהגדרות

---

### מסך 9: OnboardingSecuritySetupScreen (אופציונלי)

**מטרה**: הגדרת PIN/ביומטריה

**Layout**:
```
┌─────────────────────────┐
│ [←]                     │
│                         │
│  אבטח את החשבון        │
│                         │
│  נבקש PIN או Face ID:  │
│  • בפתיחת האפליקציה    │
│  • לפני העברת כסף       │
│                         │
│  ניתן לשנות בהגדרות     │
│  בכל עת                │
│                         │
│                         │
│                         │
│ ┌─────────┐  ┌─────────┐│
│ │אחר כך   │  │  הבא   ││
│ └─────────┘  └─────────┘│
└─────────────────────────┘
```

**Flow**:
- אם לוחצים "הבא" → מסך יצירת PIN (4-6 ספרות)
- אם לוחצים "אחר כך" → ממשיכים לסיום

---

### מסך 10: OnboardingWelcomeCompleteScreen

**מטרה**: סיום מוצלח וברכות

**Layout**:
```
┌─────────────────────────┐
│                         │
│         ✨ 🎉           │
│                         │
│  ברוך הבא ל-DarkPool!  │
│                         │
│  החשבון שלך מוכן!      │
│  אתה יכול להתחיל       │
│  לעקוב אחרי עסקאות    │
│  של קונגרס, insiders   │
│  ומשקיעים מוסדיים      │
│                         │
│                         │
│                         │
│    ┌───────────────┐    │
│    │  בואו נתחיל!  │    │
│    └───────────────┘    │
└─────────────────────────┘
```

**Action**:
- כפתור "בואו נתחיל" -> ניווט ל-MainTabs (DarkPool Home)

---

## State Management

### OnboardingContext (Zustand או Context API)

```typescript
interface OnboardingState {
  // User Data
  phone: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  investorType: 'retail' | 'institutional' | null;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | null;
  interests: string[];
  notificationsEnabled: boolean;
  securityPinEnabled: boolean;
  
  // Flow State
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  
  // Actions
  setPhone: (phone: string) => void;
  setName: (firstName: string, lastName: string) => void;
  setDateOfBirth: (date: Date) => void;
  setInvestorType: (type: 'retail' | 'institutional') => void;
  setRiskTolerance: (tolerance: string) => void;
  toggleInterest: (interest: string) => void;
  setNotifications: (enabled: boolean) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
  
  // Persistence
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}
```

### AsyncStorage Keys

```typescript
const STORAGE_KEYS = {
  ONBOARDING_STATE: '@darkpool/onboarding_state',
  ONBOARDING_COMPLETED: '@darkpool/onboarding_completed',
  ONBOARDING_STEP: '@darkpool/onboarding_current_step',
};
```

---

## Navigation Structure

### Stack Navigator

```typescript
const OnboardingStack = createStackNavigator();

<OnboardingStack.Navigator
  screenOptions={{
    headerShown: false,
    gestureEnabled: true,
    gestureDirection: 'horizontal',
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  }}
>
  <OnboardingStack.Screen name="OnboardingPhone" component={OnboardingPhoneScreen} />
  <OnboardingStack.Screen name="OnboardingVerification" component={OnboardingVerificationScreen} />
  <OnboardingStack.Screen name="OnboardingName" component={OnboardingNameScreen} />
  <OnboardingStack.Screen name="OnboardingDOB" component={OnboardingDOBScreen} />
  <OnboardingStack.Screen name="OnboardingInvestorType" component={OnboardingInvestorTypeScreen} />
  <OnboardingStack.Screen name="OnboardingRiskTolerance" component={OnboardingRiskToleranceScreen} />
  <OnboardingStack.Screen name="OnboardingInterests" component={OnboardingInterestsScreen} />
  <OnboardingStack.Screen name="OnboardingNotifications" component={OnboardingNotificationsScreen} />
  <OnboardingStack.Screen name="OnboardingSecurity" component={OnboardingSecuritySetupScreen} />
  <OnboardingStack.Screen name="OnboardingComplete" component={OnboardingWelcomeCompleteScreen} />
</OnboardingStack.Navigator>
```

---

## Timeline יישום

### Phase 1: עדכון Design System (יום 1)
1. ✅ עדכון DesignTokens עם צבעי Cash App
2. ✅ הוספת טיפוגרפיה למסכי onboarding
3. ✅ הוספת spacing ו-border radius חדשים

### Phase 2: קומפוננטות חדשות (יום 1-2)
1. ✅ CashAppInput.tsx
2. ✅ CashAppButton.tsx
3. ✅ CashAppProgressIndicator.tsx
4. ✅ CashAppScreen.tsx

### Phase 3: State Management (יום 2)
1. ✅ OnboardingContext
2. ✅ AsyncStorage persistence
3. ✅ Validation logic

### Phase 4: מסכי Onboarding (יום 2-3)
1. ✅ OnboardingPhoneScreen
2. ✅ OnboardingVerificationScreen
3. ✅ OnboardingNameScreen
4. ✅ OnboardingDOBScreen
5. ✅ OnboardingInvestorTypeScreen
6. ✅ OnboardingRiskToleranceScreen
7. ✅ OnboardingInterestsScreen
8. ✅ OnboardingNotificationsScreen
9. ✅ OnboardingSecuritySetupScreen
10. ✅ OnboardingWelcomeCompleteScreen

### Phase 5: Navigation ו-Integration (יום 3)
1. ✅ הגדרת Stack Navigator
2. ✅ חיבור ל-MainTabs
3. ✅ Logic לדילוג על onboarding למשתמשים קיימים

### Phase 6: Testing ו-Polish (יום 4)
1. ✅ בדיקות ב-iOS
2. ✅ בדיקות ב-Android
3. ✅ בדיקות RTL
4. ✅ Accessibility
5. ✅ Edge cases

---

## הערות חשובות

### RTL Support
- כל הטקסטים צריכים `textAlign: 'right'` ו-`writingDirection: 'rtl'`
- אייקונים צריכים להיות בצד הנכון (שמאל לטקסט עברי)
- Navigation gestures צריכים לעבוד נכון ב-RTL

### Validation
- טלפון: 10 ספרות, מתחיל ב-05
- שם: לפחות 2 תווים, אין ספרות
- תאריך לידה: מעל גיל 18
- אינטרסים: לפחות אחד

### Error Handling
- הצגת שגיאות ברורות בעברית
- אין to validation errors מוקדם מדי
- כפתורים disabled במקום error messages

### Accessibility
- Screen reader support
- High contrast mode
- Font scaling
- Keyboard navigation

### Performance
- Lazy loading של מסכים
- Image optimization
- Smooth animations (60fps)

---

## Success Metrics

### Technical Metrics
- ✅ כל 10 המסכים עובדים
- ✅ RTL מלא
- ✅ iOS + Android
- ✅ אין crashes
- ✅ Performance טוב

### UX Metrics (עתידי)
- Completion rate > 70%
- Time to complete < 3 minutes
- Drop-off rate < 30%
- User satisfaction > 4/5

---

**תאריך יצירה**: 13/09/2026  
**גרסה**: 1.0  
**סטטוס**: מוכן ליישום
