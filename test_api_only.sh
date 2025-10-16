#!/bin/bash

echo "🧪 בדיקת EODHD API בלבד"
echo "========================"

SUPABASE_URL="https://wpmrtczbfcijoocguime.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjE4MjAsImV4cCI6MjA1MDA5NzgyMH0.JQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJ"

echo ""
echo "📊 בדיקת EODHD API..."
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/daily-earnings-sync-test" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json")
echo "$RESPONSE"

echo ""
echo "✅ בדיקה הושלמה!"
