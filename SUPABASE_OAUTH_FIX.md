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

או URL אחר שלך (אבל **לא** localhost).

### 4. בדוק את ה-Google OAuth Provider

ב-Supabase Dashboard → **Authentication** → **Providers** → **Google**:

- ✅ **Enable Google provider** - חייב להיות מופעל
- ✅ **Client ID** - מה-`google-oauth-credentials.json`
- ✅ **Client Secret** - מה-`google-oauth-credentials.json`

### 5. בדוק ב-Google Cloud Console

ב-Google Cloud Console → **APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**:

הוסף ל-**Authorized redirect URIs**:
```
https://wpmrtczbfcijoocguime.supabase.co/auth/v1/callback
```

**זה ה-URI ש-Google מחזיר ל-Supabase!**

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

## 🎯 אחרי התיקון:

אמור לעבוד! אם עדיין יש בעיות - שלח את הלוגים מהטרמינל. 🐛
