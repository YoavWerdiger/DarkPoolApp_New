# תיקון בדיקת המייל - הוראות הפעלה

## הבעיה שתוקנה

בדיקת המייל לא עבדה ואפשרה להמשיך גם עם מיילים תפוסים או לא תקינים.

## מה תוקן?

### 1. **RegistrationEmailScreen.tsx**
- ✅ הוספנו console.log מפורט לראות מה קורה בכל שלב
- ✅ חיזקנו את התנאי `canContinue` - עכשיו בודק גם `error.length === 0`
- ✅ הוספנו protection ב-`handleNext` שלא מאפשר המשך אם הכפתור אמור להיות מושבת
- ✅ הוספנו בדיקות נוספות למייל ריק ופורמט לא תקין
- ✅ שיפרנו את הודעות השגיאה

### 2. **authService.ts**
- ✅ הוספנו console.log מפורט לבדיקת המייל
- ✅ הוספנו fallback mechanism - אם ה-RPC function לא קיימת, הקוד מבצע בדיקה ישירה
- ✅ ודאנו שהפונקציה מחזירה `boolean` מפורש
- ✅ הוספנו טיפול בשגיאות טוב יותר

### 3. **Migration חדש**
- ✅ יצרנו migration שמוסיף את הפונקציות `check_email_exists` ו-`check_phone_exists`
- ✅ הפונקציות מקבלות הרשאות מתאימות (authenticated + anon)

## איך להפעיל את התיקון?

### שלב 1: הפעל את ה-Migration ב-Supabase

יש 2 אפשרויות:

#### אפשרות א': דרך Supabase Dashboard (מומלץ)

1. היכנס ל-Supabase Dashboard
2. לך ל-SQL Editor
3. פתח קובץ חדש
4. העתק והדבק את התוכן של הקובץ:
   ```
   supabase/migrations/20260808000000_add_check_email_phone_functions.sql
   ```
5. לחץ על "Run"

#### אפשרות ב': דרך Supabase CLI

אם יש לך הרשאות מתאימות, הרץ:

```bash
npx supabase db push
```

או:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### שלב 2: אמת שהפונקציה קיימת

הרץ את השאילתה הזו ב-SQL Editor:

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('check_email_exists', 'check_phone_exists');
```

אמור להחזיר 2 שורות:
- check_email_exists | FUNCTION
- check_phone_exists | FUNCTION

### שלב 3: בדוק שהקוד עובד

1. הפעל את האפליקציה מחדש
2. נסה להירשם עם מייל חדש
3. בדוק את ה-console logs - אמור לראות:
   ```
   [RegistrationEmailScreen] בודק מייל: your@email.com
   [AuthService] checkEmailExists called for: your@email.com
   [AuthService] RPC response: { data: false, error: null }
   [RegistrationEmailScreen] תוצאת בדיקה: { exists: false, emailError: null }
   [RegistrationEmailScreen] המייל זמין
   ```

4. נסה להירשם עם מייל קיים - אמור לראות שגיאה:
   ```
   [RegistrationEmailScreen] המייל תפוס!
   ```

5. ודא שכפתור "המשך" נחסם כשיש שגיאה

## אם ה-Migration לא עובד

אם לא הצלחת להפעיל את ה-migration, הקוד יעבוד בכל מקרה!

הוספנו **fallback mechanism** ב-`authService.ts` שיבצע בדיקה ישירה אם ה-RPC function לא קיימת.

הקוד ינסה:
1. קודם - RPC function `check_email_exists` (מהיר ויעיל, `SECURITY DEFINER` עם הרשאה ל-`anon`)
2. רק אם ה-RPC לא קיים - בדיקה ישירה ב-`public.users`

> `auth.admin.getUserByEmail` **לא בשימוש** — ה-API הוסר מ-supabase-js, וממילא דורש service role key שאסור שיהיה בקליינט.

## בדיקות שכדאי לעשות

- ✅ נסה להירשם עם מייל חדש - צריך לאפשר המשך
- ✅ נסה להירשם עם מייל קיים - צריך להציג שגיאה ולחסום המשך
- ✅ נסה מייל לא תקין (בלי @) - צריך לחסום המשך
- ✅ נסה מייל ריק - צריך לחסום המשך
- ✅ בדוק שה-loading state עובד נכון
- ✅ בדוק שה-debounce עובד (הבדיקה מתרחשת אחרי 800ms)

## Debug

אם עדיין יש בעיות, בדוק את ה-console logs:

```javascript
// בדוק מה קורה בכל render
[RegistrationEmailScreen] Render state: {...}

// בדוק מה קורה בבדיקת המייל
[AuthService] checkEmailExists called for: ...
[AuthService] RPC response: ...

// בדוק מה קורה כשלוחצים "המשך"
[RegistrationEmailScreen] handleNext called
```

## קבצים ששונו

1. `screens/Auth/RegistrationEmailScreen.tsx` - ממשק המשתמש + validation
2. `services/authService.ts` - לוגיקת בדיקת המייל + fallback
3. `supabase/migrations/20260808000000_add_check_email_phone_functions.sql` - migration חדש

---

**תוקן בתאריך:** 8 באוגוסט 2026
**תוקן על ידי:** Agent
