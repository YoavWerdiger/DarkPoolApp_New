# 🔤 מדריך התקנת פונט Assistant ExtraBold

## שלב 1: הורדת קבצי הפונט

1. **הורד את הפונט Assistant ExtraBold:**
   - עבור לאתר: https://fonts.google.com/specimen/Assistant
   - לחץ על "Download family"
   - חלץ את הקבצים

2. **קבצים נדרשים:**
   - `Assistant-ExtraBold.ttf`
   - `Assistant-Regular.ttf` (כגיבוי)

## שלב 2: העברת קבצי הפונט

1. **העתק את קבצי הפונט לתיקיית האפליקציה:**
   ```bash
   cp Assistant-ExtraBold.ttf /Users/yoavwerdiger/DarkPoolApp_New/DarkPoolApp_New/assets/fonts/
   cp Assistant-Regular.ttf /Users/yoavwerdiger/DarkPoolApp_New/DarkPoolApp_New/assets/fonts/
   ```

2. **ודא שהקבצים קיימים:**
   ```bash
   ls -la /Users/yoavwerdiger/DarkPoolApp_New/DarkPoolApp_New/assets/fonts/
   ```

## שלב 3: שימוש בפונט

### שימוש עם DesignTokens:
```javascript
import { DesignTokens } from '../components/ui/DesignTokens';

// שימוש בפונט Assistant ExtraBold
<Text style={{ 
  fontFamily: DesignTokens.typography.fontFamily.assistant,
  fontWeight: DesignTokens.typography.fontWeight.extrabold,
  fontSize: DesignTokens.typography.fontSize.xl
}}>
  טקסט בפונט Assistant ExtraBold
</Text>
```

### שימוש עם Tailwind CSS:
```javascript
<Text className="font-assistant text-xl font-extrabold">
  טקסט בפונט Assistant ExtraBold
</Text>
```

### שימוש ישיר:
```javascript
<Text style={{ 
  fontFamily: 'Assistant-ExtraBold',
  fontSize: 18,
  fontWeight: '800'
}}>
  טקסט בפונט Assistant ExtraBold
</Text>
```

## שלב 4: הפעלה מחדש

1. **הפעל מחדש את האפליקציה:**
   ```bash
   npm start
   ```

2. **נקה את הקאש (אם נדרש):**
   ```bash
   npx expo start --clear
   ```

## בדיקה

לאחר ההתקנה, הפונט יהיה זמין בשם:
- `Assistant-ExtraBold` (שימוש ישיר)
- `DesignTokens.typography.fontFamily.assistant` (דרך DesignTokens)
- `font-assistant` (דרך Tailwind CSS)

## הערות חשובות

- הפונט יתמוך בטקסט עברי ובאנגלית
- הקבצים יארזו אוטומטית עם האפליקציה
- הפונט יהיה זמין גם ב-iOS וגם ב-Android
- אם הפונט לא נטען, המערכת תחזור לפונט ברירת המחדל



