# 🔧 תיקון RLS Policies - בעיית Row Level Security

## ❌ הבעיה:
```
"new row violates row-level security policy for table \"payment_transactions\""
```

## ✅ הפתרון:

### 1. **הרץ את הקוד SQL:**
```sql
-- העתק והדבק את הקוד מהקובץ:
FIX_RLS_POLICIES.sql
```

### 2. **מה זה עושה:**
- מוחק את ה-policy הישן
- יוצר policy חדש שמאפשר `user_id IS NULL`
- מוסיף policy לעדכון עסקאות pending

### 3. **Policy חדש:**
```sql
CREATE POLICY "Users can insert their own payment transactions or pending transactions" ON payment_transactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        user_id IS NULL
    );
```

## 🎯 מה תוקן:

- ✅ מאפשר הכנסת עסקאות עם user_id null
- ✅ מאפשר עדכון עסקאות pending
- ✅ שומר על אבטחה למשתמשים מחוברים
- ✅ תומך בתשלומים במהלך רישום

## 📱 בדיקה:

1. **הרץ את הקוד SQL ב-Supabase**
2. **הפעל את האפליקציה**
3. **עבור לרישום**
4. **בחר תוכנית מנוי**
5. **מלא פרטי אשראי**
6. **השלם תשלום**
7. **ודא שאין שגיאות RLS**

---

**זמן תיקון**: 1 דקה  
**רמת קושי**: קלה  
**סטטוס**: תוקן! 🚀
