# 📊 מערכת דיווחי תוצאות (Earnings Reports)

> מערכת אוטומטית לניהול ותצוגה של דיווחי תוצאות רבעוניים מהבורסה האמריקאית

---

## 🎯 מה זה?

מערכת **פשוטה ויעילה** שמספקת למשתמשים:

✅ דיווחי תוצאות מתוכננים (30 יום קדימה)  
✅ תוצאות בפועל בזמן אמת (2x ביום)  
✅ תצוגה מעוצבת עם צבעים ואינדיקטורים  
✅ עדכון אוטומטי ללא התערבות ידנית  

---

## 📁 קבצים במערכת

```
📦 מערכת דיווחי תוצאות
│
├── 📂 supabase/functions/
│   ├── earnings-daily-sync/          # פונקציה 1: סנכרון יומי
│   │   └── index.ts
│   └── earnings-results-update/      # פונקציה 2: עדכון תוצאות
│       └── index.ts
│
├── 📂 screens/News/
│   └── EarningsReportsTab.tsx        # תצוגה באפליקציה
│
├── 📂 services/
│   └── earningsService.ts            # לוגיקה עסקית
│
├── 📄 setup_earnings_cron.sql        # הגדרת Cron Jobs (Pro Plan)
├── 📄 deploy_earnings_system.sh      # סקריפט פריסה
│
└── 📚 Documentation/
    ├── N8N_EARNINGS_SETUP.md         # ⏰ הגדרת n8n (חינמי!)
    ├── EARNINGS_QUICK_START.md       # ⚡ התחלה מהירה
    ├── EARNINGS_SETUP_GUIDE.md       # 📖 מדריך מלא
    └── EARNINGS_FLOW.md              # 🔄 תרשים זרימה
```

---

## 🚀 התחלה מהירה

### 1️⃣ פריסה (חד פעמי)

```bash
# פרוס את 2 הפונקציות
./deploy_earnings_system.sh
```

### 2️⃣ הגדרת תזמון (חד פעמי)

**⚠️ חשוב:** Supabase Cron דורש Pro Plan ($25/חודש)

**פתרון חינמי מומלץ:** n8n
1. קרא את **N8N_EARNINGS_SETUP.md**
2. צור 3 Workflows פשוטים ב-[n8n.io](https://n8n.io)
3. זמן: 5 דקות בלבד!

### 3️⃣ זהו! 🎉

המערכת רצה אוטומטית.

---

## ⏰ לוח זמנים

| זמן (ישראל) | פונקציה | תיאור |
|-------------|----------|-------|
| **06:00** | `earnings-daily-sync` | סנכרון יומי - 30 יום קדימה |
| **04:30** | `earnings-results-update` | עדכון BeforeMarket |
| **23:00** | `earnings-results-update` | עדכון AfterMarket |

---

## 🏗️ ארכיטקטורה

```
EODHD API
    ↓
Edge Functions (2)
    ↓
Supabase DB (earnings_calendar)
    ↓
React Native App
    ↓
👥 משתמשים
```

**פשוט. יעיל. אוטומטי.**

---

## 📊 מה המשתמשים רואים?

### דוגמה 1: לפני דיווח
```
┌─────────────────────────────────┐
│ JPM                 Q3 2025     │
│ 🌅 לפני פתיחה                  │
│ תחזית רווחיות: $4.87           │
│ תחזית הכנסות: $42.5B           │
└─────────────────────────────────┘
```

### דוגמה 2: אחרי דיווח (הפתעה חיובית)
```
┌─────────────────────────────────┐
│ JPM                 Q3 2025     │
│ 🌅 לפני פתיחה                  │
│ רווחיות: $5.10 🟢               │
│ הכנסות: $45.2B                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │      +4.7% 🟢               │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 🔧 תחזוקה

### בדיקת מצב

```sql
-- סטטוס Cron Jobs
SELECT * FROM cron.job WHERE jobname LIKE 'earnings%';

-- היסטוריית ריצות
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'earnings%')
ORDER BY start_time DESC LIMIT 10;
```

### הרצה ידנית

```bash
# סנכרון יומי
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-sync' \
  -H 'Authorization: Bearer YOUR_KEY'

# עדכון תוצאות
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update' \
  -H 'Authorization: Bearer YOUR_KEY'
```

---

## 📚 מסמכים נוספים

- **⏰ [N8N_EARNINGS_SETUP.md](N8N_EARNINGS_SETUP.md)** - הגדרת n8n (חינמי!) **← התחל כאן!**
- **⚡ [EARNINGS_QUICK_START.md](EARNINGS_QUICK_START.md)** - התחלה מהירה (5 דקות)
- **📖 [EARNINGS_SETUP_GUIDE.md](EARNINGS_SETUP_GUIDE.md)** - מדריך מפורט
- **🔄 [EARNINGS_FLOW.md](EARNINGS_FLOW.md)** - תרשימי זרימה וארכיטקטורה

---

## 🎯 תכונות מרכזיות

### ✅ פונקציות Edge

- **earnings-daily-sync**: סנכרון יומי של דיווחים מתוכננים
- **earnings-results-update**: עדכון תוצאות בפועל

### ✅ Cron Jobs

- 3 Jobs אוטומטיים
- ריצה בזמני שיא (לפני/אחרי השוק)
- אמינות גבוהה

### ✅ תצוגה

- עיצוב מודרני ונקי
- צבעים דינמיים (🟢/🔴)
- אייקונים (☀️/🌙)
- מידע מפורט (תחזית, תוצאה, הפתעה)

---

## 🐛 תמיכה

בעיות? שאלות?

1. בדוק את [EARNINGS_SETUP_GUIDE.md](EARNINGS_SETUP_GUIDE.md)
2. בדוק לוגים ב-Supabase Dashboard
3. הרץ בדיקה ידנית

---

## 📈 נתונים

**מקור:** EODHD API  
**כיסוי:** ~70 מניות מהאינדקסים הגדולים (S&P 500, NASDAQ, DOW)  
**תדירות עדכון:** 3 פעמים ביום  
**טווח:** 30 יום קדימה  

---

## ✨ סיכום

מערכת פשוטה ואמינה שמספקת למשתמשים **מידע עדכני** על דיווחי תוצאות רבעוניים.

**2 פונקציות. 3 Cron Jobs. אפס טרחה.** 🚀

---

**נבנה ב-❤️ עם Supabase + EODHD API**

