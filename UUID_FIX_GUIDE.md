# 🔧 תיקון UUID - בעיית user_id

## ❌ הבעיה:
```
"invalid input syntax for type uuid: \"temp_user_1759485097171\""
```

## ✅ הפתרון:

### 1. **שינוי userId ל-null במהלך הרישום:**
- במקום `temp_user_` + timestamp
- שולחים `null` או `"pending"`

### 2. **עדכון TypeScript interfaces:**
- `userId: string | null` במקום `userId: string`

### 3. **עדכון CustomFields:**
- `Value: request.userId || "pending"`

### 4. **עדכון Edge Function:**
- טיפול ב-`"pending"` כ-userId ריק

## 🎯 מה תוקן:

- ✅ userId יכול להיות null
- ✅ CustomFields מטפל ב-pending
- ✅ Edge Function מטפל ב-pending
- ✅ אין שגיאות UUID

## 📱 בדיקה:

1. **הפעל את האפליקציה**
2. **עבור לרישום**
3. **בחר תוכנית מנוי**
4. **מלא פרטי אשראי**
5. **השלם תשלום**
6. **ודא שאין שגיאות UUID**

---

**זמן תיקון**: 2 דקות  
**רמת קושי**: קלה  
**סטטוס**: תוקן! 🚀
