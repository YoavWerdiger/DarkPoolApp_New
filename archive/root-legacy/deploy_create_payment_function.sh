#!/bin/bash

# סקריפט לפריסת Edge Function ליצירת תשלום
# מטרה: פתרון שגיאת RLS בטבלת payment_transactions

echo "🚀 מתחיל בפריסת Edge Function: create-payment"
echo "=================================================="

# בדיקה אם Supabase CLI מותקן
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI לא מותקן"
    echo "התקן באמצעות: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI מותקן"

# בדיקה אם המשתמש מחובר
if ! supabase projects list &> /dev/null; then
    echo "❌ לא מחובר ל-Supabase"
    echo "התחבר באמצעות: supabase login"
    exit 1
fi

echo "✅ מחובר ל-Supabase"

# פריסת ה-Function
echo ""
echo "📦 פורס את create-payment function..."
supabase functions deploy create-payment --project-ref wpmrtczbfcijoocguime

# בדיקת הצלחת הפריסה
if [ $? -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✅ Edge Function נפרס בהצלחה!"
    echo ""
    echo "🔗 URL של ה-Function:"
    echo "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/create-payment"
    echo ""
    echo "📝 הקוד ב-paymentService.ts כבר עודכן להשתמש ב-function החדש"
    echo ""
    echo "🧪 כעת נסה ליצור תשלום באפליקציה ובדוק שהשגיאה נפתרה"
    echo "=================================================="
else
    echo ""
    echo "❌ הפריסה נכשלה"
    echo "בדוק את השגיאות למעלה ונסה שוב"
    exit 1
fi

