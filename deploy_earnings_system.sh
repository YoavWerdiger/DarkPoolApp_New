#!/bin/bash

# סקריפט פריסה מלא למערכת דיווחי תוצאות

echo ""
echo "📊 ================================================"
echo "   פריסת מערכת דיווחי תוצאות"
echo "   2 Edge Functions + 3 Cron Jobs"
echo "================================================"
echo ""

# צבעים
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ======================================
# שלב 1: פריסת Edge Functions
# ======================================

echo "🚀 שלב 1/2: פריסת Edge Functions"
echo ""

echo -e "${YELLOW}1.1 מפרוס earnings-daily-sync...${NC}"
npx supabase functions deploy earnings-daily-sync --no-verify-jwt

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ earnings-daily-sync נפרס בהצלחה${NC}"
else
  echo -e "${RED}❌ שגיאה בפריסת earnings-daily-sync${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}1.2 מפרוס earnings-results-update...${NC}"
npx supabase functions deploy earnings-results-update --no-verify-jwt

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ earnings-results-update נפרס בהצלחה${NC}"
else
  echo -e "${RED}❌ שגיאה בפריסת earnings-results-update${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ כל ה-Edge Functions נפרסו בהצלחה!${NC}"
echo ""

# ======================================
# שלב 2: הוראות הגדרת Cron
# ======================================

echo "⏰ שלב 2/2: הגדרת Cron Jobs"
echo ""
echo -e "${YELLOW}עכשיו צריך להגדיר את ה-Cron Jobs ידנית:${NC}"
echo ""
echo "1. עבור ל-Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/sql"
echo ""
echo "2. פתח את הקובץ: setup_earnings_cron.sql"
echo ""
echo "3. העתק את כל התוכן והדבק ב-SQL Editor"
echo ""
echo "4. הרץ את הקוד (Run)"
echo ""
echo -e "${GREEN}📋 מידע על ה-Cron Jobs:${NC}"
echo ""
echo "   ├─ earnings-daily-sync       → רץ כל יום ב-06:00 (ישראל)"
echo "   ├─ earnings-results-morning  → רץ כל יום ב-04:30 (ישראל)"
echo "   └─ earnings-results-evening  → רץ כל יום ב-23:00 (ישראל)"
echo ""

# ======================================
# שלב 3: בדיקה ראשונית
# ======================================

echo ""
echo -e "${YELLOW}🧪 רוצה לבדוק את הפונקציות עכשיו? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  echo ""
  echo "🔄 מריץ בדיקה ראשונית..."
  echo ""
  
  echo "1️⃣ בודק earnings-daily-sync..."
  curl -s -X POST \
    'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-sync' \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ" \
    -H "Content-Type: application/json" | jq
  
  echo ""
  echo "2️⃣ בודק earnings-results-update..."
  curl -s -X POST \
    'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update' \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ" \
    -H "Content-Type: application/json" | jq
  
  echo ""
  echo -e "${GREEN}✅ בדיקה הושלמה!${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}🎉 פריסה הושלמה בהצלחה!${NC}"
echo "================================================"
echo ""
echo "📚 קרא את המדריך המלא: EARNINGS_SETUP_GUIDE.md"
echo ""

