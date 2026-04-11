# 🔄 איך עובד Recurring Payments עם Cardcom

## 📋 סקירה כללית

כשמשתמש משלם בפעם הראשונה דרך LowProfile API, Cardcom **יכול** ליצור Token של הכרטיס (אם המשתמש מאשר).

## 🔍 איך יודעים אם נוצר Token?

### 1. **Webhook מקבל TokenInfo**
כשהתשלום מצליח, ה-Webhook (`rapid-responder`) מקבל:
```json
{
  "TokenInfo": {
    "Token": "84cc1f4f-c089-410b-9f93-6437ac9abba6",
    "TokenExDate": "2026-12-31",
    "CardYear": 2025,
    "CardMonth": 12
  },
  "TranzactionInfo": {
    "Last4CardDigits": "1234",
    "Brand": "Visa"
  }
}
```

### 2. **הטיפול ב-Webhook**
ה-Webhook עכשיו:
- ✅ מחלץ את ה-`TokenInfo`
- ✅ שומר את ה-Token ב-`user_subscriptions.cardcom_token`
- ✅ שומר את תאריך התפוגה של ה-Token
- ✅ שומר את 4 הספרות האחרונות של הכרטיס

## 💳 יצירת Recurring Payment

### אופציה 1: Transaction API עם Token (מומלץ)
```typescript
// כשהמנוי פג ו-auto_renew = true
await paymentService.createRecurringPayment(userId, planId);
```

זה:
1. לוקח את ה-Token מ-`user_subscriptions`
2. קורא ל-`/api/v11/Transactions/Transaction` עם ה-Token
3. Cardcom גובה את הכסף אוטומטית
4. מעדכן את `expires_at` של המנוי

### אופציה 2: RecurringPayments API
לפי התיעוד, אפשר גם להשתמש ב-`/api/v11/RecuringPayments/` אבל זה דורש הגדרה נוספת.

## 🔄 תהליך אוטומטי

1. **תשלום ראשון**: משתמש משלם → Webhook מקבל Token → שומר ב-DB
2. **כשהמנוי פג**: 
   - בדיקה אם `auto_renew = true` ויש `cardcom_token`
   - קריאה ל-`createRecurringPayment()`
   - Cardcom גובה אוטומטית עם ה-Token
   - עדכון `expires_at`

## ⚠️ חשוב לדעת

1. **Token לא תמיד נוצר**: 
   - תלוי בהגדרות Cardcom
   - תלוי אם המשתמש מאשר שמירת כרטיס
   - צריך לבדוק ב-Webhook אם יש `TokenInfo`

2. **תאריך תפוגה של Token**:
   - `TokenExDate` - תאריך תפוגה של ה-Token
   - אם ה-Token פג, צריך תשלום חדש

3. **Recurring Payments לא אוטומטיים**:
   - צריך ליצור Cron Job או Scheduled Function
   - בודק מנויים שפגו עם `auto_renew = true`
   - קורא ל-`createRecurringPayment()`

## 📝 מה צריך לעשות עכשיו:

1. ✅ **הריץ את ה-SQL**: `ADD_PAYMENT_TOKEN_SUPPORT.sql`
2. ✅ **הריץ את ה-SQL**: `INSERT_SUBSCRIPTION_PLANS.sql`
3. ✅ **Deploy את ה-Webhook**: `rapid-responder` (עם התיקונים)
4. ⏳ **צור Scheduled Function**: לבדוק מנויים שפגו ולגבות אוטומטית

## 🎯 השלב הבא - Scheduled Function

צריך ליצור Edge Function שרץ כל יום ובודק:
- מנויים עם `expires_at <= NOW()`
- `auto_renew = true`
- יש `cardcom_token`
- קורא ל-`createRecurringPayment()`

