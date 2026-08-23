# אימות אימייל באמצע הרישום (Email OTP)

## מה השתנה

באשף הרישום הרב-שלבי, אימות האימייל קורה **מיד אחרי הזנת האימייל** (לפני סיסמה ושאלון), ולא רק בסוף ההרשמה.

זרימה:

1. שם → טלפון → **אימייל** (ולידציה בלבד)
2. מסך הזנת קוד → **שליחת OTP בכניסה למסך** (+ כפתור שליחה מחדש)
3. סיסמה (נשמרת לחשבון המאומת)
4. תמונה / שאלון / מסלול / סיכום

התחברות במייל+סיסמה לא השתנתה.

## הגדרות חובה ב-Supabase Dashboard

### 1. תבנית המייל (קריטי)

`signInWithOtp` משתמש בתבנית **Magic Link**. כדי לקבל קוד 6 ספרות (ולא רק קישור) חייב להופיע `{{ .Token }}` בתוכן.

**עיצוב נוכחי (פרודקשן):** תבניות Auth בעברית RTL עם Google Font **Assistant** ExtraBold 800 — רקע `#121416`, כרטיס `#1C1F22`, מסגרות עדינות, פס אקסנט דק `#00C805`, ספרות OTP בלבן/אוף־וויט (בלי ניאון/glow), לוגו `IMG_3289.PNG`. OTP כ־hero **בלי** קישור/`ConfirmationURL` (רק `{{ .Token }}`); Magic Link / Recovery / Reauthentication / Confirmation.

> אחרי עדכון תבנית — לבקש **OTP חדש** (שליחה מחדש / רישום מחדש) כדי לראות את העיצוב המעודכן; מייל שכבר נשלח נשאר הישן.

עדכון דרך Management API (בלי סודות ב־repo):

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."   # https://supabase.com/dashboard/account/tokens
export PROJECT_REF="wpmrtczbfcijoocguime"
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mailer_templates_magic_link_content":"...כולל {{ .Token }}..."}'
```

גם Dashboard → **Authentication** → **Email Templates** → **Magic Link** — אבל בלי `{{ .Token }}` מסך ה-OTP באפליקציה לא יעבוד.

### 2. Email provider

Authentication → Providers → **Email** — מופעל.

מומלץ:

- **Confirm email** — מופעל (אימות OTP מחשיב את המייל כמאומת)
- **Secure email change** — לפי הצורך
- SMTP מותאם בפרודקשן (המאייל המובנה מוגבל מאוד — רק לכתובות צוות + ~2 הודעות/שעה)

### 3. Custom SMTP דרך Resend (פרודקשן)

בלי SMTP מותאם, Auth מסרב לשלוח למיילים שאינם בצוות הארגון (`Email address not authorized`).

**הגדרות Resend SMTP (רשמיות):**

| שדה | ערך |
|-----|-----|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) או `587` |
| Username | `resend` |
| Password | מפתח API של Resend (`re_...`) — **לא לשמור ב-git / docs / קוד אפליקציה** |
| Sender email | `noreply@darkpool.site` (דומיין מאומת ב-Resend) |
| Sender name | `DarkPool` |

**סטטוס נוכחי (פרודקשן):** דומיין `darkpool.site` מאומת ב-Resend; Supabase Auth SMTP מצביע ל-`noreply@darkpool.site` דרך `smtp.resend.com:465`. אפשר לשלוח OTP לכל כתובת אמיתית (לא רק למייל חשבון Resend).

**איפה להגדיר / לעדכן:**

1. Dashboard → **Authentication** → **SMTP** (או [auth/smtp](https://supabase.com/dashboard/project/_/auth/smtp)) — Enable Custom SMTP
2. או Management API:

```bash
# טוקן מ: https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="sbp_..."
export PROJECT_REF="your-project-ref"
# אל תשמרו את מפתח Resend בקבצי הפרויקט — העבירו רק ב־env זמני בטרמינל

curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"external_email_enabled\": true,
    \"mailer_autoconfirm\": false,
    \"smtp_admin_email\": \"noreply@darkpool.site\",
    \"smtp_host\": \"smtp.resend.com\",
    \"smtp_port\": \"465\",
    \"smtp_user\": \"resend\",
    \"smtp_pass\": \"$RESEND_API_KEY\",
    \"smtp_sender_name\": \"DarkPool\"
  }"
```

**Checklist אחרי הגדרה:**

- [x] Custom SMTP מופעל (`smtp_host=smtp.resend.com`, sender=`noreply@darkpool.site`)
- [x] תבנית Magic Link כוללת `{{ .Token }}` (RTL + מיתוג DarkPool + לוגו)
- [x] תבנית Recovery כוללת `{{ .Token }}` לאיפוס סיסמה באפליקציה
- [ ] Rate limits: אחרי SMTP מותאם ברירת המחדל עולה (~30/שעה) — כוונו ב-[Rate Limits](https://supabase.com/dashboard/project/_/auth/rate-limits) לפי הצורך
- [x] דומיין `darkpool.site` מאומת ב-Resend (שליחה מ-`noreply@darkpool.site` מתקבלת)
- [ ] בדיקת רישום באפליקציה: מסך אימייל → מסך OTP → קוד מגיע לתיבה → אימות מצליח → **סיסמה** → המשך אשף (לא קופצים ל-Main)

### מגבלת Resend testing (רק אם חוזרים ל-`onboarding@resend.dev`)

עם `onboarding@resend.dev` (או דומיין שלא אומת), Resend מאפשר שליחה **רק** לכתובת בעל החשבון:

```text
550 "You can only send testing emails to your own email address (...).
To send emails to other recipients, please verify a domain at resend.com/domains,
and change the `from` address to an email using this domain."
```

בפרודקשן עם דומיין מאומת — לא להשתמש ב-`onboarding@resend.dev` כ-Sender.

**אבטחה:** מפתח Resend הוא סיסמת SMTP. לא לשים ב-`.env` שמחויב ל-git, לא ב-docs, לא בקוד client. אם נחשף בצ'אט/לוג — לסובב ב-Resend.

### 4. תוקף OTP

Authentication → Providers → Email → **Email OTP Expiration** (מומלץ ≤ שעה).

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `screens/Auth/RegistrationEmailScreen.tsx` | ולידציית אימייל → מעבר לאימות |
| `screens/Auth/RegistrationEmailVerificationScreen.tsx` | הזנת קוד |
| `screens/Auth/RegistrationPasswordScreen.tsx` | `updateUser({ password })` על הסשן |
| `screens/Auth/ForgotPasswordScreen.tsx` | שליחת קוד איפוס (`resetPasswordForEmail`) |
| `screens/Auth/ForgotPasswordOtpScreen.tsx` | אימות OTP מסוג recovery |
| `screens/Auth/ForgotPasswordNewScreen.tsx` | סיסמה חדשה (`updateUser({ password })`) |
| `services/authService.ts` | `sendEmailOtp` / `verifyEmailOtp` / `setPasswordForCurrentUser` / recovery |
| `App.tsx` | משתמש לא-הושלם (`registration_completed !== true`) → Onboarding; recovery → Auth |

## לוגו במיילים

לוגו במיילי Auth (IMG_3289) — בשימוש בתבניות:

`https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/app-media/IMG_3289.PNG`

## הערות

- אחרי אימות נוצר סשן + `pendingAuthUserId` — הסיכום מעדכן פרופיל ולא קורא `signUp` מחדש.
- משתמש Google ממשיך לדלג על שלבי אימייל/סיסמה.
- אם הקוד לא מגיע: בדקו SMTP, תבנית Magic Link, ו-Auth logs בדשבורד.
