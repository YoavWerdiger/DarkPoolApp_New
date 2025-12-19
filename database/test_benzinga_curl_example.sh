#!/bin/bash
# ============================================
# cURL command ל-Benzinga Earnings API (v2.0)
# ============================================

curl --request GET \
  --url 'https://api.benzinga.com/api/v2.0/calendar/earnings?token=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC&date_from=2025-12-07&date_to=2026-12-07&importance=4,5&limit=1000&exchange=NYSE,NASDAQ' \
  --header 'accept: application/json'







