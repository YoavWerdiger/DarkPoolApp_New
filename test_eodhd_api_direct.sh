#!/bin/bash

# בדיקה ישירה של EODHD API - מה הנתונים האמיתיים?

API_KEY="<EODHD_API_KEY>"

echo ""
echo "🔍 בדיקה ישירה של EODHD API"
echo "======================================"
echo ""

# בדיקה 1: MMC - מה הנתונים האמיתיים?
echo "📊 דוגמה 1: MMC (Marsh & McLennan)"
echo "------------------------------------"
curl -s "https://eodhd.com/api/calendar/earnings?symbols=MMC.US&from=2025-10-01&to=2025-10-31&api_token=${API_KEY}&fmt=json" | jq '.earnings[] | {code, report_date, date, actual, estimate, difference, percent, before_after_market}'
echo ""

# בדיקה 2: AAPL - דוגמה נוספת
echo "📊 דוגמה 2: AAPL (Apple)"
echo "------------------------------------"
curl -s "https://eodhd.com/api/calendar/earnings?symbols=AAPL.US&from=2025-10-01&to=2025-11-30&api_token=${API_KEY}&fmt=json" | jq '.earnings[] | {code, report_date, date, actual, estimate, difference, percent, before_after_market}'
echo ""

# בדיקה 3: כמה דיווחים יש בטווח שלנו?
echo "📊 בדיקה 3: כמה דיווחים יש בטווח 08/10/2025 - 03/10/2026?"
echo "------------------------------------"
echo "שולף דוגמה של 5 מניות ראשונות..."
curl -s "https://eodhd.com/api/calendar/earnings?symbols=AAPL.US,MSFT.US,GOOGL.US,AMZN.US,NVDA.US&from=2025-10-08&to=2026-10-03&api_token=${API_KEY}&fmt=json" | jq '{type, from, to, total_earnings: (.earnings | length), sample: .earnings[0:3]}'
echo ""

echo "======================================"
echo "✅ בדיקה הושלמה"
echo ""

