#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/dependency_chaos_redis_reschedule_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Dependency Chaos — Redis kill during reschedule" | tee -a "$LOG"

# provider
PROVEMAIL="prov_dc_rs_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PROVJSON")

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
> /dev/null

# slot A
START1=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END1=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')
SLOT1=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START1\",\"end\":\"$END1\",\"title\":\"RS Slot A\"}")
SLOT_A=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOT1")

# slot B
START2=$(node -e 'console.log(new Date(Date.now()+3*60*60*1000).toISOString());')
END2=$(node -e 'console.log(new Date(Date.now()+4*60*60*1000).toISOString());')
SLOT2=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START2\",\"end\":\"$END2\",\"title\":\"RS Slot B\"}")
SLOT_B=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOT2")

# patient
PATEMAIL="pat_dc_rs_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

# booking on slot A
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_A,\"title\":\"RS Booking\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment.id);' "$BOOKJSON")

# kill redis
redis-cli shutdown nosave || true
sleep 2

# reschedule
RSJSON=$(curl -s -i -X POST "$API/appointments/$APPT_ID/reschedule" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"newSlotId\":$SLOT_B}")

echo "$RSJSON" | tee -a "$LOG"

# DB checks
NEW_SLOT=$(psql "$PSQL_URL" -t -A -c "SELECT \"slotId\" FROM \"Appointment\" WHERE id=$APPT_ID;")
A_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$SLOT_A;")
B_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$SLOT_B;")

echo "DB: appointment.slotId => $NEW_SLOT" | tee -a "$LOG"
echo "DB: slot A booked => $A_BOOKED" | tee -a "$LOG"
echo "DB: slot B booked => $B_BOOKED" | tee -a "$LOG"

# restart redis
redis-server --daemonize yes
sleep 2
redis-cli ping | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
