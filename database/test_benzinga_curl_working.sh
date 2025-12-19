#!/bin/bash
# ============================================
# cURL command שעובד ל-Benzinga Earnings API (v2)
# ============================================
# 
# הפרמטרים הנכונים:
# - /api/v2/calendar/earnings (לא v2.0!)
# - parameters[date_from] ו-parameters[date_to]
# - parameters[importance] = 5 (לא 4,5 - רשימה לא עובדת)
# - page ו-pagesize (לא limit)
# - אין parameters[exchange] - לא נתמך!

curl -G "https://api.benzinga.com/api/v2/calendar/earnings" \
  --data-urlencode "token=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC" \
  --data-urlencode "parameters[date_from]=2025-12-07" \
  --data-urlencode "parameters[date_to]=2026-12-07" \
  --data-urlencode "parameters[importance]=5" \
  --data-urlencode "page=0" \
  --data-urlencode "pagesize=10000" \
  --header "accept: application/json"







