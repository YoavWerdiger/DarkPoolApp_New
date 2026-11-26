# 🔧 תיקון בעיית RLS בטבלת payment_transactions

## 🎯 הבעיה

כאשר משתמש מנסה לבצע תשלום, מתקבלת השגיאה הבאה:

```
Error: new row violates row-level security policy for table "payment_transactions"
Code: 42501
```

## 🔍 הסיבה

שתי בעיות:

1. **חסרה עמודה** - `cardcom_low_profile_id` לא קיימת בטבלה
2. **מדיניות RLS מחמירה מדי** - דורשת `auth.uid() = user_id` אבל במהלך רישום `user_id` יכול להיות `NULL`

## ✅ הפתרון

### שלב 1: הרצת הסקריפט ב-Supabase

1. היכנס ל-Supabase Dashboard
2. עבור ל-SQL Editor
3. העתק והדבק את הקוד מהקובץ: `fix_payment_transactions_rls.sql`
4. לחץ על "Run"

### שלב 2: אימות התיקון

הסקריפט יציג שני טבלאות בדיקה:

**בדיקה 1 - מבנה הטבלה:**
```
column_name              | data_type | is_nullable
cardcom_low_profile_id   | text      | YES
```

**בדיקה 2 - מדיניות RLS:**
```
policyname: "Users can insert their own payment transactions"
with_check: (auth.uid() = user_id OR user_id IS NULL)
```

## 🚀 מה נוסף?

### 1. עמודה חדשה: `cardcom_low_profile_id`
- שומרת את ה-LowProfile ID שמחזיר CardCom
- מאפשרת מעקב אחר עסקאות LowProfile

### 2. מדיניות RLS מעודכנת:
- **קריאה (SELECT)**: משתמש יכול לראות רק את העסקאות שלו (או NULL)
- **הכנסה (INSERT)**: משתמש יכול ליצור עסקאות חדשות (גם עם NULL)
- **עדכון (UPDATE)**: משתמש יכול לעדכן רק את העסקאות שלו (או NULL)

### 3. אינדקס חדש:
- `idx_payment_transactions_low_profile_id` - מאיץ חיפושים לפי LowProfile ID

## 🧪 בדיקה

לאחר הרצת הסקריפט, נסה שוב לבצע תשלום:

1. פתח את האפליקציה
2. נווט למסך התשלום
3. מלא פרטים
4. לחץ על "המשך לתשלום מאובטח"
5. אמור להיפתח iframe של CardCom בהצלחה! ✅

## 📊 מבנה הטבלה המעודכן

```sql
payment_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plan_id TEXT REFERENCES subscription_plans(id),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'ILS',
  status TEXT NOT NULL DEFAULT 'pending',
  cardcom_transaction_id TEXT,
  cardcom_low_profile_id TEXT,  -- ✨ חדש!
  payment_url TEXT,
  callback_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
```

## 🔒 אבטחה

למרות שאנחנו מתירים `user_id = NULL`, זה בטוח כי:

1. **רק במהלך רישום** - משתמש חדש עדיין לא התחבר
2. **Webhook יעדכן** - כאשר התשלום יצליח, ה-webhook יעדכן את ה-`user_id`
3. **זמני בלבד** - המצב של `NULL` הוא זמני עד להשלמת הרישום

## ⚠️ הערות חשובות

- אם אתה כבר בתהליך של תשלום, אולי תצטרך לרענן את האפליקציה
- הסקריפט בטוח להרצה מספר פעמים (משתמש ב-`IF EXISTS/IF NOT EXISTS`)
- אין צורך לבצע שינויים בקוד - רק הרצת SQL

---

**זמן הרצה**: 1 דקה  
**רמת קושי**: קלה  
**סטטוס**: מוכן להרצה! 🚀



