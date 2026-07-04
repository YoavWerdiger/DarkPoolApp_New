# מדריך העלאה לאייפון - TestFlight ו-App Store

## שלב 1: בניית Production Build

```bash
eas build --platform ios --profile production
```

⏱️ זמן בנייה: 15-20 דקות

תוכל לעקוב אחר ההתקדמות ב:
- הטרמינל
- https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds

---

## שלב 2: העלאה ל-TestFlight

### אופציה A: אוטומטית עם EAS (מומלץ) ⭐

```bash
eas submit --platform ios --profile production
```

פקודה זו:
- ✅ מורידה את ה-IPA מה-EAS
- ✅ מעלה אותו ל-App Store Connect
- ✅ מכניס אותו ל-TestFlight אוטומטית

**הערה:** אם יש לך 2FA, EAS יבקש ממך את הקוד.

### אופציה B: ידנית

1. **הורד את ה-IPA** מה-EAS Dashboard
2. **כנס ל-App Store Connect** → **TestFlight**
3. **לחץ "Add Build"** או **"+"**
4. **העלה את ה-IPA**

---

## שלב 3: בדיקה ב-TestFlight

### הוספת בודקים:

1. **כנס ל-TestFlight** ב-App Store Connect
2. **Internal Testing:**
   - לחץ **"Add Internal Testers"**
   - הוסף את האימיילים של הבודקים
   - הם יקבלו אימייל עם קישור להורדה

3. **External Testing:**
   - לחץ **"Add External Testers"**
   - הוסף בודקים (עד 10,000)
   - צריך לשלוח לבדיקה של Apple (לוקח כמה שעות)

### הורדה על מכשיר:

1. **התקן את אפליקציית TestFlight** מה-App Store
2. **התחבר** עם אותו Apple ID שהוזמן
3. **הורד את DarkPool** דרך TestFlight

---

## שלב 4: שחרור ל-App Store

לאחר שבדקת ב-TestFlight והכל תקין:

### 1. מלא את פרטי האפליקציה:

כנס ל-App Store Connect → האפליקציה שלך → **"1.0 Prepare for Submission"**

**חובה למלא:**
- ✅ **App Description** (תיאור האפליקציה)
- ✅ **Keywords** (מילות מפתח)
- ✅ **Support URL** (קישור לתמיכה)
- ✅ **Marketing URL** (אופציונלי)
- ✅ **Privacy Policy URL** (חובה!)
- ✅ **Screenshots** (תמונות מסך - חובה!)
  - iPhone 6.7" Display (iPhone 14 Pro Max, iPhone 13 Pro Max)
  - iPhone 6.5" Display (iPhone 11 Pro Max, iPhone XS Max)
  - iPhone 5.5" Display (iPhone 8 Plus)
  - iPad Pro (12.9-inch)
  - iPad Pro (11-inch)
- ✅ **App Icon** (1024x1024)
- ✅ **Age Rating** (דירוג גיל)
- ✅ **App Review Information** (פרטי קשר לבדיקה)

### 2. שלח לבדיקה:

1. **לחץ "Add for Review"** או **"Submit for Review"**
2. **ענה על השאלות** (אם יש)
3. **שלח**

### 3. המתן לאישור:

- ⏱️ בדיקה של Apple לוקחת **1-3 ימים** (לפעמים יותר)
- 📧 תקבל אימייל כשהבדיקה מסתיימת
- ✅ אם אושר - האפליקציה תפורסם אוטומטית (או לפי התאריך שקבעת)

---

## טיפים חשובים:

### לפני העלאה:
- ✅ בדוק שהאפליקציה רצה ללא קריסות
- ✅ בדוק שכל התכונות עובדות
- ✅ ודא שיש Privacy Policy URL
- ✅ הכין screenshots בכל הגדלים הנדרשים

### Privacy Policy:
**חובה!** Apple לא יאשר אפליקציה בלי Privacy Policy.

אפשר ליצור בעמוד פשוט ב-Supabase או כל שירות אחר.

### Screenshots:
**חובה לכל הגדלי מסך!** אם אין לך, אפשר:
- להשתמש ב-Simulator של Xcode
- לצלם מסכים מהאפליקציה
- להשתמש בכלי כמו [App Store Screenshot Generator](https://www.appstorescreenshot.com/)

---

## פקודות מהירות:

```bash
# בנייה והעלאה ביחד
eas build --platform ios --profile production
eas submit --platform ios --profile production

# רק בנייה
eas build --platform ios --profile production

# רק העלאה (אם כבר יש build)
eas submit --platform ios --profile production
```

---

## בעיות נפוצות:

### "Missing Compliance"
אם Apple שואל על Export Compliance:
- בחר **"No"** (אם האפליקציה לא משתמשת בהצפנה)
- או **"Yes"** ואז תצטרך למלא טופס

### "Missing App Icon"
- ודא שיש לך אייקון 1024x1024 ב-`assets/icon.png`
- או הוסף ב-App Store Connect → App Information

### "Missing Screenshots"
- חובה לכל הגדלי מסך!
- אפשר להשתמש ב-Simulator

---

## קישורים שימושיים:

- **EAS Dashboard:** https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds
- **App Store Connect:** https://appstoreconnect.apple.com
- **TestFlight:** https://appstoreconnect.apple.com/apps/6755930835/testflight

---

**בהצלחה! 🚀**


