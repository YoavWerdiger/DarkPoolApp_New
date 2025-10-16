#!/bin/bash

# בדיקה של דיווחים AfterMarket ב-API

API_KEY="68e3c3af900997.85677801"

echo ""
echo "🔍 בדיקת דיווחים AfterMarket ב-EODHD API"
echo "================================================"
echo ""

# בדיקה 1: AAPL - בדרך כלל מדווחת AfterMarket
echo "📊 AAPL (בדרך כלל AfterMarket):"
echo "------------------------------------"
curl -s "https://eodhd.com/api/calendar/earnings?symbols=AAPL.US&from=2025-10-01&to=2025-11-30&api_token=${API_KEY}&fmt=json" | jq '.earnings[] | {code, report_date, before_after_market, estimate}'
echo ""

# בדיקה 2: MSFT - בדרך כלל מדווחת AfterMarket
echo "📊 MSFT (בדרך כלל AfterMarket):"
echo "------------------------------------"
curl -s "https://eodhd.com/api/calendar/earnings?symbols=MSFT.US&from=2025-10-01&to=2025-11-30&api_token=${API_KEY}&fmt=json" | jq '.earnings[] | {code, report_date, before_after_market, estimate}'
echo ""

# בדיקה 3: GOOGL - בדרך כלל מדווחת AfterMarket
echo "📊 GOOGL (בדרך כלל AfterMarket):"
echo "------------------------------------"
curl -s "https://eodhd.com/api/calendar/earnings?symbols=GOOGL.US&from=2025-10-01&to=2025-11-30&api_token=${API_KEY}&fmt=json" | jq '.earnings[] | {code, report_date, before_after_market, estimate}'
echo ""

# בדיקה 4: ספירה כללית של BeforeMarket vs AfterMarket
echo "📊 סיכום כללי (10 מניות ראשונות):"
echo "------------------------------------"
curl -s "https://eodhd.com/api/calendar/earnings?symbols=AAPL.US,MSFT.US,GOOGL.US,AMZN.US,NVDA.US,META.US,TSLA.US,JPM.US,JNJ.US,V.US&from=2025-10-08&to=2025-11-30&api_token=${API_KEY}&fmt=json" | jq '[.earnings[] | {code, report_date, before_after_market}] | group_by(.before_after_market) | map({timing: .[0].before_after_market, count: length})'
echo ""

echo "================================================"
echo "✅ בדיקה הושלמה"
echo ""

