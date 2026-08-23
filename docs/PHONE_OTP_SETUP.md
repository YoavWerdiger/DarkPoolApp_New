# Phone OTP Setup Guide

מדריך להגדרת אימות טלפון עם Supabase Phone Auth ו-Twilio.

## מצב נוכחי (בטא → השקה)

| פריט | מצב |
|------|-----|
| `PHONE_VERIFICATION_ENABLED` ב-`constants/onboardingFlow.ts` | `false` (ברירת מחדל) |
| אכיפת `phone_confirmed_at` / אימות מייל | **לא** — לא להפעיל לפני ההשקה |
| Twilio SMS compliance | ממתין לאישור |
| SMTP מותאם לאיפוס סיסמה | עדיין לא — ראו סעיף "איפוס סיסמה" למטה |

### הפעלה ביום Twilio (שינוי אחד בקוד)

1. ודא ב-Dashboard: Authentication → Providers → **Phone** מופעל + Twilio credentials + Sender Pool לא ריק.
2. שנה ב-`constants/onboardingFlow.ts`:
   ```ts
   export const PHONE_VERIFICATION_ENABLED = true;
   ```
3. אין צורך לפרוס מחדש Edge Functions או לגעת ב-`verify_jwt`.
4. מסך הטלפון ישלח OTP וינווט ל-`RegistrationPhoneVerification`; מונה הצעדים מתעדכן אוטומטית.

### תוכנית אכיפה מדורגת (תיעוד בלבד — לא להפעיל עכשיו)

1. **שלב 0 (עכשיו):** רישום בלי SMS; איסוף טלפון כשדה פרופיל בלבד.
2. **שלב 1 (אחרי Twilio):** `PHONE_VERIFICATION_ENABLED=true` — OTP ברישום חדש בלבד; משתמשים קיימים לא נחסמים.
3. **שלב 2 (אופציונלי, אחרי יציבות):** תזכורת בפרופיל למשתמשים בלי `phone_confirmed_at` — בלי חסימת אפליקציה.
4. **שלב 3 (רק אם נדרש עסקית):** אכיפת `phone_confirmed_at` לנתיבים רגישים. **לא** לפני שיש SMTP + SMS יציבים ותמיכה.

## דרישות מוקדמות

- חשבון Twilio עם יתרה ($150 בתכנון הנוכחי)
- Account SID + Auth Token מ-Twilio
- גישה למסוף ניהול Supabase

## שלבי הגדרה ב-Twilio

### 1. הגדר Messaging Service

1. היכנס ל-[Twilio Console](https://console.twilio.com/)
2. נווט ל-**Messaging** > **Services**
3. לחץ על **Create Messaging Service**
4. בחר **Notify my users** כ-use case
5. שם את השירות (למשל: "DarkPool OTP")
6. לחץ **Create Messaging Service**

### 2. הוסף Sender (מספר שולח)

1. בתפריט **Sender Pool**, לחץ **Add Senders**
2. בחר **Phone Number**
3. לחץ **Continue**
4. קנה/בחר מספר טלפון ישראלי (+972) או בינלאומי
   - **שים לב:** מספרים ישראליים דורשים אישור מיוחד והרשמה ל-Israeli Sender ID Registry
   - עבור שלב הפיתוח, אפשר להשתמש במספר US (זול יותר, $1/חודש)
   - עבור production עם לקוחות ישראליים, כדאי לקנות מספר ישראלי
5. אשר את המספר והוסף אותו ל-Messaging Service

### 3. הגדר Integration

1. בתפריט **Integration**, בחר **Send a webhook**
2. שמור את השירות

### 4. שמור פרטי חיבור

צור `.env.local` (אם עדיין לא קיים) עם:

\`\`\`bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

## שלבי הגדרה ב-Supabase

### 1. הפעל Phone Auth

1. היכנס ל-[Supabase Dashboard](https://app.supabase.com/)
2. בחר את הפרויקט שלך
3. נווט ל-**Authentication** > **Providers**
4. הפעל **Phone**

### 2. הגדר Twilio כ-SMS Provider

1. באותו המסך, תחת **Phone Auth Configuration**:
   - **SMS Provider**: בחר **Twilio**
   - **Twilio Account SID**: הדבק את ה-Account SID מ-Twilio
   - **Twilio Auth Token**: הדבק את ה-Auth Token מ-Twilio
   - **Twilio Messaging Service SID**: הדבק את ה-Messaging Service SID מ-Twilio

2. לחץ **Save**

### 3. הגדר Rate Limiting (מומלץ)

1. עבור ל-**Authentication** > **Rate Limits**
2. הגדר:
   - **OTP send limit**: 5 per hour per phone number
   - **OTP verify limit**: 10 per hour per phone number
3. שמור

## בדיקה (Development)

### 1. הוסף טלפון לבדיקה (Verified Caller IDs)

בזמן פיתוח, כדי לחסוך בעלויות:

1. ב-Twilio Console: **Phone Numbers** > **Manage** > **Verified Caller IDs**
2. הוסף את מספר הטלפון שלך לבדיקה
3. אשר אותו עם OTP שתקבל

כעת תוכל לשלוח OTP למספר זה בחינם (במצב Sandbox).

### 2. בדיקה באפליקציה

1. הרץ את האפליקציה
2. נסה להירשם עם מספר טלפון
3. בדוק שמגיע SMS עם קוד 6 ספרות
4. הזן את הקוד ואמת שהאימות עובר

## עלויות Twilio (ארה"ב)

- **SMS לארה"ב**: ~$0.0079 לכל הודעה
- **SMS לישראל**: ~$0.042 לכל הודעה
- **מספר טלפון אמריקאי**: ~$1/חודש
- **מספר טלפון ישראלי**: ~$2/חודש (דורש אישור)

### אומדן עלויות ל-300 משתמשים

בהנחה ש:
- כל משתמש שולח OTP פעם אחת (רישום)
- 10% ממשתמשים שולחים שוב (30 משתמשים נוספים)

**סה"ק הודעות**: 300 + 30 = 330

**עלות (מספר ישראלי)**:
- SMS: 330 × $0.042 = ~$13.86
- מספר טלפון: $2/חודש
- **סה"ק**: ~$15.86

**יתרה זמינה**: $150 - $15.86 = **$134.14 נותרים**

## הגדרות Production

### 1. הסר את Sandbox Mode

1. ב-Twilio Console: **Phone Numbers** > **Manage** > **Regulatory Compliance**
2. מלא את פרטי החברה והאישורים הנדרשים
3. העבר לחשבון production

### 2. הגדר Monitoring

1. הפעל **Monitor** ב-Twilio Console
2. הגדר **Alerts** עבור:
   - שגיאות שליחה
   - rate limiting
   - יתרה נמוכה

### 3. הגדר Logging

1. ב-Supabase Dashboard: **Settings** > **API**
2. הפעל **Log all API requests**
3. עקוב אחר OTP requests ב-**Logs Explorer**

## טיפול בבעיות נפוצות

### SMS לא מגיע

1. בדוק ש-Messaging Service SID נכון
2. וודא שהמספר השולח מאושר ופעיל
3. בדוק rate limits ב-Supabase
4. בדוק logs ב-Twilio Console

### שגיאת "invalid_phone"

- וודא שהמספר בפורמט E.164: `+972501234567`
- בדוק שהמספר תומך ב-SMS (לא קו קווי)

### שגיאת "rate_limit"

- המשתמש שלח יותר מדי בקשות
- המתן 5 דקות ונסה שוב
- הגדר rate limits גבוהים יותר אם צריך (Supabase Dashboard)

### שגיאת "expired_otp"

- קוד OTP תקף ל-60 שניות בלבד
- המשתמש צריך לבקש קוד חדש

## אבטחה

### Best Practices

1. **אל תשמור OTP בקוד או logs**
2. **השתמש ב-HTTPS תמיד**
3. **הגדר rate limiting מחמיר**
4. **אל תחשוף Twilio credentials בקליינט**
5. **מנע brute-force עם captcha אחרי 3 ניסיונות**

### RLS (Row Level Security)

ה-Phone Auth מוגן אוטומטית על ידי Supabase. אין צורך ב-RLS נוסף.

## איפוס סיסמה (מייל) — מה נדרש להשקה

הקליינט קורא ל-`AuthService.resetPasswordForEmail` → GoTrue `/auth/v1/recover`.

| נושא | מצב |
|------|-----|
| כפתור "שכחת סיסמה?" ב-Login | קורא ל-API (לא stub) |
| מאייל מובנה של Supabase | מוגבל (~2/שעה) — לא מספיק לפרודקשן |
| `email_address_invalid` על `@example.invalid` | GoTrue דוחה TLD שמור; בדיקה אמיתית דורשת דומיין רגיל |
| להשקה (~שבועיים) | חובה SMTP מותאם (Auth → SMTP) + URL redirect לאיפוס באפליקציה/אתר |

אל תפעיל "Confirm email" כחלק מתיקון האיפוס — זה שובר רישום בטא.

## תמיכה

- [Supabase Phone Auth Docs](https://supabase.com/docs/guides/auth/phone-login)
- [Twilio SMS Docs](https://www.twilio.com/docs/sms)
- [Twilio Console](https://console.twilio.com/)

---

**שים לב**: אפשר להגדיר Phone Auth גם עם ספקים אחרים (Vonage, MessageBird) אבל Twilio הוא הנפוץ ביותר ותומך בישראל.
