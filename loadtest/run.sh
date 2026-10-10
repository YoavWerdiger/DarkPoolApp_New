#!/bin/sh
# שימוש: sh loadtest/run.sh smoke   |   sh loadtest/run.sh full
# stress: 1500 גולשים בלי הפסקות (+קפיצה ל-2250), 450 בצ'אט החי, 10 הודעות/שנייה
# MSG_PER_SEC=2 → 2 הודעות בשנייה מכותבים שונים (ברירת מחדל 0.2)
# דורש LT_PASSWORD בסביבה (סיסמת משתמשי loadtest+N@darkpool.test)
cd "$(dirname "$0")/.." && set -a && . ./.env && set +a
MODE=${1:-smoke}
if [ "$MODE" = "full" ]; then EXTRA="-e PEAK=450 -e LOGIN_USERS=25";
elif [ "$MODE" = "stress" ]; then EXTRA="-e STRESS=1 -e PEAK=450 -e LOGIN_USERS=25 -e BROWSE_PEAK=${BROWSE_PEAK:-1500} -e THINK=${THINK:-0.1}"; MSG_PER_SEC=${MSG_PER_SEC:-10}; else EXTRA="-e SMOKE=1 -e PEAK=5 -e LOGIN_USERS=3"; fi
mkdir -p loadtest/out
# ענן (Grafana, עד 100 VUs): sh loadtest/run.sh cloud-smoke | cloud-stress
case "$MODE" in cloud-*)
  [ "$MODE" = "cloud-smoke" ] && SM="-e SMOKE=1" || SM=""
  exec "${K6:-$HOME/.local/bin/k6}" cloud run $SM \
    -e SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" -e ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
    -e LT_PASSWORD="$LT_PASSWORD" -e GROUP_ID=24e6abda-43f5-441f-a829-c6862625cc3e \
    ${PEAK_RATE:+-e PEAK_RATE=$PEAK_RATE} ${MSG_PER_SEC:+-e MSG_PER_SEC=$MSG_PER_SEC} \
    loadtest/k6-cloud-stress.js ;;
esac
# CLOUD=1 → הרצה ב-Grafana Cloud (דורש k6 cloud login --token ... פעם אחת)
if [ "${CLOUD:-0}" = "1" ]; then RUN="cloud run"; else RUN="run"; fi
"${K6:-$HOME/.local/bin/k6}" $RUN --no-color $EXTRA -e CLOUD_PROJECT_ID="${CLOUD_PROJECT_ID:-}" \
  -e SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" -e ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -e LT_PASSWORD="$LT_PASSWORD" -e MSG_PER_SEC="${MSG_PER_SEC:-0.2}" -e THINK="${THINK:-1}" -e GROUP_ID=24e6abda-43f5-441f-a829-c6862625cc3e \
  --summary-export "loadtest/out/summary-$MODE.json" loadtest/k6-chat-450.js 2>&1 | tee "loadtest/out/run-$MODE.log" | tail -45
