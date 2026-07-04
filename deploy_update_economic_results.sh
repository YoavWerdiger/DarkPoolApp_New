#!/bin/bash

# סקריפט לפריסת Edge Function לעדכון תוצאות כלכליות
# פונקציה: update-economic-results

echo "🚀 מתחיל בפריסת Edge Function: update-economic-results"
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
echo "📦 פורס את update-economic-results function..."
npx supabase functions deploy update-economic-results --project-ref wpmrtczbfcijoocguime

# בדיקת הצלחת הפריסה
if [ $? -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✅ Edge Function נפרס בהצלחה!"
    echo ""
    echo "📝 מה תוקן:"
    echo "   - יצירת ID זהה לפונקציה daily-economic-sync-simple"
    echo "   - שימוש באותן פונקציות: parseEventDateTime, adjustDateForEarlyEvents"
    echo "   - כעת האירועים יימצאו ויעודכנו במקום לדלג"
    echo ""
    echo "🧪 הפונקציה תרוץ אוטומטית כל 15 דקות (אם ה-Cron מוגדר)"
    echo "=================================================="
else
    echo ""
    echo "❌ הפריסה נכשלה"
    echo "בדוק את השגיאות למעלה ונסה שוב"
    exit 1
fi


