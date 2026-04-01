#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/dependency_chaos_redis_booking_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Dependency Chaos — Redis kill during booking" | tee -a "$LOG"
echo "API=$API" | tee -a "$LOG"
echo "DB=$PSQL_URL" | tee -a "$LOG"

# --- sanity: redis status
echo "Redis status (before):" | tee -a "$LOG"
redis-cli ping | tee -a "$LOG"

# --- provider
PROVEMAIL="prov_dc_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PROVJSON")

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
> /dev/null

# --- slot
START=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START\",\"end\":\"$END\",\"title\":\"Redis Chaos Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot?.id||"");' "$SLOTJSON")

# --- patient
PATEMAIL="pat_dc_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user?.id||"");' "$PATJSON")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PATJSON")

# --- kill redis
echo "🔥 KILLING REDIS" | tee -a "$LOG"
redis-cli shutdown nosave || true
sleep 2

# --- booking attempt
BOOKJSON=$(curl -s -i -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"Redis Chaos Booking\"}")

echo "Booking response (raw):" | tee -a "$LOG"
echo "$BOOKJSON" | tee -a "$LOG"

# --- DB checks
APPT_COUNT=$(psql "$PSQL_URL" -t -A -c "SELECT COUNT(*) FROM \"Appointment\" WHERE \"slotId\"=$SLOT_ID;")
SLOT_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$SLOT_ID;")

echo "DB check: Appointment count => $APPT_COUNT" | tee -a "$LOG"
echo "DB check: Slot booked => $SLOT_BOOKED" | tee -a "$LOG"

# --- restart redis
echo "♻️ Restarting Redis" | tee -a "$LOG"
redis-server --daemonize yes
sleep 2
echo "Redis status (after):" | tee -a "$LOG"
redis-cli ping | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
