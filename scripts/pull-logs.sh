#!/usr/bin/env bash
# Usage: bash scripts/pull-logs.sh [minutes_ago]
# Pulls recent client telemetry + key Lambda logs from CloudWatch.

AWS="/c/Program Files/Amazon/AWSCLIV2/aws.exe"
MINUTES=${1:-10}
START_MS=$(( ($(date +%s) - MINUTES * 60) * 1000 ))

awslogs() {
  MSYS_NO_PATHCONV=1 "$AWS" logs filter-log-events \
    --log-group-name "$1" \
    --start-time "$START_MS" \
    --output text \
    --query 'events[*].message' 2>/dev/null
}

echo "======= CLIENT TELEMETRY (/aws/lambda/bobs-client-log) ======="
awslogs /aws/lambda/bobs-client-log | grep -v '^$' | head -80

echo ""
echo "======= START-CHAT (/aws/lambda/bobs-start-chat) ======="
awslogs /aws/lambda/bobs-start-chat | grep -v 'START\|END\|INIT\|REPORT\|Runtime' | grep -v '^$' | head -40

echo ""
echo "======= AUTOPILOT-TURN errors (/aws/lambda/bobs-autopilot-turn) ======="
awslogs /aws/lambda/bobs-autopilot-turn | grep -i 'error\|warn\|CLIENT_TELEMETRY' | grep -v '^$' | head -40
