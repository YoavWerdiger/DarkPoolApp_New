#!/bin/bash

echo "🚀 בדיקת מערכת דיווחי התוצאות בלבד"
echo "===================================="

# הגדרות
SUPABASE_URL="https://wpmrtczbfcijoocguime.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjE4MjAsImV4cCI6MjA1MDA5NzgyMH0.JQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJ"

echo ""
echo "📊 בדיקת דיווחי תוצאות..."
curl -s -X POST "$SUPABASE_URL/functions/v1/daily-earnings-sync-v2" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✅ בדיקה הושלמה!"
echo ""
echo "📱 עכשיו פתח את האפליקציה ולך לטאב 'דיווחי תוצאות'"
echo "🎯 אמור לראות ממשק חדש עם דיווחי תוצאות אמיתיים!"
