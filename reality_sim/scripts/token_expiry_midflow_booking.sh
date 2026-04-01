#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/token_expiry_midflow_booking_$(date +%Y%m%d_%H%M%S).log"

# strip prisma params for psql compatibility
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting token-expiry mid-flow (booking)..." | tee -a "$LOG"
echo "API=$API" | tee -a "$LOG"
echo "DB=$PSQL_URL" | tee -a "$LOG"

# 1) register provider
PROVEMAIL="prov_exp_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")

echo "Provider register: $PROVJSON" | tee -a "$LOG"
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PROVJSON")
test -n "$PROV_TOKEN"

# verify provider (admin bypass)
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
| tee -a "$LOG"

# read providerId
PROVIDER_ID=$(psql "$PSQL_URL" -t -A -c 'SELECT MAX(id) FROM "Provider";')
echo "ProviderId=$PROVIDER_ID" | tee -a "$LOG"

# 2) create slot as provider
START_ISO=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END_ISO=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"Slot\"}")

echo "Slot create: $SLOTJSON" | tee -a "$LOG"
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot?.id||"");' "$SLOTJSON")
test -n "$SLOT_ID"
echo "SlotId=$SLOT_ID" | tee -a "$LOG"

# 3) register patient
PATEMAIL="pat_exp_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")

echo "Patient register: $PATJSON" | tee -a "$LOG"
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user?.id||"");' "$PATJSON")
test -n "$PAT_ID"
echo "PatientId=$PAT_ID" | tee -a "$LOG"

# 4) forge a short-lived patient token (1s) with same secret
SHORT_TOKEN=$(node -e '
const jwt=require("jsonwebtoken");
const secret=process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || "";
if(!secret){ console.error("Missing JWT_SECRET/ACCESS_TOKEN_SECRET in env"); process.exit(2); }
const userId=parseInt(process.argv[1],10);
const token=jwt.sign({ userId, userRole:"PATIENT" }, secret, { expiresIn: "1s" });
console.log(token);
' "$PAT_ID")

test -n "$SHORT_TOKEN"
echo "Short token minted (1s)..." | tee -a "$LOG"
sleep 2

# 5) attempt booking with expired token (should 401)
BOOKJSON=$(curl -s -i -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SHORT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"Expiry booking\"}")

echo "Booking response (raw):" | tee -a "$LOG"
echo "$BOOKJSON" | tee -a "$LOG"

# 6) verify no side-effects in DB
APPT_COUNT=$(psql "$PSQL_URL" -t -A -c "SELECT COUNT(*) FROM \"Appointment\" WHERE \"slotId\"=$SLOT_ID;")
SLOT_BOOKED=$(psql "$PSQL_URL" -t -A -c "SELECT booked FROM \"AppointmentSlot\" WHERE id=$SLOT_ID;")

echo "DB check: Appointment count for slotId=$SLOT_ID => $APPT_COUNT" | tee -a "$LOG"
echo "DB check: Slot booked => $SLOT_BOOKED" | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
