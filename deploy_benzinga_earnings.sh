#!/bin/bash

# סקריפט פריסה מלא למעבר ל-Benziga API
# מעדכן את כל ה-edge functions לשימוש ב-Benziga במקום EODHD

echo ""
echo "📊 ================================================"
echo "   פריסת מערכת Earnings עם Benzinga API"
echo "   4 Edge Functions - מעבר מ-EODHD ל-Benziga"
echo "================================================"
echo ""

# צבעים
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project ID
PROJECT_REF="wpmrtczbfcijoocguime"

# ======================================
# בדיקות ראשוניות
# ======================================

echo -e "${BLUE}🔍 בדיקת דרישות קדם...${NC}"

# בדיקה אם Supabase CLI מותקן
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ Supabase CLI לא מותקן${NC}"
  echo "התקן באמצעות: npm install -g supabase"
  exit 1
fi

echo -e "${GREEN}✅ Supabase CLI זמין${NC}"

# בדיקת התחברות
echo ""
echo -e "${BLUE}🔐 בודק התחברות ל-Supabase...${NC}"
if ! npx supabase projects list &> /dev/null; then
  echo -e "${YELLOW}⚠️  לא מחובר ל-Supabase${NC}"
  echo "מתחבר..."
  npx supabase login
fi

echo -e "${GREEN}✅ מחובר ל-Supabase${NC}"

# קישור לפרויקט
echo ""
echo -e "${BLUE}🔗 בודק קישור לפרויקט...${NC}"
npx supabase link --project-ref $PROJECT_REF 2>/dev/null || echo -e "${YELLOW}⚠️  הפרויקט כבר מקושר${NC}"

echo ""
echo -e "${BLUE}📋 פונקציות לפריסה:${NC}"
echo "   1. earnings-daily-update (עודכן לשימוש ב-Benziga)"
echo "   2. earnings-results-update (עודכן לשימוש ב-Benziga)"
echo "   3. daily-earnings-sync-simple (עודכן לשימוש ב-Benziga)"
echo "   4. benzinga-websocket-stream (חדש - WebSocket stream)"
echo ""

read -p "המשך לפריסה? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}בוטל${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}================================================${NC}"
echo -e "${YELLOW}🚀 מתחיל בפריסה...${NC}"
echo -e "${YELLOW}================================================${NC}"
echo ""

# ======================================
# פריסת הפונקציות
# ======================================

# 1. earnings-daily-update
echo -e "${YELLOW}1/4 מפרוס earnings-daily-update...${NC}"
if npx supabase functions deploy earnings-daily-update --project-ref $PROJECT_REF; then
  echo -e "${GREEN}✅ earnings-daily-update נפרס בהצלחה${NC}"
else
  echo -e "${RED}❌ שגיאה בפריסת earnings-daily-update${NC}"
  exit 1
fi

echo ""

# 2. earnings-results-update
echo -e "${YELLOW}2/4 מפרוס earnings-results-update...${NC}"
if npx supabase functions deploy earnings-results-update --project-ref $PROJECT_REF; then
  echo -e "${GREEN}✅ earnings-results-update נפרס בהצלחה${NC}"
else
  echo -e "${RED}❌ שגיאה בפריסת earnings-results-update${NC}"
  exit 1
fi

echo ""

# 3. daily-earnings-sync-simple
echo -e "${YELLOW}3/4 מפרוס daily-earnings-sync-simple...${NC}"
if npx supabase functions deploy daily-earnings-sync-simple --project-ref $PROJECT_REF; then
  echo -e "${GREEN}✅ daily-earnings-sync-simple נפרס בהצלחה${NC}"
else
  echo -e "${RED}❌ שגיאה בפריסת daily-earnings-sync-simple${NC}"
  exit 1
fi

echo ""

# 4. benzinga-websocket-stream (חדש)
echo -e "${YELLOW}4/4 מפרוס benzinga-websocket-stream (חדש)...${NC}"
if npx supabase functions deploy benzinga-websocket-stream --project-ref $PROJECT_REF; then
  echo -e "${GREEN}✅ benzinga-websocket-stream נפרס בהצלחה${NC}"
else
  echo -e "${RED}❌ שגיאה בפריסת benzinga-websocket-stream${NC}"
  exit 1
fi

echo ""

# ======================================
# סיכום והמלצות
# ======================================

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ כל ה-Edge Functions נפרסו בהצלחה!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

echo -e "${BLUE}📝 מה עודכן:${NC}"
echo ""
echo "   ✅ earnings-daily-update"
echo "      - מעבר מ-EODHD ל-Benziga API"
echo "      - עדכונים בזמן אמת (לא יום אחרי!)"
echo ""
echo "   ✅ earnings-results-update"
echo "      - מעבר מ-EODHD ל-Benziga API"
echo "      - תמיכה ב-50 tickers במקביל"
echo ""
echo "   ✅ daily-earnings-sync-simple"
echo "      - מעבר מ-EODHD ל-Benziga API"
echo "      - טווח: שבוע אחורה + 3 חודשים קדימה"
echo ""
echo "   ✅ benzinga-websocket-stream (חדש!)"
echo "      - WebSocket stream לעדכונים בזמן אמת"
echo "      - עדכון אוטומטי כאשר Benzinga מפרסם תוצאות"
echo ""

echo -e "${YELLOW}⚠️  חשוב: הגדר Environment Variable${NC}"
echo ""
echo "הוסף ל-Supabase Dashboard → Settings → Edge Functions → Secrets:"
echo ""
echo "   BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC"
echo ""
echo "או דרך CLI:"
echo "   npx supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC --project-ref $PROJECT_REF"
echo ""

echo -e "${BLUE}🔗 URLs של הפונקציות:${NC}"
echo ""
echo "   earnings-daily-update:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/earnings-daily-update"
echo ""
echo "   earnings-results-update:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/earnings-results-update"
echo ""
echo "   daily-earnings-sync-simple:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/daily-earnings-sync-simple"
echo ""
echo "   benzinga-websocket-stream:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/benzinga-websocket-stream"
echo ""

echo -e "${GREEN}🎉 הפריסה הושלמה בהצלחה!${NC}"
echo ""









