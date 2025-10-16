#!/bin/bash

# סקריפט לסנכרון דיווחי תוצאות של היום בלבד

SUPABASE_URL="https://wpmrtczbfcijoocguime.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"
EODHD_API_KEY="68e3c3af900997.85677801"

# התאריך של היום
TODAY=$(date +%Y-%m-%d)

echo ""
echo "📊 ==============================================="
echo "   סנכרון דיווחי תוצאות של היום"
echo "   תאריך: $TODAY"
echo "==============================================="
echo ""

# רשימת מניות עיקריות
SYMBOLS="AAPL.US,MSFT.US,GOOGL.US,AMZN.US,NVDA.US,META.US,TSLA.US,JPM.US,V.US,UNH.US,PG.US,XOM.US,HD.US,MA.US,LLY.US,CVX.US,MRK.US,BAC.US,KO.US,PEP.US,PFE.US,WMT.US,COST.US,ABBV.US,AVGO.US,CMCSA.US,ADBE.US,CRM.US,CSCO.US,DIS.US,DHR.US,TMO.US,NKE.US,ORCL.US,QCOM.US,SBUX.US,TXN.US,VZ.US,WFC.US,ACN.US,AMD.US,AMGN.US,BA.US,BMY.US,C.US,CAT.US,MMC.US,NFLX.US,PYPL.US"

echo "🔄 שולף נתונים מ-EODHD API..."
echo ""

# קריאה ל-API
API_URL="https://eodhd.com/api/calendar/earnings?symbols=${SYMBOLS}&from=${TODAY}&to=${TODAY}&api_token=${EODHD_API_KEY}&fmt=json"

RESPONSE=$(curl -s "$API_URL")

# שמירה לקובץ זמני
echo "$RESPONSE" > /tmp/earnings_today.json

# ספירת כמה דיווחים יש
COUNT=$(echo "$RESPONSE" | jq '.earnings | length' 2>/dev/null || echo "0")

echo "📈 נמצאו $COUNT דיווחי תוצאות להיום"
echo ""

if [ "$COUNT" -gt 0 ]; then
  echo "📋 דיווחי התוצאות:"
  echo "$RESPONSE" | jq -r '.earnings[] | "\(.code) - \(.report_date) - \(.before_after_market // "N/A")"' 2>/dev/null
  echo ""
  
  echo "✅ הנתונים נשמרו ב-/tmp/earnings_today.json"
  echo ""
  echo "📱 עכשיו תצטרך להכניס את הנתונים האלה ל-Supabase."
  echo "   אפשר לעשות זאת דרך Supabase Dashboard → Table Editor"
else
  echo "⚠️ לא נמצאו דיווחי תוצאות להיום"
fi

echo ""
echo "==============================================="
echo ""

