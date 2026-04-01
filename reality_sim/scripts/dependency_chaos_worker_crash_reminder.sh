#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/dependency_chaos_worker_crash_reminder_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Dependency Chaos — Worker crash mid-reminder job" | tee -a "$LOG"

# provider
PROVEMAIL="prov_dc_wc_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PROVJSON")

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
> /dev/null

# slot
START=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')
SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START\",\"end\":\"$END\",\"title\":\"WC Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

# patient
PATEMAIL="pat_dc_wc_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

# booking
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"WC Booking\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment.id);' "$BOOKJSON")

# confirm -> enqueue reminders
CONFJSON=$(curl -s -X PATCH "$API/appointments/$APPT_ID/confirm" \
  -H "Authorization: Bearer $PAT_TOKEN")

echo "Confirm response:" | tee -a "$LOG"
echo "$CONFJSON" | tee -a "$LOG"

# crash worker
echo "🔥 CRASHING REMINDER WORKER" | tee -a "$LOG"
pkill -f reminder || true
sleep 2

# DB checks
STATUS=$(psql "$PSQL_URL" -t -A -c "SELECT status FROM \"Appointment\" WHERE id=$APPT_ID;")
R24=$(psql "$PSQL_URL" -t -A -c "SELECT \"reminder24Sent\" FROM \"Appointment\" WHERE id=$APPT_ID;")
R1H=$(psql "$PSQL_URL" -t -A -c "SELECT \"reminder1hSent\" FROM \"Appointment\" WHERE id=$APPT_ID;")

echo "DB: appointment.status => $STATUS" | tee -a "$LOG"
echo "DB: reminder24Sent => $R24" | tee -a "$LOG"
echo "DB: reminder1hSent => $R1H" | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
