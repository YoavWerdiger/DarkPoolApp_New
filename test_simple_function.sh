#!/bin/bash
echo "🧪 Testing daily-economic-sync-simple..."
curl -X POST \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync-simple"
echo ""
