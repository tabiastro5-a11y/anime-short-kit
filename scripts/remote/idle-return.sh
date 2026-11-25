#!/bin/bash
# Runs ON the rented machine (started by setup.sh / remote.sh up): the safety net that STOPS the instance by itself when
# nothing has run for IDLE_MIN minutes, so GPU time is never billed by mistake (Claude also stops it from the PC after
# every job: `bash scripts/remote/remote.sh down`). Stopping keeps the set-up, so the next `up` is quick.
# Uses the instance's OWN key that vast.ai puts in the container (CONTAINER_API_KEY / CONTAINER_ID); the user's
# account key never leaves the PC. Activity = a render/stills process running, or out/.last_job touched by remote.sh.
IDLE_MIN=${IDLE_MIN:-20}
cd "$(dirname "$0")/../.."
envof() { tr '\0' '\n' < /proc/1/environ 2>/dev/null | sed -n "s/^$1=//p" | head -1; }
ID=${CONTAINER_ID:-$(envof CONTAINER_ID)}
KEY=${CONTAINER_API_KEY:-$(envof CONTAINER_API_KEY)}
LOG=out/idle-return.log; mkdir -p out; touch out/.last_job
if [ -z "$ID" ] || [ -z "$KEY" ]; then echo "$(date) no CONTAINER_ID/CONTAINER_API_KEY: cannot self-return" >> $LOG; exit 0; fi
echo "$(date) watching instance $ID, return after $IDLE_MIN idle minutes" >> $LOG
while sleep 60; do
  if pgrep -f "render-short.mjs|bridge-stills.mjs|par-render.sh|npm ci" >/dev/null; then touch out/.last_job; continue; fi
  idle=$(( ($(date +%s) - $(stat -c %Y out/.last_job)) / 60 ))
  if [ "$idle" -ge "$IDLE_MIN" ]; then
    echo "$(date) idle $idle min: stopping instance $ID" >> $LOG
    code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json"       -d '{"state": "stopped"}' "https://console.vast.ai/api/v0/instances/$ID/")
    echo "$(date) stop -> $code" >> $LOG
    [ "$code" = "200" ] && exit 0
  fi
done
