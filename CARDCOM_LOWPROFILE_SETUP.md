# 🚀 מדריך הפעלה - CardCom LowProfile API

## ✅ מה עודכן:

### 1. **API חדש - LowProfile v11:**
- **URL**: `https://secure.cardcom.solutions/api/v11/LowProfile/Create`
- **פורמט**: JSON במקום Form Data
- **תגובה**: `LowProfileId` במקום `TransactionId`

### 2. **תוכניות מנוי חדשות:**
- 🟢 **מסלול חודשי** - ₪99 לחודש (מומלץ)
- 🟡 **מסלול רבעוני** - ₪250 לרבעון (הנחה 16%)
- 🟠 **מסלול שנתי** - ₪999 לשנה (הנחה 16%)

### 3. **מסד נתונים מעודכן:**
- עמודה חדשה: `cardcom_low_profile_id`
- אינדקס חדש: `idx_payment_transactions_low_profile_id`

## 🔧 מה להריץ:

### שלב 1: עדכון מסד הנתונים
```sql
-- העתק והדבק את הקוד מהקובץ:
UPDATE_SUBSCRIPTION_PLANS.sql
```

### שלב 2: עדכון Edge Functions
```bash
# העתק את הקוד מהקובץ:
EDGE_FUNCTIONS_CODE.txt

# והדבק ב-Supabase Functions:
# 1. quick-endpoint (payment-callback)
# 2. super-action (payment-success)
```

### שלב 3: הפעלת האפליקציה
```bash
npm start
```

## 📱 מה נוצר:

### מסכים מעודכנים:
- **RegistrationPaymentScreen** - בחירת מסלול חיים
- **CreditCardCheckoutScreen** - תשלום למסלול חיים
- **SubscriptionScreen** - ניהול מסלול חיים

### API חדש:
- **LowProfile Create** - יצירת עסקת תשלום
- **LowProfile GetResult** - קבלת תוצאות עסקה
- **Webhook** - callback אוטומטי

## 🎯 בדיקות:

### 1. בדיקת מסלול חודשי:
1. בחר "מסלול חודשי"
2. מלא פרטי כרטיס אשראי
3. השלם תשלום ₪99
4. ודא שהמנוי הופעל לחודש

### 2. בדיקת מסלול רבעוני:
1. בחר "מסלול רבעוני"
2. מלא פרטי כרטיס אשראי
3. השלם תשלום ₪250
4. ודא שהמנוי הופעל ל-3 חודשים

### 3. בדיקת מסלול שנתי:
1. בחר "מסלול שנתי"
2. מלא פרטי כרטיס אשראי
3. השלם תשלום ₪999
4. ודא שהמנוי הופעל לשנה

## 💰 חישוב הנחות:

- **מסלול חודשי**: ₪99 × 12 = ₪1,188 לשנה
- **מסלול רבעוני**: ₪250 × 4 = ₪1,000 לשנה (הנחה 16%)
- **מסלול שנתי**: ₪999 לשנה (הנחה 16%)

## 🔐 פרטי CardCom LowProfile:

### API Configuration:
```typescript
export const CARDCOM_CONFIG = {
  terminalNumber: 147763,
  apiName: 'y5N7Nh1YfRIrqaa1TFzY',
  apiPassword: 'IQWEk245ICRSmSJHJ3Ya',
  baseUrl: 'https://secure.cardcom.solutions/api/v11',
  successUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/super-action',
  errorUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/super-action',
  callbackUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/quick-endpoint'
};
```

### LowProfile Request:
```json
{
  "TerminalNumber": 147763,
  "ApiName": "y5N7Nh1YfRIrqaa1TFzY",
  "Operation": "ChargeOnly",
  "ReturnValue": "txn_1234567890_abc123",
  "Amount": 99,
  "SuccessRedirectUrl": "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/super-action",
  "FailedRedirectUrl": "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/super-action",
  "WebHookUrl": "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/quick-endpoint",
  "ProductName": "מנוי מסלול חודשי - יוחנן כהן",
  "Language": "he",
  "ISOCoinId": 1,
  "Document": {
    "To": "יוחנן כהן",
    "Email": "yochanan@example.com",
    "Products": [{
      "Description": "מנוי מסלול חודשי - יוחנן כהן",
      "Quantity": 1,
      "Price": 99
    }]
  }
}
```

### LowProfile Response:
```json
{
  "ResponseCode": 0,
  "Description": "OK",
  "LowProfileId": "12345678-1234-1234-1234-123456789012",
  "Url": "https://secure.cardcom.solutions/LowProfile.aspx?lpId=12345678-1234-1234-1234-123456789012",
  "UrlToPayPal": null,
  "UrlToBit": null
}
```

## 🎉 מה מוכן:

- ✅ API חדש - LowProfile v11
- ✅ מסד נתונים מעודכן
- ✅ תוכניות מנוי חדשות
- ✅ מסכים מעודכנים
- ✅ Edge Functions מעודכנים
- ✅ מערכת תשלום מלאה

---

**זמן הפעלה**: 10 דקות  
**רמת קושי**: בינונית  
**סטטוס**: מוכן לשימוש! 🚀

## ⚠️ הערות חשובות:

1. **API חדש** - LowProfile v11 במקום API הישן
2. **פורמט JSON** - במקום Form Data
3. **LowProfileId** - במקום TransactionId
4. **Webhook** - callback אוטומטי עם פרטים מלאים
5. **תמיכה בתקופות** - חודשי, רבעוני, שנתי
