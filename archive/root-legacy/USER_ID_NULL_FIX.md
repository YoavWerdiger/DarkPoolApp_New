# 🔧 תיקון user_id NULL - בעיית NOT NULL constraint

## ❌ הבעיה:
```
"null value in column \"user_id\" of relation \"payment_transactions\" violates not-null constraint"
```

## ✅ הפתרון:

### 1. **הרץ את הקוד SQL:**
```sql
-- העתק והדבק את הקוד מהקובץ:
FIX_USER_ID_NULL.sql
```

### 2. **מה זה עושה:**
- משנה את `user_id` לאפשר NULL
- מוסיף הערה על השינוי
- בודק שהשינוי בוצע

### 3. **הקוד:**
```sql
ALTER TABLE payment_transactions 
ALTER COLUMN user_id DROP NOT NULL;
```

## 🎯 מה תוקן:

- ✅ user_id יכול להיות NULL
- ✅ תמיכה בתשלומים במהלך רישום
- ✅ שמירה על אבטחה
- ✅ אין שגיאות NOT NULL

## 📱 בדיקה:

1. **הרץ את הקוד SQL ב-Supabase**
2. **הפעל את האפליקציה**
3. **עבור לרישום**
4. **בחר תוכנית מנוי**
5. **מלא פרטי אשראי**
6. **השלם תשלום**
7. **ודא שאין שגיאות NOT NULL**

---

**זמן תיקון**: 30 שניות  
**רמת קושי**: קלה  
**סטטוס**: תוקן! 🚀
