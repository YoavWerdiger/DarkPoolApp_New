# 💳 מערכת התשלום - CardCom Integration

## סקירה כללית

מערכת התשלום המלאה עם אינטגרציה ל-CardCom API, כולל:
- תוכניות מנוי (חינם, פרימיום, פרו)
- דף צ'קאאוט מקצועי
- עיבוד תשלומים מאובטח
- ניהול מנויים
- היסטוריית תשלומים

## 🚀 הפעלה מהירה

### שלב 1: הגדרת מסד הנתונים

1. **פתח את Supabase Dashboard**
2. **עבור ל-SQL Editor**
3. **הפעל את הקובץ:**
```sql
\i payment_database_schema.sql
```

### שלב 2: הגדרת Edge Functions

1. **התקן Supabase CLI:**
```bash
npm install -g supabase
```

2. **התחבר לפרויקט:**
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

3. **העלה Functions:**
```bash
supabase functions deploy payment-callback
supabase functions deploy payment-success
```

### שלב 3: הגדרת URLs

עדכן את ה-URLs ב-`services/paymentService.ts`:
```typescript
export const CARDCOM_CONFIG = {
  // ... פרטים אחרים
  successUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-success',
  errorUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-success',
  callbackUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-callback'
};
```

### שלב 4: הפעלת האפליקציה

```bash
npm install
npm start
```

## 📱 תכונות המערכת

### תוכניות מנוי

#### 🆓 חינם
- גישה לקהילה הבסיסית
- עדכונים יומיים
- תמיכה מוגבלת
- גישה למסלול מתחילים

#### 👑 פרימיום (₪99/חודש)
- כל התכונות החינמיות
- אותות מסחר מתקדמים
- ניתוחים מקצועיים
- תמיכה 24/7
- גישה לכל המסלולים
- אותות בלעדיים

#### ⭐ פרו (₪199/חודש)
- כל התכונות הפרימיום
- ייעוץ אישי
- אותות בלעדיים
- ניתוחים מותאמים אישית
- גישה לחדר VIP
- מפגשים אישיים

### מסכים

#### מסך בחירת תוכנית (RegistrationPaymentScreen)
- בחירת תוכנית במהלך הרישום
- אינטגרציה עם CardCom
- תצוגה מקצועית של התוכניות

#### מסך צ'קאאוט (CheckoutScreen)
- דף תשלום מקצועי
- סיכום התשלום
- אבטחה מלאה
- אינטגרציה עם CardCom

#### מסך מנויים (SubscriptionScreen)
- ניהול מנוי נוכחי
- בחירת תוכניות חדשות
- היסטוריית תשלומים
- ביטול מנוי

## 🔧 API Endpoints

### CardCom Integration

#### יצירת בקשת תשלום
```typescript
const paymentRequest = {
  amount: 99,
  currency: 'ILS',
  description: 'מנוי פרימיום',
  userId: 'user-id',
  planId: 'premium',
  userEmail: 'user@example.com',
  userName: 'שם משתמש'
};

const response = await paymentService.createPaymentRequest(paymentRequest);
```

#### עיבוד Callback
```typescript
// Edge Function: payment-callback
// מטפל ב-callbacks מ-CardCom
// מעדכן סטטוס עסקאות
// מפעיל מנויים
```

### Supabase Functions

#### payment-callback
- **URL:** `/functions/v1/payment-callback`
- **Method:** POST
- **תפקיד:** עיבוד callbacks מ-CardCom

#### payment-success
- **URL:** `/functions/v1/payment-success`
- **Method:** GET
- **תפקיד:** דף הצלחת תשלום

## 🗄️ מבנה מסד הנתונים

### טבלאות

#### subscription_plans
```sql
- id (TEXT PRIMARY KEY)
- name (TEXT)
- description (TEXT)
- price (INTEGER)
- period (TEXT)
- features (JSONB)
- role (TEXT)
- popular (BOOLEAN)
- active (BOOLEAN)
```

#### payment_transactions
```sql
- id (TEXT PRIMARY KEY)
- user_id (UUID)
- plan_id (TEXT)
- amount (INTEGER)
- currency (TEXT)
- status (TEXT)
- cardcom_transaction_id (TEXT)
- payment_url (TEXT)
- callback_data (JSONB)
```

#### user_subscriptions
```sql
- id (UUID PRIMARY KEY)
- user_id (UUID)
- plan_id (TEXT)
- status (TEXT)
- starts_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- auto_renew (BOOLEAN)
```

### פונקציות

#### get_user_active_subscription(user_uuid)
מחזיר את המנוי הפעיל של המשתמש

#### renew_expired_subscriptions()
מחדש מנויים שפגו תוקפם אוטומטית

## 🔐 אבטחה

### RLS Policies
- משתמשים יכולים לראות רק את העסקאות שלהם
- משתמשים יכולים לראות רק את המנויים שלהם
- תוכניות מנוי זמינות לכולם לקריאה

### CardCom Security
- הצפנת SSL 256-bit
- אסימוני כרטיס מאובטחים
- אימות דו-שלבי

## 🧪 בדיקות

### בדיקת תשלום
1. בחר תוכנית פרימיום
2. לחץ על "שלם עכשיו"
3. ודא שהדפדפן נפתח
4. השלם תשלום בדף CardCom
5. ודא שחזרת לאפליקציה

### בדיקת מנוי
1. עבור למסך מנויים
2. ודא שהמנוי הנוכחי מוצג
3. נסה לשדרג תוכנית
4. בדוק היסטוריית תשלומים

## 🐛 פתרון בעיות

### שגיאת "לא ניתן לפתוח דף תשלום"
- ודא שה-URLs מוגדרים נכון
- בדוק חיבור לאינטרנט
- ודא שהדפדפן מותקן

### שגיאת "תשלום נכשל"
- בדוק פרטי CardCom
- ודא שה-Edge Functions הועלו
- בדוק לוגים ב-Supabase

### מנוי לא מתעדכן
- בדוק שה-callback function עובד
- ודא שה-RLS policies מוגדרים נכון
- בדוק פרטי המשתמש

## 📞 תמיכה

לבעיות טכניות או שאלות:
1. בדוק את הלוגים ב-Supabase Dashboard
2. בדוק את ה-Edge Functions
3. ודא שכל הקבצים הועלו נכון

## 🔄 עדכונים עתידיים

- [ ] תמיכה בכרטיסי אשראי בינלאומיים
- [ ] מנוי שנתי עם הנחה
- [ ] מערכת הנחות וקופונים
- [ ] תמיכה ב-PayPal
- [ ] דוחות מפורטים למנהלים

---

**זמן הפעלה משוער**: 30-45 דקות  
**רמת קושי**: מתקדמת  
**דרישות**: Supabase project, CardCom account, Node.js, Expo CLI
