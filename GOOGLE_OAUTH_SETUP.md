# 🔐 הגדרת Google OAuth - מדריך

## ✅ מה תוקן:

1. **Redirect URI Validation** - בדיקה שה-redirect URI תקין
2. **Deep Linking** - תמיכה ב-`exp://` ו-`com.darkpool.app://`
3. **WebBrowser Options** - הגדרות נכונות ל-`openAuthSessionAsync`

## 📋 מה צריך לבדוק ב-Supabase:

### 1. Site URL
ב-Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://wpmrtczbfcijoocguime.supabase.co` (או URL אחר שלך)
- **לא** `localhost` או `127.0.0.1`!

### 2. Redirect URLs
ב-Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
הוסף את כל ה-URLs הבאים:
```
exp://192.168.*.*:*/--/oauth
exp://localhost:*/--/oauth
com.darkpool.app://oauth
```

**או** (אם אתה יודע את ה-IP המדויק):
```
exp://192.168.1.192:8083/--/oauth
com.darkpool.app://oauth
```

### 3. Google OAuth Provider
ב-Supabase Dashboard → Authentication → Providers → Google:
- ✅ Enable Google provider
- ✅ Client ID: (מה-google-oauth-credentials.json)
- ✅ Client Secret: (מה-google-oauth-credentials.json)

## 🧪 איך לבדוק:

1. **הרץ את האפליקציה**
2. **לחץ על "התחבר עם Google"**
3. **בחר חשבון Google**
4. **אמור לחזור לאפליקציה אוטומטית**

## ⚠️ בעיות נפוצות:

### בעיה: "localhost" redirect
**פתרון**: 
- בדוק שה-Site URL ב-Supabase **לא** `localhost`
- הוסף את ה-redirect URI הנכון ל-Redirect URLs

### בעיה: "ההתחברות בוטלה"
**פתרון**:
- בדוק שה-Google Client ID ו-Secret נכונים
- בדוק שה-Redirect URLs ב-Supabase כוללים את ה-URI הנכון

### בעיה: לא חוזר לאפליקציה
**פתרון**:
- בדוק שה-deep linking מוגדר נכון ב-`app.json`
- ב-Android: בדוק `AndroidManifest.xml`
- ב-iOS: בדוק `Info.plist`

## 🔍 Debug:

בטרמינל תראה:
```
🔄 AuthService: Redirect URI: exp://192.168.1.192:8083/--/oauth
✅ AuthService: Opening OAuth URL in browser...
🔄 AuthService: OAuth result: { type: 'success', hasUrl: true }
✅ AppContent: Handling OAuth redirect: exp://192.168.1.192:8083/--/oauth#access_token=...
✅ AppContent: Session set successfully
```

אם אתה רואה שגיאות - שלח את הלוגים! 🐛
