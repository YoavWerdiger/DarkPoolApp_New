# פתרון בעיות Phone OTP - מדריך מהיר

## דגל הפעלה

OTP ברישום כבוי כברירת מחדל (`PHONE_VERIFICATION_ENABLED = false` ב-`constants/onboardingFlow.ts`).
אם ההרשמה מדלגת ישר למייל — זה צפוי. להפעלה אחרי Twilio: ראו `PHONE_OTP_SETUP.md`.

## הבעיה שדווחה
שגיאה "שגיאה בשליחת קוד האימות. נסה שוב." כאשר מנסים לשלוח OTP למספר 0549051060.

## מה תוקן בקוד

### 1. שיפור Error Handling
- הוספתי logging מפורט לכל שגיאות OTP
- הקוד עכשיו מציג את השגיאה **המדויקת** מ-Supabase במצב פיתוח
- הוספתי זיהוי אוטומטי של סוגי שגיאות:
  - `sms_provider_error` - בעיה ב-Twilio
  - `phone_auth_not_configured` - Phone Auth לא מופעל
  - `invalid_phone` - פורמט טלפון שגוי
  - `rate_limit` - יותר מדי ניסיונות

### 2. שיפור וולידציה
- בדיקת פורמט E.164 לפני שליחה
- המרה אוטומטית: `0549051060` → `+972549051060`
- וולידציה של אורך מספר (10-15 ספרות)

## בדיקות שצריך לבצע (לפי סדר חשיבות)

### ✅ בדיקה 1: וודא שPhone Auth מופעל ב-Supabase

1. היכנס ל-[Supabase Dashboard](https://app.supabase.com/)
2. בחר את הפרויקט שלך
3. נווט ל-**Authentication** → **Providers**
4. וודא ש-**Phone** מופעל (toggle אמור להיות ירוק)

### ✅ בדיקה 2: וודא את הגדרות Twilio ב-Supabase

באותו מסך (Authentication → Providers → Phone):

1. **SMS Provider**: בחר **Twilio**
2. **Twilio Account SID**: וודא שהערך נכון (מתחיל ב-`AC`)
3. **Twilio Auth Token**: וודא שהערך נכון
4. **Twilio Messaging Service SID**: וודא שהערך נכון (מתחיל ב-`MG`)

⚠️ **חשוב**: אם שיניתה משהו, לחץ **Save**!

### ✅ בדיקה 3: וודא שיש מספר שולח ב-Twilio Sender Pool

זו **הבעיה השכיחה ביותר** שגורמת לשגיאה!

1. היכנס ל-[Twilio Console](https://console.twilio.com/)
2. נווט ל-**Messaging** → **Services**
3. לחץ על ה-Messaging Service שלך (זה שה-SID שלו ב-Supabase)
4. בתפריט צד, לחץ **Sender Pool**
5. **בדוק שיש לפחות מספר טלפון אחד ברשימה!**

אם **אין מספר**:
1. לחץ **Add Senders**
2. בחר **Phone Number**
3. לחץ **Continue**
4. קנה/בחר מספר טלפון:
   - **למבחנים**: מספר US ($1/חודש, זול)
   - **ל-production**: מספר ישראלי (דורש אישור)
5. אשר והוסף אותו ל-Messaging Service

### ✅ בדיקה 4: בדוק Logs ב-Supabase

1. ב-Supabase Dashboard: **Logs** → **Auth Logs**
2. חפש events מסוג `phone_signup` או `phone_signin`
3. בדוק אם יש שגיאות (מסומנות באדום)
4. הודעות שגיאה נפוצות:
   - `"Error sending SMS"` → בעיה ב-Twilio (Sender Pool ריק?)
   - `"Invalid phone number"` → פורמט שגוי (צריך להיות +972...)
   - `"Rate limit exceeded"` → יותר מדי ניסיונות

### ✅ בדיקה 5: בדוק Logs ב-Twilio

1. ב-Twilio Console: **Monitor** → **Logs** → **Messaging**
2. בדוק אם יש ניסיונות שליחה אחרונים
3. אם יש שגיאות, קרא את ההודעה

## בעיות נפוצות ופתרונות

### 🔴 "Error sending SMS" / SMS Provider Error

**סיבה**: הכי סביר - **אין מספר טלפון ب-Sender Pool** של Twilio

**פתרון**:
1. עבור ל-Twilio Console → Messaging → Services → [שלך] → Sender Pool
2. הוסף מספר טלפון (ראה בדיקה 3 למעלה)

### 🔴 "Phone auth is not configured"

**סיבה**: Phone Auth לא מופעל ב-Supabase

**פתרון**:
1. Supabase Dashboard → Authentication → Providers
2. הפעל את **Phone** (toggle)
3. שמור

### 🔴 "Invalid phone number"

**סיבה**: פורמט טלפון שגוי

**פתרון**: `toE164IsraeliPhone` מנרמל `0549051060` / `549051060` / `972549051060` → `+972549051060`. נייד ישראלי חייב 9 ספרות אחרי קידומת שמתחילות ב-`5`.

### 🔴 "Rate limit exceeded"

**סיבה**: יותר מדי ניסיונות בזמן קצר

**פתרון**: המתן 5-10 דקות ונסה שוב

## איך לבדוק שהתיקון עובד

### שלב 1: הרץ את האפליקציה מחדש
```bash
npm start
# או
npx expo start
```

### שלב 2: נסה לשלוח OTP שוב
1. פתח את מסך ההרשמה
2. הכנס מספר טלפון: `0549051060`
3. לחץ "המשך"

### שלב 3: בדוק מה השגיאה (אם יש)
- במצב פיתוח (`__DEV__`), השגיאה המלאה תוצג במסך
- בדוק גם את ה-console logs (Metro bundler)

## מה לחפש ב-Logs

### Logs מוצלחים (בדיקת פורמט):
```
[AuthService] Sending OTP to phone: +9725490****
[AuthService] OTP sent successfully
```

### Logs עם שגיאה:
```
[AuthService] Sending OTP to phone: +9725490****
[AuthService] Phone OTP error: { message: "Error sending SMS", ... }
```

אם אתה רואה את השגיאה השניה, העתק את כל ההודעה ושלח אותה - זה יעזור לזהות את הבעיה המדויקת.

## צעדים הבאים

1. **עכשיו**: בדוק את כל 5 הבדיקות למעלה (במיוחד בדיקה 3 - Sender Pool!)
2. **אחרי שתתקן**: נסה לשלוח OTP שוב
3. **אם עדיין לא עובד**: העתק את השגיאה המלאה מה-console והודע לי

## עלויות Twilio (תזכורת)

- **SMS לישראל**: ~$0.042 לכל הודעה
- **מספר US**: ~$1/חודש
- **מספר ישראלי**: ~$2/חודש (דורש אישור)

עבור 300 משתמשים: ~$15-16 (יש לך $150 יתרה)

---

**שים לב**: אם אתה משתמש ב-Twilio Trial (חינמי), תצטרך להוסיף את מספר הטלפון שלך ל-**Verified Caller IDs** לפני שתוכל לשלוח אליו SMS.
