# 🐛 מדריך דיבוג - בעיית קארדקום API

## הבעיה הנוכחית ❌

```
❌ PaymentService: CardCom LowProfile API error: {"Description": "שם משתמש או סיסמה שגויים", "ResponseCode": 603}
```

## שלבי הדיבוג 🔍

### שלב 1: בדיקת הלוגים המפורטים

עכשיו המערכת תציג לוגים מפורטים יותר:

```
🔍 CardCom Config Validation:
  Terminal Number: 147763
  API Name: y5N7Nh1YfRlrqaa1TFzY
  API Password: ***3Ya
  Base URL: https://secure.cardcom.solutions/api/v11
  Full Endpoint: https://secure.cardcom.solutions/api/v11/LowProfile/Create

🔄 PaymentService: Request Data: {
  "TerminalNumber": 147763,
  "ApiName": "y5N7Nh1YfRlrqaa1TFzY",
  "Operation": "ChargeOnly",
  ...
}

🔄 PaymentService: Response status: 200
🔄 PaymentService: Response headers: {...}
```

### שלב 2: בדיקות אפשריות

#### א. בעיית מפתח API
- **בדוק בקארדקום** שהמפתח פעיל
- **ודא שהמפתח מאושר** ל-LowProfile
- **בדוק תאריך תפוגה** של המפתח

#### ב. בעיית מסוף
- **ודא שמסוף 147763 פעיל**
- **בדוק שהמסוף מאושר** לתשלומים
- **ודא שהמסוף מקושר** למפתח

#### ג. בעיית רשת
- **בדוק חיבור לאינטרנט**
- **נסה גישה ישירה** ל-https://secure.cardcom.solutions
- **בדוק אם יש חסימת firewall**

### שלב 3: פתרונות אפשריים

#### פתרון 1: בדיקת מפתח חדש
1. **היכנס לקארדקום** → הגדרות → מפתחות API
2. **צור מפתח חדש** או **אפס את הסיסמה**
3. **העתק את הפרטים החדשים** לקוד

#### פתרון 2: בדיקת הרשאות
1. **בדוק שהמפתח מאושר** ל-LowProfile
2. **ודא שיש הרשאה** לחיוב והפקת מסמכים
3. **בדוק שהמפתח פעיל** (לא מושבת)

#### פתרון 3: בדיקת גרסת API
אולי צריך לנסות גרסה אחרת:
- **API v10**: `https://secure.cardcom.solutions/api/v10`
- **API v9**: `https://secure.cardcom.solutions/api/v9`

### שלב 4: בדיקת התמונה

מהתמונה שלך אני רואה:
- ✅ **מפתח פעיל** מסומן
- ✅ **SSO פעיל** מסומן  
- ✅ **הרשאה לחיוב** מסומנת
- ⚠️ **הרשאה לזיכוי** לא מסומנת (לא נדרש)
- ⚠️ **הרשאה לביטול** לא מסומנת (לא נדרש)

## מה לבדוק עכשיו 🧪

1. **הפעל את האפליקציה** ונסה תשלום
2. **בדוק את הלוגים** בקונסול
3. **שלח לי את הלוגים המלאים** כדי שאוכל לעזור

## לוגים שאני צריך לראות 📋

```
🔍 CardCom Config Validation:
🔄 PaymentService: Full URL:
🔄 PaymentService: Request Data:
🔄 PaymentService: Response status:
🔄 PaymentService: Response headers:
🔄 PaymentService: CardCom LowProfile API response:
```

## תמיכה 📞

אם הבעיה נמשכת:
1. **פנה לתמיכת קארדקום** - המפתח לא עובד
2. **בדוק אם יש בעיה** במערכת שלהם
3. **נסה מפתח חדש** אם אפשר

---

**זמן בדיקה**: 5 דקות  
**רמת קושי**: בינונית  
**סטטוס**: 🔍 במעקב ודיבוג

*עדכון אחרון: 7 באוקטובר 2025*
