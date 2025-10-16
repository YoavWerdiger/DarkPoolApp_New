# ⏰ הגדרת n8n לדיווחי תוצאות

> **למה n8n?** Supabase Cron זמין רק ב-Pro Plan. n8n חינמי לגמרי! 🎉

---

## 🚀 התקנה מהירה

### אופציה 1: n8n Cloud (מומלץ - הכי פשוט)

1. היכנס ל-[n8n.io](https://n8n.io)
2. הירשם (חינמי)
3. צור Workflow חדש

---

## 📋 3 Workflows שצריך ליצור

### 1️⃣ **סנכרון יומי** (06:00 Israel Time)

```
┌─────────────┐      ┌──────────────┐
│   Cron      │ ───> │ HTTP Request │
│  0 3 * * *  │      │ POST to      │
│  (03:00 UTC)│      │ earnings-    │
│             │      │ daily-sync   │
└─────────────┘      └──────────────┘
```

**הגדרות:**

**Node 1: Schedule Trigger**
- Mode: `Every Day`
- Hour: `3` (UTC)
- Minute: `0`

**Node 2: HTTP Request**
- Method: `POST`
- URL: `https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-sync`
- Headers:
  ```json
  {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ",
    "Content-Type": "application/json"
  }
  ```

---

### 2️⃣ **עדכון בוקר** (04:30 Israel Time)

```
┌─────────────┐      ┌──────────────┐
│   Cron      │ ───> │ HTTP Request │
│ 30 1 * * *  │      │ POST to      │
│ (01:30 UTC) │      │ earnings-    │
│             │      │ results-     │
│             │      │ update       │
└─────────────┘      └──────────────┘
```

**הגדרות:**

**Node 1: Schedule Trigger**
- Mode: `Every Day`
- Hour: `1` (UTC)
- Minute: `30`

**Node 2: HTTP Request**
- Method: `POST`
- URL: `https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update`
- Headers: (אותם כמו למעלה)

---

### 3️⃣ **עדכון ערב** (23:00 Israel Time)

```
┌─────────────┐      ┌──────────────┐
│   Cron      │ ───> │ HTTP Request │
│  0 20 * * * │      │ POST to      │
│ (20:00 UTC) │      │ earnings-    │
│             │      │ results-     │
│             │      │ update       │
└─────────────┘      └──────────────┘
```

**הגדרות:**

**Node 1: Schedule Trigger**
- Mode: `Every Day`
- Hour: `20` (UTC)
- Minute: `0`

**Node 2: HTTP Request**
- Method: `POST`
- URL: `https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update`
- Headers: (אותם כמו למעלה)

---

## 🎯 צעדים מפורטים (n8n Cloud)

### 1. יצירת Workflow ראשון

1. **New Workflow** → שנה שם ל-`Earnings Daily Sync`
2. **Add Node** → **Schedule Trigger**
   - Trigger Interval: `Days`
   - Days Between Triggers: `1`
   - Trigger at Hour: `3`
   - Trigger at Minute: `0`
   - Timezone: `UTC`
3. **Add Node** → **HTTP Request**
   - Method: `POST`
   - URL: `https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-sync`
   - Authentication: `None`
   - Send Headers: `Yes`
     - Name: `Authorization`
     - Value: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ`
     - Name: `Content-Type`
     - Value: `application/json`
4. **Save** → **Activate** ✅

### 2. יצירת Workflow שני

חזור על התהליך עם:
- שם: `Earnings Morning Update`
- Hour: `1`
- Minute: `30`
- URL: `earnings-results-update`

### 3. יצירת Workflow שלישי

חזור על התהליך עם:
- שם: `Earnings Evening Update`
- Hour: `20`
- Minute: `0`
- URL: `earnings-results-update`

---

## ✅ בדיקה

### בדיקה ידנית

בכל Workflow:
1. לחץ על **Execute Workflow**
2. בדוק שהתשובה היא `200 OK`
3. בדוק ב-Supabase שהנתונים התעדכנו

---

## 🆚 n8n vs Supabase Cron

| תכונה | n8n | Supabase Cron |
|-------|-----|---------------|
| **מחיר** | 🟢 חינמי | 🔴 $25/חודש (Pro) |
| **קל להגדרה** | 🟢 UI ויזואלי | 🟡 SQL |
| **אמינות** | 🟢 גבוהה | 🟢 גבוהה |
| **גמישות** | 🟢 מאוד | 🟡 בסיסי |
| **ניטור** | 🟢 Dashboard | 🟡 לוגים |

---

## 🎯 סיכום

**n8n זה הפתרון המושלם:**
- ✅ חינמי לגמרי
- ✅ קל להגדרה (5 דקות)
- ✅ ממשק ויזואלי נוח
- ✅ ניטור וניהול קל
- ✅ אמין ויציב

**אין צורך ב-Supabase Pro!** 🎉

---

## 📱 אופציה 2: n8n Self-Hosted (Docker)

אם אתה רוצה לארח בעצמך:

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

ואז פתח: `http://localhost:5678`

---

## 🔗 קישורים שימושיים

- [n8n Cloud (חינמי)](https://n8n.io)
- [n8n Documentation](https://docs.n8n.io)
- [n8n Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)

---

## 💡 טיפ

שמור את ה-Authorization Bearer Token ב-n8n Credentials למען הבטיחות!

---

**מוכן להתחיל? לך ל-[n8n.io](https://n8n.io) ותתחיל! 🚀**

