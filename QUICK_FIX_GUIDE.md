    # 🔧 מדריך תיקון מהיר - CardCom LowProfile API

## ❌ השגיאה:
```
"document total product sum not equal to credit card sum to bill"
ResponseCode: 5045
```

## ✅ הפתרון:

### 1. **הסרת Document מהבקשה:**
- LowProfile API לא דורש Document עבור עסקאות פשוטות
- הסרנו את השדה `Document` מהבקשה

### 2. **הוספת CustomFields:**
- הוספנו `CustomFields` להעברת פרטי המשתמש
- כולל: `userId`, `planId`, `transactionId`

### 3. **עדכון Edge Function:**
- עדכנו את ה-callback כדי לטפל ב-CustomFields
- חילוץ פרטי המשתמש מ-CustomFields

## 🚀 מה להריץ:

### שלב 1: עדכון Edge Function
```bash
# העתק את הקוד המעודכן מהקובץ:
EDGE_FUNCTIONS_CODE.txt

# והדבק ב-Supabase Function:
# quick-endpoint (payment-callback)
```

### שלב 2: בדיקת התשלום
```bash
npm start
```

## 📱 בדיקה:

1. **בחר מסלול חודשי** (₪99)
2. **מלא פרטי כרטיס אשראי**
3. **השלם תשלום**
4. **ודא שהמנוי הופעל**

## 🎯 מה תוקן:

- ✅ הסרת Document מהבקשה
- ✅ הוספת CustomFields
- ✅ עדכון Edge Function
- ✅ טיפול ב-CustomFields ב-callback

---

**זמן תיקון**: 2 דקות  
**רמת קושי**: קלה  
**סטטוס**: תוקן! 🚀
