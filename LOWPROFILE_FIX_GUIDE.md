# 🔧 חזרה ל-LowProfile API - אין הרשאה ל-Direct

## ❌ הבעיה:
```
"No permission for module : DealLocations.Direct::Direct"
ResponseCode: 660
```

## ✅ הפתרון:

### 1. **חזרה ל-LowProfile API:**
- אין הרשאה למודול Direct
- LowProfile API זמין ועובד
- זה הפתרון הנכון עבורך

### 2. **מה שונה:**
- **URL**: `/LowProfile/Create` במקום `/Transactions/Transaction`
- **מבנה**: LowProfile במקום Direct API
- **תגובה**: URL לדף תשלום במקום תגובה ישירה

### 3. **מבנה הבקשה:**
```json
{
  "TerminalNumber": 147763,
  "ApiName": "y5N7Nh1YfRIrqaa1TFzY",
  "Operation": "ChargeOnly",
  "ReturnValue": "txn_1234567890_abc123",
  "Amount": 99,
  "SuccessRedirectUrl": "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action",
  "FailedRedirectUrl": "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action",
  "WebHookUrl": "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/rapid-responder",
  "ProductName": "מנוי מסלול חודשי - דוד אריאל",
  "Language": "he",
  "ISOCoinId": 1
}
```

## 🎯 מה קורה עכשיו:

1. **מלא פרטי כרטיס** באפליקציה
2. **לחץ "שלם עכשיו"**
3. **תועבר לדף CardCom** (LowProfile)
4. **השלם את התשלום** בדף CardCom
5. **תועבר חזרה לאפליקציה** עם אישור

## 📱 בדיקה:

1. **הפעל את האפליקציה**
2. **עבור לרישום**
3. **בחר תוכנית מנוי**
4. **מלא פרטי כרטיס אשראי**
5. **לחץ "שלם עכשיו"**
6. **ודא שמועבר לדף CardCom**

## 🎉 יתרונות:

- ✅ **עובד עם ההרשאות שלך**
- ✅ **דף תשלום מאובטח**
- ✅ **PCI DSS compliant**
- ✅ **עיצוב מותאם אישית אפשרי**

---

**זמן בדיקה**: 2 דקות  
**רמת קושי**: קלה  
**סטטוס**: תוקן! 🚀
