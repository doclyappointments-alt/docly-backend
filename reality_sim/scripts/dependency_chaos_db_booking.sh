#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/dependency_chaos_db_booking_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Dependency Chaos — DB kill during booking" | tee -a "$LOG"

# provider
PROVEMAIL="prov_dc_db_$(date +%s%N)@test.local"
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
  -d "{\"start\":\"$START\",\"end\":\"$END\",\"title\":\"DB Chaos Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

# patient
PATEMAIL="pat_dc_db_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

# kill DB
echo "🔥 KILLING POSTGRES" | tee -a "$LOG"
sudo systemctl stop postgresql || true
sleep 2

# booking
BOOKJSON=$(curl -s -i -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"DB Chaos Booking\"}")

echo "$BOOKJSON" | tee -a "$LOG"

# restart DB
echo "♻️ Restarting POSTGRES" | tee -a "$LOG"
sudo systemctl start postgresql
sleep 3

# DB checks
APPT_COUNT=$(psql "$PSQL_URL" -t -A -c "SELECT COUNT(*) FROM \"Appointment\" WHERE \"slotId\"=$SLOT_ID;" || echo "ERR")
SLOT_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$SLOT_ID;" || echo "ERR")

echo "DB: appointment count => $APPT_COUNT" | tee -a "$LOG"
echo "DB: slot booked => $SLOT_BOOKED" | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
