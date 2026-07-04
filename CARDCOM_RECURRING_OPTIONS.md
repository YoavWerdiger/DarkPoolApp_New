# 🔄 אפשרויות Recurring Payments ב-Cardcom

## ✅ יש להם שירות מובנה!

Cardcom מציעים **"אישורית זהב" (BillGold)** - שירות recurring payments אוטומטי!

## 🎯 שתי אפשרויות:

### אופציה 1: LowProfile API עם Token (מה שעשינו)
- `Operation: "ChargeOnly"` - תשלום חד פעמי
- `Operation: "2"` - תשלום + יצירת Token
- מקבלים `TokenInfo` ב-Webhook
- **אנחנו** צריכים ליצור recurring payment בעצמנו עם ה-Token

### אופציה 2: BillGold API - שירות מובנה! ⭐
- Cardcom מספקים `BillGold/CreateCharge` API
- אבל **עדיין צריך** לקרוא ל-API הזה בעצמנו
- לא לגמרי אוטומטי - צריך Scheduled Function

## 📋 איך זה עובד:

### שלב 1: יצירת Token
```typescript
// ב-LowProfile/Create
Operation: "2" // Charge + Create Token
```

### שלב 2: שמירת Token
- Webhook מקבל `TokenInfo` עם `Token`
- שומרים ב-`user_subscriptions.cardcom_token`

### שלב 3: Recurring Charge (עם BillGold API)
```typescript
// צריך לקרוא ל-BillGold/CreateCharge
POST https://secure.cardcom.solutions/api/v11/BillGold/CreateCharge
{
  "Token": "84cc1f4f-c089-410b-9f93-6437ac9abba6",
  "Amount": 99,
  "Description": "מנוי חודשי"
}
```

## ⚠️ חשוב לדעת:

**אין שירות 100% אוטומטי!**

1. **BillGold API** - עדיין צריך **לנו** לקרוא ל-API
2. **אין Scheduled Service** - Cardcom לא גובים אוטומטית
3. **צריך ליצור** Scheduled Function/Edge Function

## 💡 מה צריך לעשות:

### אופציה A: Scheduled Function (מומלץ)
- Edge Function שרץ כל יום
- בודק מנויים שפגו
- קורא ל-`BillGold/CreateCharge` אוטומטית

### אופציה B: Dashboard של Cardcom
- **תתקשר ל-Cardcom ותשאל:**
  1. האם יש Dashboard להגדרת recurring payments אוטומטיים?
  2. האם יש Scheduled Service שהם מספקים?
  3. איך מגדירים "אישורית זהב" אוטומטית?

## 🎯 המלצה:

**תתקשר ל-Cardcom (03-9436100, לחץ 2 לתמיכת מפתחים) ותשאל:**
1. האם יש שירות recurring payments **100% אוטומטי**?
2. האם יש Dashboard להגדרת recurring payments?
3. איך מגדירים "אישורית זהב" אוטומטית?
4. האם יש API endpoint ל-Scheduled Recurring Charges?

אם **אין** שירות אוטומטי - צריך ליצור Scheduled Function בעצמנו! 🔧

