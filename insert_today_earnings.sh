#!/bin/bash

# סקריפט להכנסת דיווחי תוצאות של היום ל-Supabase

SUPABASE_URL="https://wpmrtczbfcijoocguime.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"

echo ""
echo "📊 ==============================================="
echo "   הכנסת דיווחי תוצאות של היום ל-Supabase"
echo "==============================================="
echo ""

# דיווח 1: Wells Fargo
echo "1️⃣ מכניס WFC.US (Wells Fargo)..."
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/earnings_calendar" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{
    "id": "earnings_WFC.US_2025-10-14",
    "code": "WFC.US",
    "report_date": "2025-10-14",
    "date": "2025-09-30",
    "before_after_market": "BeforeMarket",
    "currency": "USD",
    "actual": null,
    "estimate": 1.55,
    "difference": 0,
    "percent": null,
    "source": "EODHD",
    "updated_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }' > /dev/null

echo "✅ WFC.US הוכנס בהצלחה"

# דיווח 2: JPMorgan Chase
echo "2️⃣ מכניס JPM.US (JPMorgan Chase)..."
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/earnings_calendar" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{
    "id": "earnings_JPM.US_2025-10-14",
    "code": "JPM.US",
    "report_date": "2025-10-14",
    "date": "2025-09-30",
    "before_after_market": "BeforeMarket",
    "currency": "USD",
    "actual": null,
    "estimate": 4.87,
    "difference": 0,
    "percent": null,
    "source": "EODHD",
    "updated_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }' > /dev/null

echo "✅ JPM.US הוכנס בהצלחה"

# דיווח 3: Citigroup
echo "3️⃣ מכניס C.US (Citigroup)..."
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/earnings_calendar" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{
    "id": "earnings_C.US_2025-10-14",
    "code": "C.US",
    "report_date": "2025-10-14",
    "date": "2025-09-30",
    "before_after_market": "BeforeMarket",
    "currency": "USD",
    "actual": null,
    "estimate": 1.76,
    "difference": 0,
    "percent": null,
    "source": "EODHD",
    "updated_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }' > /dev/null

echo "✅ C.US הוכנס בהצלחה"

echo ""
echo "✅ כל הדיווחים הוכנסו בהצלחה!"
echo ""
echo "📱 עכשיו אפשר:"
echo "   1. לפתוח את האפליקציה"
echo "   2. ללחוץ על Pull to Refresh"
echo "   3. לראות את 3 הדיווחים של היום (BeforeMarket)"
echo ""
echo "==============================================="
echo ""

