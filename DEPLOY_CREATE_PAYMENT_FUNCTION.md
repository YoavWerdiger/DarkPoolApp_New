# פריסת Edge Function ליצירת תשלום

## תיאור הבעיה
שגיאת RLS מונעת יצירת רשומות חדשות בטבלת `payment_transactions` מצד הלקוח:
```
ERROR: new row violates row-level security policy for table "payment_transactions"
```

## הפתרון
יצירת Edge Function שפועל עם `service_role_key` ועוקף את ה-RLS בצורה מבוקרת ובטוחה.

## שלבי הפריסה

### 1. התקנת Supabase CLI (אם לא מותקן)
```bash
npm install -g supabase
```

### 2. התחברות לפרויקט
```bash
# התחברות ל-Supabase
supabase login

# קישור לפרויקט
supabase link --project-ref wpmrtczbfcijoocguime
```

### 3. פריסת ה-Function
```bash
# מהתיקייה הראשית של הפרויקט
supabase functions deploy create-payment
```

### 4. בדיקת הפריסה
לאחר הפריסה, ה-URL של ה-function יהיה:
```
https://wpmrtczbfcijoocguime.supabase.co/functions/v1/create-payment
```

### 5. בדיקה ידנית (אופציונלי)
```bash
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/create-payment' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "transaction": {
      "id": "test_txn_123",
      "userId": "af781bb1-0529-4d80-9424-6564ec29457e",
      "planId": "premium",
      "amount": 99,
      "currency": "ILS",
      "status": "pending",
      "paymentUrl": "https://example.com"
    }
  }'
```

## מה השתנה בקוד

### לפני (paymentService.ts):
```typescript
// הכנסה ישירה למסד הנתונים - נכשל בגלל RLS
const { error } = await supabase
  .from('payment_transactions')
  .insert({...});
```

### אחרי (paymentService.ts):
```typescript
// שימוש ב-Edge Function שעוקף את ה-RLS בצורה מבוקרת
const { data, error } = await supabase.functions.invoke('create-payment', {
  body: { transaction: {...} }
});
```

## יתרונות הפתרון

1. **אבטחה** - Edge Function פועל עם `service_role_key` רק בצד השרת
2. **שקיפות** - הקוד בצד הלקוח נשאר פשוט וקריא
3. **שליטה** - ניתן להוסיף validations נוספות ב-Edge Function
4. **גמישות** - קל לשנות את הלוגיקה בלי לעדכן את האפליקציה

## בדיקה
לאחר הפריסה, נסה ליצור תשלום חדש באפליקציה:
1. פתח את מסך המנויים
2. בחר תוכנית תשלום
3. בדוק שהעסקה נשמרת בהצלחה בלי שגיאות RLS

## הערות חשובות

- ה-Edge Function דורש הגדרת `SUPABASE_SERVICE_ROLE_KEY` במשתני הסביבה של Supabase
- אם יש שגיאה, בדוק את הלוגים ב-Dashboard של Supabase: 
  `https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions`
- ודא שהטבלה `payment_transactions` קיימת ומכילה את כל העמודות הנדרשות

## פתרון אלטרנטיבי (אם Edge Function לא עובד)

אם יש בעיה עם Edge Functions, ניתן לשנות את מדיניות ה-RLS:

```sql
-- הרצת הקובץ FIX_PAYMENT_RLS_FINAL.sql
\i FIX_PAYMENT_RLS_FINAL.sql
```

זה ישנה את המדיניות כך שתאפשר למשתמשים מחוברים ליצור רשומות עבור עצמם.

