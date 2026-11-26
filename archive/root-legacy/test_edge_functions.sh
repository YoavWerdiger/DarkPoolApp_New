#!/bin/bash

# סקריפט לבדיקת Edge Functions
# הרץ: bash test_edge_functions.sh

PROJECT_ID="wpmrtczbfcijoocguime"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1"

echo "🧪 Testing Edge Functions..."
echo ""

# Test 1: Daily Economic Sync
echo "📊 Testing daily-economic-sync..."
curl -X POST \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${BASE_URL}/daily-economic-sync"
echo ""
echo ""

# Test 2: Daily Earnings Sync
echo "📈 Testing daily-earnings-sync..."
curl -X POST \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${BASE_URL}/daily-earnings-sync"
echo ""
echo ""

# Test 3: Smart Economic Poller
echo "🔍 Testing smart-economic-poller..."
curl -X POST \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${BASE_URL}/smart-economic-poller"
echo ""
echo ""

echo "✅ All tests completed!"
echo ""
echo "💡 עכשיו לך ל-Supabase → Table Editor → economic_events/earnings_events"
echo "   ובדוק שיש נתונים!"

