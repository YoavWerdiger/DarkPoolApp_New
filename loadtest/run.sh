#!/bin/sh
# שימוש: sh loadtest/run.sh smoke   |   sh loadtest/run.sh full
# MSG_PER_SEC=2 → 2 הודעות בשנייה מכותבים שונים (ברירת מחדל 0.2)
# דורש LT_PASSWORD בסביבה (סיסמת משתמשי loadtest+N@darkpool.test)
cd "$(dirname "$0")/.." && set -a && . ./.env && set +a
MODE=${1:-smoke}
if [ "$MODE" = "full" ]; then EXTRA="-e PEAK=450 -e LOGIN_USERS=25"; else EXTRA="-e SMOKE=1 -e PEAK=5 -e LOGIN_USERS=3"; fi
mkdir -p loadtest/out
"${K6:-$HOME/.local/bin/k6}" run --no-color $EXTRA \
  -e SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" -e ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -e LT_PASSWORD="$LT_PASSWORD" -e MSG_PER_SEC="${MSG_PER_SEC:-0.2}" -e GROUP_ID=24e6abda-43f5-441f-a829-c6862625cc3e \
  --summary-export "loadtest/out/summary-$MODE.json" loadtest/k6-chat-450.js 2>&1 | tee "loadtest/out/run-$MODE.log" | tail -45
