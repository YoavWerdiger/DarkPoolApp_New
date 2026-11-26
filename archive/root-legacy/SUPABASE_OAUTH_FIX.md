# 🔧 תיקון שגיאת "requested path is invalid" ב-Google OAuth

## ❌ הבעיה:
Supabase מחזיר שגיאה: `{"error":"requested path is invalid"}`

זה אומר שה-redirect URI שהאפליקציה שולחת **לא תואם** למה שמוגדר ב-Supabase Dashboard.

## ✅ הפתרון:

### 1. בדוק את ה-Redirect URI שהאפליקציה שולחת
בטרמינל תראה:
```
🔄 AuthService: Redirect URI: exp://192.168.1.192:8083/--/oauth
```

**העתק את ה-URI הזה בדיוק!**

### 2. הוסף ל-Supabase Dashboard

ב-Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs**:

הוסף את ה-URI **בדיוק** כמו שהוא מופיע בטרמינל:
```
exp://192.168.1.192:8083/--/oauth
```

**או** (אם אתה רוצה תמיכה בכל ה-IPs):
```
exp://192.168.*.*:*/--/oauth
```

**וגם**:
```
com.darkpool.app://oauth
```

### 3. בדוק את ה-Site URL

ב-Supabase Dashboard → **Authentication** → **URL Configuration** → **Site URL**:

**לא** `localhost` או `127.0.0.1`!

צריך להיות:
```
https://wpmrtczbfcijoocguime.supabase.co
```

**⚠️ חשוב:** זה ה-URL שלך! לא `localhost` או `127.0.0.1`!

### 4. בדוק את ה-Google OAuth Provider

ב-Supabase Dashboard → **Authentication** → **Providers** → **Google**:

- ✅ **Enable Google provider** - חייב להיות מופעל
- ✅ **Client ID** - **חייב להיות Web Client ID!** 
  - ✅ נכון: `<WEB_CLIENT_ID>.apps.googleusercontent.com` (Web) — הערך מה־Google Cloud Console
  - ❌ לא נכון: `<IOS_CLIENT_ID>.apps.googleusercontent.com` (iOS)
- ✅ **Client Secret** - מה-`google-oauth-credentials.json` (Web Client Secret)

**⚠️ למה iOS Client ID לא עובד?**
- הקוד משתמש ב-`supabase.auth.signInWithOAuth()` - זה אומר ש-Supabase מטפל ב-OAuth
- Supabase OAuth **דורש Web Client ID**, לא iOS Client ID
- iOS Client ID עובד רק אם משתמשים ב-Google Sign-In SDK ישירות (לא דרך Supabase)

### 5. בדוק ב-Google Cloud Console

ב-Google Cloud Console → **APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**:

**עבור ל-Web Client ID** (`<WEB_CLIENT_ID>`):

הוסף ל-**Authorized redirect URIs**:
```
https://wpmrtczbfcijoocguime.supabase.co/auth/v1/callback
```

**זה ה-URI ש-Google מחזיר ל-Supabase!**

**⚠️ חשוב:** 
- זה חייב להיות בדיוק ה-URL הזה
- בלי `/` בסוף
- עם `https://` בהתחלה

**⚠️ חשוב:** ה-iOS Client ID (`<IOS_CLIENT_ID>`) לא צריך redirect URIs כי הוא לא משמש כאן!

## 🔍 איך לבדוק:

1. **הרץ את האפליקציה**
2. **לחץ על "התחבר עם Google"**
3. **בטרמינל - העתק את ה-Redirect URI**
4. **הוסף אותו ל-Supabase Dashboard**
5. **נסה שוב**

## ⚠️ חשוב:

- ה-Redirect URI **חייב להיות זהה** בדיוק!
- אם ה-IP משתנה (Expo Go), תצטרך להוסיף את ה-URI החדש
- או להשתמש ב-wildcard: `exp://192.168.*.*:*/--/oauth`

## 📝 מה להזין ב-Supabase Dashboard:

### ב-Supabase Dashboard → Authentication → Providers → Google:

**Client ID:**
```
<WEB_CLIENT_ID>.apps.googleusercontent.com
```

**Client Secret:**
```
<GOOGLE_OAUTH_CLIENT_SECRET>
```

**⚠️ חשוב:** 
- ודא שה-Google OAuth Provider מופעל (Enable = ON)
- אחרי שמירת השינויים, נסה להתחבר שוב

## 🎯 אחרי התיקון:

אמור לעבוד! אם עדיין יש בעיות - שלח את הלוגים מהטרמינל. 🐛


