#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/dependency_chaos_redis_reminder_enqueue_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Dependency Chaos — Redis kill during reminder enqueue (confirm)" | tee -a "$LOG"
echo "API=$API" | tee -a "$LOG"
echo "DB=$PSQL_URL" | tee -a "$LOG"

echo "Redis status (before):" | tee -a "$LOG"
redis-cli ping | tee -a "$LOG"

# 1) provider
PROVEMAIL="prov_dc_rem_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PROVJSON")
test -n "$PROV_TOKEN"

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
> /dev/null

# 2) slot
START=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START\",\"end\":\"$END\",\"title\":\"DC Reminder Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot?.id||"");' "$SLOTJSON")
test -n "$SLOT_ID"

# 3) patient
PATEMAIL="pat_dc_rem_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PATJSON")
test -n "$PAT_TOKEN"

# 4) book (valid)
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"DC Reminder Booking\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment?.id||"");' "$BOOKJSON")
test -n "$APPT_ID"
echo "AppointmentId=$APPT_ID" | tee -a "$LOG"

# 5) kill Redis right before CONFIRM (enqueue happens after DB transition)
echo "🔥 KILLING REDIS (before confirm)" | tee -a "$LOG"
redis-cli shutdown nosave || true
sleep 2

# 6) confirm (should still succeed OR fail cleanly, but must not corrupt DB)
CONFJSON=$(curl -s -i -X PATCH "$API/appointments/$APPT_ID/confirm" \
  -H "Authorization: Bearer $PAT_TOKEN")
echo "Confirm response (raw):" | tee -a "$LOG"
echo "$CONFJSON" | tee -a "$LOG"

# 7) DB checks (status must be consistent)
APPT_STATUS=$(psql "$PSQL_URL" -t -A -c "SELECT status FROM \"Appointment\" WHERE id=$APPT_ID;")
R24=$(psql "$PSQL_URL" -t -A -c "SELECT \"reminder24Sent\" FROM \"Appointment\" WHERE id=$APPT_ID;")
R1H=$(psql "$PSQL_URL" -t -A -c "SELECT \"reminder1hSent\" FROM \"Appointment\" WHERE id=$APPT_ID;")

echo "DB check: appointment.status => $APPT_STATUS" | tee -a "$LOG"
echo "DB check: reminder24Sent => $R24" | tee -a "$LOG"
echo "DB check: reminder1hSent => $R1H" | tee -a "$LOG"

# 8) restart Redis
echo "♻️ Restarting Redis" | tee -a "$LOG"
redis-server --daemonize yes
sleep 2
echo "Redis status (after):" | tee -a "$LOG"
redis-cli ping | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
