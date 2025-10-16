# 🔍 בדיקת דיווחי AfterMarket

## הבעיה
לא רואים דיווחי AfterMarket באפליקציה

---

## 📋 שלבי הבדיקה:

### שלב 1: בדוק במסד הנתונים
```bash
# הרץ את הסקריפט (Supabase SQL Editor):
cat quick_check_after_market.sql
```

**מה לחפש:**
- כמה רשומות AfterMarket יש?
- דוגמאות של AAPL, MSFT, GOOGL (אמורות להיות AfterMarket)

---

### שלב 2: בדוק ב-API
```bash
./test_after_market_api.sh
```

**תוצאה צפויה:**
- AAPL: AfterMarket ✅
- MSFT: AfterMarket ✅  
- GOOGL: AfterMarket ✅
- סיכום: 8 AfterMarket, 2 BeforeMarket

---

### שלב 3: בדוק באפליקציה

#### A. פתח את האפליקציה
1. עבור לטאב "תחזיות"
2. בחר תאריך עם דיווחים (למשל 28-30 באוקטובר)

#### B. בדוק את הקונסול
חפש בלוגים:
```
✅ EarningsReportsTab: Filtered X reports for 2025-10-30
   BeforeMarket: X, AfterMarket: X, NULL: X
```

**מה לבדוק:**
- אם `AfterMarket: 0` → הבעיה היא בשליפה מהמסד
- אם `AfterMarket: > 0` → הבעיה היא בתצוגה

#### C. בדוק בכרטיסיות
האם אתה רואה:
- 🌙 (ירח כחול) = AfterMarket  
- ☀️ (שמש צהובה) = BeforeMarket

---

## 🔧 פתרונות אפשריים:

### בעיה 1: אין AfterMarket במסד
**פתרון:**
```bash
# הרץ סנכרון מחדש
./sync_historical_earnings.sh
```

### בעיה 2: AfterMarket במסד אבל לא באפליקציה
**אפשרויות:**
1. **Cache** - נקה את הקאש של האפליקציה
2. **Realtime** - בדוק שה-Realtime עובד
3. **Filtering** - בדוק שאין סינון נסתר בקוד

### בעיה 3: AfterMarket באפליקציה אבל לא מוצג נכון
**בדוק:**
- האם האייקון מוצג (🌙)?
- האם הטקסט "אחרי סגירה" מוצג?
- האם הצבע נכון (כחול)?

---

## 📊 דוגמאות לדיווחי AfterMarket באוקטובר 2025:

| תאריך | מניה | זמן | תחזית |
|-------|------|-----|--------|
| 28/10 | GOOGL | AfterMarket | $2.32 |
| 29/10 | MSFT | AfterMarket | $3.66 |
| 30/10 | AAPL | AfterMarket | $1.76 |
| 30/10 | AMZN | AfterMarket | TBD |
| 31/10 | META | AfterMarket | TBD |

---

## ✅ סימנים שהכל תקין:

1. ✅ במסד הנתונים: ~70-80% AfterMarket, ~20-30% BeforeMarket
2. ✅ באפליקציה: רואים אייקוני ירח כחול 🌙
3. ✅ בקונסול: `AfterMarket: > 0` בתאריכים עם דיווחים
4. ✅ בכרטיסיות: מציג "אחרי סגירה" בצבע כחול

---

## 🐛 אם עדיין לא עובד:

1. **נסה תאריך אחר** - אולי התאריך שבחרת אין בו AfterMarket
2. **בדוק לוגים** - חפש שגיאות בקונסול
3. **Refresh** - משוך למטה לרענן את הנתונים
4. **Restart** - סגור ופתח את האפליקציה מחדש

---

**תאריך יצירה**: אוקטובר 2025  
**עדכון אחרון**: לאחר הוספת לוג דיבאג

