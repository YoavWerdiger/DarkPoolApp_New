#!/bin/bash

# סקריפט לפריסת Edge Function לבדיקת תוצאות כלכליות של היום
# פונקציה: check-today-economic-results

echo "🚀 מתחיל בפריסת Edge Function: check-today-economic-results"
echo "=================================================="

# בדיקה אם Supabase CLI מותקן
if ! command -v supabase &> /dev/null; then
    echo "📦 מותקן Supabase CLI..."
    npm install -g supabase
fi

echo "✅ Supabase CLI מותקן"

# בדיקה אם המשתמש מחובר
echo ""
echo "🔐 בדיקת התחברות..."
if ! npx supabase projects list &> /dev/null; then
    echo "⚠️  לא מחובר ל-Supabase"
    echo "🔑 מתחבר..."
    npx supabase login
else
    echo "✅ מחובר ל-Supabase"
fi

# קישור לפרויקט (אם צריך)
echo ""
echo "🔗 בודק קישור לפרויקט..."
if ! npx supabase link --project-ref wpmrtczbfcijoocguime 2>/dev/null; then
    echo "⚠️  הפרויקט כבר מקושר או צריך קישור ידני"
fi

# פריסת ה-Function
echo ""
echo "📦 פורס את check-today-economic-results function..."
npx supabase functions deploy check-today-economic-results --project-ref wpmrtczbfcijoocguime

# בדיקת הצלחת הפריסה
if [ $? -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✅ Edge Function נפרס בהצלחה!"
    echo ""
    echo "📝 מה הפונקציה עושה:"
    echo "   - בודקת רק אירועים של היום"
    echo "   - משתמשת באותן פונקציות parseEventDateTime כמו daily-economic-sync-simple"
    echo "   - עדכון תוצאות (actual values) בלייב"
    echo "   - שליחת Push Notifications לאירועים חשובים"
    echo ""
    echo "⏰ כדי להגדיר Cron Job (כל 15 דקות):"
    echo "   1. פתח Supabase SQL Editor"
    echo "   2. הרץ את הקובץ: setup_check_today_cron.sql"
    echo ""
    echo "🧪 הפונקציה תרוץ אוטומטית כל 15 דקות (אחרי הגדרת Cron)"
    echo "=================================================="
else
    echo ""
    echo "❌ הפריסה נכשלה"
    echo "בדוק את השגיאות למעלה ונסה שוב"
    exit 1
fi


