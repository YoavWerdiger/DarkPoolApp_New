#!/bin/bash

# 🚀 סקריפט פריסה של Benzinga API Integration
# מעדכן את כל ה-Edge Functions הנדרשים

set -e  # יציאה במקרה של שגיאה

echo "🚀 מתחיל פריסת Benzinga API Integration..."
echo ""

# בדיקה שמחוברים ל-Supabase
echo "📡 בודק חיבור ל-Supabase..."
if ! supabase projects list > /dev/null 2>&1; then
    echo "❌ שגיאה: לא מחובר ל-Supabase"
    echo "   הרץ: supabase login"
    exit 1
fi
echo "✅ מחובר ל-Supabase"
echo ""

# הגדרת API Key
echo "🔑 מגדיר משתנה סביבה..."
supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC
echo "✅ API Key הוגדר"
echo ""

# פריסת Edge Functions
echo "📦 מפרוס Edge Functions..."
echo ""

# 1. Earnings Sync (כבר משתמש ב-Benzinga)
echo "1️⃣  מפרוס daily-earnings-sync-simple..."
supabase functions deploy daily-earnings-sync-simple
echo "✅ daily-earnings-sync-simple נפרס בהצלחה"
echo ""

# 2. Benzinga Economics Sync (חדש)
echo "2️⃣  מפרוס benzinga-economics-sync..."
supabase functions deploy benzinga-economics-sync
echo "✅ benzinga-economics-sync נפרס בהצלחה"
echo ""

# 3. Economic Scheduler (מעודכן)
echo "3️⃣  מפרוס economic-scheduler..."
supabase functions deploy economic-scheduler
echo "✅ economic-scheduler נפרס בהצלחה"
echo ""

echo "✅ כל ה-Edge Functions נפרסו בהצלחה!"
echo ""
echo "📋 השלבים הבאים:"
echo "   1. הגדר Cron Jobs (ראה BENZINGA_SETUP_GUIDE.md)"
echo "   2. בדוק את הלוגים: supabase functions logs [function-name]"
echo "   3. בצע בדיקה ידנית של הפונקציות"
echo ""
echo "🎉 פריסה הושלמה!"









