# 🚀 מדריך הפעלה סופי - CardCom LowProfile API

## ✅ מה עודכן:

### 1. **URLs חדשים:**
- **Callback**: `https://wpmrtczbfcijoocguime.supabase.co/functions/v1/rapid-responder`
- **Success/Error**: `https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action`

### 2. **תוכניות מנוי:**
- 🟢 **מסלול חודשי** - ₪99 לחודש (מומלץ)
- 🟡 **מסלול רבעוני** - ₪250 לרבעון (הנחה 16%)
- 🟠 **מסלול שנתי** - ₪999 לשנה (הנחה 16%)

## 🔧 מה להריץ:

### שלב 1: עדכון מסד הנתונים
```sql
-- העתק והדבק את הקוד מהקובץ:
UPDATE_SUBSCRIPTION_PLANS.sql
```

### שלב 2: עדכון Edge Functions
```bash
# העתק את הקוד מהקבצים:
# payment-callback-function.ts → rapid-responder
# payment-success-function.ts → smart-action
```

### שלב 3: הפעלת האפליקציה
```bash
npm start
```

## 📱 בדיקות:

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
  successUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action',
  errorUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action',
  callbackUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/rapid-responder'
};
```

## 🎯 מה מוכן:

- ✅ URLs מעודכנים
- ✅ מסד נתונים מעודכן
- ✅ תוכניות מנוי חדשות
- ✅ מסכים מעודכנים
- ✅ Edge Functions מעודכנים
- ✅ מערכת תשלום מלאה

---

**זמן הפעלה**: 5 דקות  
**רמת קושי**: קלה  
**סטטוס**: מוכן לשימוש! 🚀

## ⚠️ הערות חשובות:

1. **URLs חדשים** - rapid-responder ו-smart-action
2. **API חדש** - LowProfile v11
3. **תמיכה בתקופות** - חודשי, רבעוני, שנתי
4. **מסלולים חיים** - כל התוכניות בתשלום
5. **הנחות משמעותיות** - עד 16% הנחה