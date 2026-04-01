#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
PSQL_URL="${DATABASE_URL%%\?*}"
LOG="reality_sim/logs/dependency_chaos_api_restart_mid_request_$(date +%Y%m%d_%H%M%S).log"

echo "Starting Dependency Chaos — API restart mid-request" | tee -a "$LOG"

# provider
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"prov_api_restart_$(date +%s%N)@test.local\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PROVJSON")

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" >/dev/null

# slot
START_ISO=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END_ISO=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"API Restart Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

# patient
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"pat_api_restart_$(date +%s%N)@test.local\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

echo "🔥 RESTARTING API MID-REQUEST" | tee -a "$LOG"

(
  sleep 0.2
  pkill -f "node dist/index.js" || true
) &

RESP=$(curl -s -i -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"API Restart Chaos\"}")

echo "$RESP" | tee -a "$LOG"

sleep 1
echo "♻️ Restart API manually if needed" | tee -a "$LOG"

COUNT=$(psql "$PSQL_URL" -t -A -c 'SELECT COUNT(*) FROM "Appointment";')
BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$SLOT_ID;")

echo "DB: appointment count => $COUNT" | tee -a "$LOG"
echo "DB: slot booked => $BOOKED" | tee -a "$LOG"
echo "DONE" | tee -a "$LOG"
