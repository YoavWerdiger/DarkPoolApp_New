# Finnhub - תוכנית חינמית 🆓

## ⚠️ מגבלות התוכנית החינמית

### ❌ לא זמין בתוכנית חינמית:
- **Economic Calendar** - יומן אירועים כלכליים (Premium בלבד)
- **Company Earnings Calendar** - לוח רווחים (Premium בלבד)
- Historical Data - נתונים היסטוריים מלאים

### ✅ כן זמין בתוכנית חינמית:
- **Market News** - חדשות שוק כלליות (60 קריאות/דקה)
- **Company News** - חדשות חברות
- **Stock Quotes** - נתוני מניות בסיסיים
- **Forex Rates** - שערי מט"ח בסיסיים
- **Crypto Data** - נתוני קריפטו בסיסיים

---

## 📊 מה השתמשנו בפועל?

### ביומן הכלכלי:
- ❌ **Finnhub Economic Calendar** - לא זמין בחינם
- ✅ **EODHD** - משמש כברירת מחדל
- ✅ **FRED API** - נתוני הפדרל ריזרב (חינם)

### בחדשות (אפשר להוסיף בעתיד):
- ✅ **Finnhub Market News** - זמין!
- ✅ **Finnhub Company News** - זמין!

---

## 💡 המלצות

### אם אתה רוצה Economic Calendar מ-Finnhub:

**תוכנית Starter** - $7.99/חודש
- ✅ Economic Calendar
- ✅ Earnings Calendar
- ✅ 300 API calls/דקה
- ✅ Historical Data

**קישור להשדרוג**: https://finnhub.io/pricing

### אם אתה רוצה להישאר חינמי:

השתמש בשילוב של:
1. **EODHD** - יומן כלכלי (חינם עד מגבלה מסוימת)
2. **FRED** - נתוני פדרל ריזרב (חינם לחלוטין)
3. **Finnhub** - חדשות בלבד

---

## 🔧 איך השתמשנו ב-Finnhub במקום?

### ✅ אפשרות 1: חדשות שוק ביומן החדשות

במקום יומן כלכלי, אפשר להשתמש ב-Finnhub לחדשות:

```typescript
import FinnhubService from './services/finnhubService';

// קבלת חדשות כלליות
const news = await FinnhubService.getMarketNews('general');

// קבלת חדשות פורקס
const forexNews = await FinnhubService.getMarketNews('forex');

// קבלת חדשות קריפטו
const cryptoNews = await FinnhubService.getMarketNews('crypto');
```

### ✅ אפשרות 2: חדשות חברות ספציפיות

```typescript
// חדשות Apple מחודש אחרון
const today = new Date();
const monthAgo = new Date(today);
monthAgo.setMonth(today.getMonth() - 1);

const appleNews = await FinnhubService.getCompanyNews(
  'AAPL',
  monthAgo.toISOString().split('T')[0],
  today.toISOString().split('T')[0]
);
```

---

## 📈 סטטיסטיקת שימוש

### ביומן הכלכלי (כרגע):

```
מקורות נתונים:
├── EODHD (ברירת מחדל) ✅
├── FRED (חלופה) ✅
└── Finnhub (🔒 נעול - Premium)
```

### בחדשות (אפשר להוסיף):

```
מקורות חדשות פוטנציאליים:
├── Finnhub Market News ✅ זמין
├── Finnhub Company News ✅ זמין
└── מקורות קיימים באפליקציה
```

---

## 🎯 סיכום

| תכונה | Free Plan | Starter ($7.99) |
|-------|-----------|-----------------|
| Economic Calendar | ❌ | ✅ |
| Market News | ✅ (60/min) | ✅ (300/min) |
| Company News | ✅ | ✅ |
| Stock Quotes | ✅ | ✅ |
| Historical Data | ❌ | ✅ |

---

## 💰 עלויות

### תוכנית חינמית:
- **עלות**: $0
- **API Calls**: 60/דקה
- **Economic Calendar**: ❌

### תוכנית Starter:
- **עלות**: $7.99/חודש
- **API Calls**: 300/דקה
- **Economic Calendar**: ✅
- **קישור**: https://finnhub.io/pricing

---

## ✅ מה עשינו באפליקציה?

1. ✅ השארנו את שירות Finnhub (למקרה שתרצה לשדרג)
2. ✅ שינינו את ברירת המחדל ל-EODHD
3. ✅ הוספנו הסבר ברור על המגבלות
4. ✅ סימנו את Finnhub כ"נעול" 🔒 בממשק
5. ✅ הוספנו Alert מסביר כשלוחצים על Finnhub

---

## 🚀 בעתיד - אפשר להוסיף

אם תרצה להשתמש ב-Finnhub בחינם:

### 📰 Tab חדשות מ-Finnhub
במקום יומן כלכלי, ניתן להוסיף:
- חדשות שוק בזמן אמת
- חדשות לפי חברה
- חדשות Forex/Crypto

זה **כן זמין** בתוכנית החינמית! 🎉

---

**זיכרון**: התוכנית החינמית של Finnhub מצוינת לחדשות, אבל ליומן כלכלי נשתמש ב-EODHD/FRED.

_עודכן: ${new Date().toLocaleDateString('he-IL')}_


