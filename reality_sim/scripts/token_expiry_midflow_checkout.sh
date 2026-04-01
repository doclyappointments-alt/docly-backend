#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/token_expiry_midflow_checkout_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting token-expiry mid-flow (checkout/session init)..." | tee -a "$LOG"

# provider
PROVEMAIL="prov_chk_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PROVJSON")

psql "$PSQL_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 WHERE id=(SELECT MAX(id) FROM \"Provider\");" \
| tee -a "$LOG"

# slot
START_ISO=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END_ISO=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"Checkout Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

# patient
PATEMAIL="pat_chk_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user.id);' "$PATJSON")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

# booking
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"Checkout Test\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment.id);' "$BOOKJSON")

echo "AppointmentId=$APPT_ID" | tee -a "$LOG"

# mint short token
SHORT_TOKEN=$(node -e '
const jwt=require("jsonwebtoken");
const secret=process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
const token=jwt.sign({ userId: '"$PAT_ID"', userRole:"PATIENT" }, secret, { expiresIn:"1s" });
console.log(token);
')
sleep 2

# checkout/session init with expired token
RESP=$(curl -s -i -X POST "$API/checkout/session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SHORT_TOKEN" \
  -d "{\"appointmentId\":$APPT_ID,\"type\":\"single\"}")

echo "Checkout response (raw):" | tee -a "$LOG"
echo "$RESP" | tee -a "$LOG"

# DB checks
PAYCOUNT=$(psql "$PSQL_URL" -t -A -c \
"SELECT COUNT(*) FROM \"Payment\" WHERE \"appointmentId\"=$APPT_ID;")

echo "DB check: payment rows => $PAYCOUNT" | tee -a "$LOG"
echo "DONE" | tee -a "$LOG"
