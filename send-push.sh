#!/bin/bash

# ✅ שליחת Push Notification דרך Supabase Edge Function
# ========================================================
# User ID: af781bb1-0529-4d80-9424-6564ec29457e

SUPABASE_URL="https://wpmrtczbfcijoocguime.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A"
USER_ID="af781bb1-0529-4d80-9424-6564ec29457e"

echo "📱 שולח push notification למשתמש: $USER_ID"

curl -X POST "${SUPABASE_URL}/functions/v1/send-push-notification" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d "{
    \"userIds\": [\"${USER_ID}\"],
    \"title\": \"בדיקת Push Notification 📱\",
    \"body\": \"זוהי התראה לבדיקה - אם אתה רואה את זה, זה עובד!\",
    \"data\": {
      \"type\": \"test\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    },
    \"sound\": \"default\",
    \"priority\": \"high\"
  }"

echo ""
echo "✅ בקשת שליחה נשלחה!"


