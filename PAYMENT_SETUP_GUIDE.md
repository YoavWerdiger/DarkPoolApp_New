# 💳 מדריך הפעלת מערכת התשלום

## 🚀 הפעלה מהירה - שלב אחר שלב

### שלב 1: הפעלת מסד הנתונים

1. **פתח את Supabase Dashboard**
2. **עבור ל-SQL Editor**
3. **העתק והדבק את הקוד הבא:**

```sql
-- הפעל את סכמת מסד הנתונים
\i payment_database_schema.sql
```

4. **לחץ על "Run"**

### שלב 2: בדיקה שהכל עובד

הפעל את הפקודות הבאות כדי לוודא שהכל נוצר נכון:

```sql
-- בדוק שהטבלאות נוצרו
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscription_plans', 'payment_transactions', 'user_subscriptions');

-- בדוק את תוכניות המנוי
SELECT * FROM subscription_plans ORDER BY price;

-- בדוק את הפונקציות
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_user_active_subscription', 'renew_expired_subscriptions');
```

### שלב 3: העלאת Edge Functions

1. **פתח טרמינל בפרויקט**
2. **התקן Supabase CLI (אם לא מותקן):**
```bash
npm install -g supabase
```

3. **התחבר לפרויקט:**
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

4. **העלה את ה-Functions:**
```bash
supabase functions deploy payment-callback
supabase functions deploy payment-success
```

### שלב 4: עדכון URLs

עדכן את ה-URLs ב-`services/paymentService.ts`:

```typescript
export const CARDCOM_CONFIG = {
  terminalNumber: '147763',
  userName: 'y5N7Nh1YfRIrqaa1TFzY',
  apiKey: 'IQWEk245ICRSmSJHJ3Ya',
  baseUrl: 'https://secure.cardcom.solutions/api/v1',
  successUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-success',
  errorUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-success',
  callbackUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-callback'
};
```

### שלב 5: הפעלת האפליקציה

```bash
npm install
npm start
```

## 📱 מה נוצר במערכת

### מסכים חדשים:

1. **מסך בחירת תוכנית** (RegistrationPaymentScreen)
   - במהלך הרישום
   - בחירת תוכנית מנוי

2. **מסך צ'קאאוט עם פרטי אשראי** (CreditCardCheckoutScreen)
   - שדות פרטי כרטיס אשראי
   - פרטים אישיים
   - סיכום תשלום
   - אבטחה מלאה

3. **מסך מנויים** (SubscriptionScreen)
   - ניהול מנוי נוכחי
   - בחירת תוכניות חדשות
   - היסטוריית תשלומים

### תוכניות מנוי:

- 🆓 **חינם** - תכונות בסיסיות
- 👑 **פרימיום** (₪99/חודש) - תכונות מתקדמות  
- ⭐ **פרו** (₪199/חודש) - תכונות מקצועיות

### טבלאות במסד הנתונים:

- `subscription_plans` - תוכניות מנוי
- `payment_transactions` - עסקאות תשלום
- `user_subscriptions` - מנויי משתמשים

## 🔧 בדיקות

### בדיקת תשלום:
1. בחר תוכנית פרימיום
2. לחץ על "שלם עכשיו"
3. מלא פרטי כרטיס אשראי
4. השלם תשלום
5. ודא שהמנוי הופעל

### בדיקת מנוי:
1. עבור למסך מנויים
2. ודא שהמנוי הנוכחי מוצג
3. נסה לשדרג תוכנית
4. בדוק היסטוריית תשלומים

## 🐛 פתרון בעיות

### שגיאת "טבלה לא קיימת":
- ודא שהפעלת את `payment_database_schema.sql`
- בדוק שהטבלאות נוצרו עם פקודות הבדיקה

### שגיאת "Function לא קיימת":
- ודא שהעלית את ה-Edge Functions
- בדוק שה-Functions עובדים ב-Supabase Dashboard

### שגיאת "תשלום נכשל":
- בדוק פרטי CardCom
- ודא שה-URLs מוגדרים נכון
- בדוק לוגים ב-Supabase

## 📞 תמיכה

אם יש בעיות:
1. בדוק את הלוגים ב-Supabase Dashboard
2. ודא שכל הקבצים הועלו נכון
3. בדוק שה-RLS policies מוגדרים

---

**זמן הפעלה**: 15-20 דקות  
**רמת קושי**: בינונית  
**דרישות**: Supabase project, Node.js, Expo CLI
