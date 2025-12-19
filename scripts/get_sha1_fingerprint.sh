#!/bin/bash

# סקריפט לקבלת SHA-1 Fingerprint עבור Google OAuth

echo "=========================================="
echo "קבלת SHA-1 Fingerprint עבור Google OAuth"
echo "=========================================="
echo ""

# פרטי האפליקציה
PACKAGE_NAME="com.darkpool.app"
DEBUG_KEYSTORE="./android/app/debug.keystore"

echo "📦 Package Name: $PACKAGE_NAME"
echo ""

# 1. SHA-1 עבור Development (Debug Keystore)
echo "1️⃣  SHA-1 עבור Development (Debug):"
echo "-----------------------------------"
if [ -f "$DEBUG_KEYSTORE" ]; then
    keytool -list -v -keystore "$DEBUG_KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep -A 5 "Certificate fingerprints" | grep "SHA1:" | head -1 | sed 's/.*SHA1: //' | tr -d '[:space:]'
    echo ""
    echo "✅ Debug SHA-1 נוסף בהצלחה!"
else
    echo "❌ לא נמצא debug.keystore ב-$DEBUG_KEYSTORE"
    echo "💡 אם אתה משתמש ב-Expo Go, השתמש בפקודה:"
    echo "   expo credentials:manager"
fi
echo ""

# 2. הוראות לקבלת SHA-1 עבור Production
echo "2️⃣  SHA-1 עבור Production:"
echo "-----------------------------------"
echo "אם אתה משתמש ב-EAS Build:"
echo "  1. עבור ל-EAS Dashboard: https://expo.dev/accounts/[your-account]/projects/[your-project]/credentials"
echo "  2. מצא את ה-Android Keystore שלך"
echo "  3. הורד את ה-keystore"
echo "  4. הרץ: keytool -list -v -keystore [keystore-file] -alias [alias-name]"
echo ""
echo "או השתמש בפקודה:"
echo "  eas credentials"
echo ""

# 3. הוראות ל-Google Cloud Console
echo "3️⃣  הוראות להוספה ב-Google Cloud Console:"
echo "-----------------------------------"
echo "📌 אפשר להתחיל עם Debug SHA-1 עכשיו ולהוסיף Production מאוחר יותר!"
echo ""
echo "שלב א' - יצירת OAuth Client ID עם Debug SHA-1:"
echo "1. עבור ל: https://console.cloud.google.com/apis/credentials"
echo "2. בחר את הפרויקט שלך (darkpool-77d19)"
echo "3. לחץ על 'Create Credentials' > 'OAuth client ID'"
echo "4. בחר Application type: 'Android'"
echo "5. מלא את הפרטים:"
echo "   - Name: DarkPool Android (Development)"
echo "   - Package name: $PACKAGE_NAME"
echo "   - SHA-1 certificate fingerprint: [הדבק את ה-Debug SHA-1 למעלה]"
echo "6. לחץ על 'Create'"
echo ""
echo "שלב ב' - הוספת Production SHA-1 מאוחר יותר:"
echo "1. לאחר שיהיה לך Production build, קבל את ה-SHA-1 (ראה שלב 2 למעלה)"
echo "2. עבור ל-OAuth Client ID שיצרת"
echo "3. לחץ על 'Edit'"
echo "4. הוסף את ה-Production SHA-1 לרשימת ה-SHA-1 fingerprints"
echo "   (אפשר להוסיף כמה SHA-1 - אחד ל-Debug ואחד ל-Production)"
echo "5. שמור את השינויים"
echo ""
echo "💡 טיפ: אתה יכול להוסיף גם את ה-Production SHA-1 כבר עכשיו אם יש לך"
echo "   keystore קיים, או לחכות עד שיהיה לך build ראשון של Production."
echo ""

# 4. קבלת SHA-1 דרך ADB (אם יש מכשיר מחובר)
echo "4️⃣  קבלת SHA-1 מהמכשיר (אם יש APK מותקן):"
echo "-----------------------------------"
echo "אם יש לך APK מותקן על מכשיר, אתה יכול להריץ:"
echo "  adb shell dumpsys package $PACKAGE_NAME | grep -A 5 'signatures'"
echo ""

echo "=========================================="
echo "✅ סיום"
echo "=========================================="

