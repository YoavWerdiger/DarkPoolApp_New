#!/bin/bash

# סקריפט לסנכרון חד פעמי של דיווחי תוצאות מ-3 חודשים אחורה

SUPABASE_URL="https://wpmrtczbfcijoocguime.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjE4MjAsImV4cCI6MjA1MDA5NzgyMH0.JQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJ"

echo ""
echo "📊 ==============================================="
echo "   סנכרון דיווחי תוצאות"
echo "   טווח: 08/10/2025 - 03/10/2026 (כמעט שנה)"
echo "==============================================="
echo ""

echo "🔄 שולח קריאה ל-Edge Function..."
echo ""

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/daily-earnings-sync-major-indices" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

# הפרדת התשובה לגוף וסטטוס
HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "📡 סטטוס: $HTTP_STATUS"
echo ""
echo "📋 תשובה מהשרת:"
echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
echo ""

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ הסנכרון הושלם בהצלחה!"
  echo ""
  echo "📱 עכשיו אפשר לפתוח את האפליקציה ולראות:"
  echo "   • דיווחים מ-3 חודשים אחורה"
  echo "   • דיווחים של היום"
  echo "   • דיווחים עתידיים"
  echo ""
else
  echo "❌ שגיאה בסנכרון (קוד $HTTP_STATUS)"
  echo ""
  echo "💡 טיפים לפתרון בעיות:"
  echo "   1. בדוק שה-Edge Function פרוס ב-Supabase"
  echo "   2. בדוק שמפתח ה-EODHD_API_KEY מוגדר ב-Environment Variables"
  echo "   3. בדוק את הלוגים ב-Supabase Dashboard"
  echo ""
fi

echo "==============================================="
echo ""

