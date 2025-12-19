#!/bin/bash
# ============================================
# cURL command נכון ל-Benzinga Earnings API (v2)
# ============================================
# 
# הפורמט הנכון: /api/v2/calendar/earnings (לא v2.0!)
# עם parameters[...] ולא פרמטרים ישירים

curl --request GET \
  --url 'https://api.benzinga.com/api/v2/calendar/earnings?token=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC&parameters%5Bdate_from%5D=2025-12-07&parameters%5Bdate_to%5D=2026-12-07&parameters%5Bimportance%5D=4,5&page=0&pagesize=10000&parameters%5Bexchange%5D=NYSE,NASDAQ' \
  --header 'accept: application/json'

# או בפורמט יותר קריא:
curl -G "https://api.benzinga.com/api/v2/calendar/earnings" \
  --data-urlencode "token=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC" \
  --data-urlencode "parameters[date_from]=2025-12-07" \
  --data-urlencode "parameters[date_to]=2026-12-07" \
  --data-urlencode "parameters[importance]=4,5" \
  --data-urlencode "parameters[exchange]=NYSE,NASDAQ" \
  --data-urlencode "page=0" \
  --data-urlencode "pagesize=10000" \
  --header "accept: application/json"







