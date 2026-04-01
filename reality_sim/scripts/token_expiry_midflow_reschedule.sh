#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/token_expiry_midflow_reschedule_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting token-expiry mid-flow (reschedule)..." | tee -a "$LOG"

# 1) provider
PROVEMAIL="prov_res_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PROVJSON")
test -n "$PROV_TOKEN"

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
> /dev/null

# 2) slots
START1=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END1=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

START2=$(node -e 'console.log(new Date(Date.now()+3*60*60*1000).toISOString());')
END2=$(node -e 'console.log(new Date(Date.now()+4*60*60*1000).toISOString());')

SLOT1=$(curl -s -X POST "$API/slots" -H "Content-Type: application/json" -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START1\",\"end\":\"$END1\",\"title\":\"Old Slot\"}")
OLD_SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot?.id||"");' "$SLOT1")

SLOT2=$(curl -s -X POST "$API/slots" -H "Content-Type: application/json" -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START2\",\"end\":\"$END2\",\"title\":\"New Slot\"}")
NEW_SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot?.id||"");' "$SLOT2")

test -n "$OLD_SLOT_ID"
test -n "$NEW_SLOT_ID"

# 3) patient
PATEMAIL="pat_res_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user?.id||"");' "$PATJSON")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PATJSON")
test -n "$PAT_ID"
test -n "$PAT_TOKEN"

# 4) booking (valid)
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$OLD_SLOT_ID,\"title\":\"Resched Test\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment?.id||"");' "$BOOKJSON")
test -n "$APPT_ID"

# 5) mint short token
SHORT_TOKEN=$(node -e '
const jwt=require("jsonwebtoken");
const secret=process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || "";
if(!secret){ process.exit(2); }
console.log(jwt.sign({ userId: '"$PAT_ID"', userRole:"PATIENT" }, secret, { expiresIn:"1s" }));
')
sleep 2

# 6) reschedule with expired token (REAL ROUTE)
RESJSON=$(curl -s -i -X POST "$API/appointments/$APPT_ID/reschedule" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SHORT_TOKEN" \
  -d "{\"newSlotId\":$NEW_SLOT_ID}")

echo "Reschedule response (raw):" | tee -a "$LOG"
echo "$RESJSON" | tee -a "$LOG"

# 7) DB integrity checks
APPT_SLOT=$(psql "$PSQL_URL" -t -A -c "SELECT \"slotId\" FROM \"Appointment\" WHERE id=$APPT_ID;")
OLD_SLOT_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$OLD_SLOT_ID;")
NEW_SLOT_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$NEW_SLOT_ID;")

echo "DB check: appointment.slotId => $APPT_SLOT" | tee -a "$LOG"
echo "DB check: old slot booked => $OLD_SLOT_BOOKED" | tee -a "$LOG"
echo "DB check: new slot booked => $NEW_SLOT_BOOKED" | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
