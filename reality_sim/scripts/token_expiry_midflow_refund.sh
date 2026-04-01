#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/token_expiry_midflow_refund_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting token-expiry mid-flow (refund)..." | tee -a "$LOG"
echo "API=$API" | tee -a "$LOG"
echo "DB=$PSQL_URL" | tee -a "$LOG"

# 1) register provider
PROVEMAIL="prov_ref_$(date +%s%N)@test.local"
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

# 2) create slot
START_ISO=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END_ISO=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"Refund Slot\"}")
echo "Slot create: $SLOTJSON" | tee -a "$LOG"
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot?.id||"");' "$SLOTJSON")
test -n "$SLOT_ID"
echo "SlotId=$SLOT_ID" | tee -a "$LOG"

# 3) register patient
PATEMAIL="pat_ref_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
echo "Patient register: $PATJSON" | tee -a "$LOG"
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user?.id||"");' "$PATJSON")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken||"");' "$PATJSON")
test -n "$PAT_ID"
test -n "$PAT_TOKEN"
echo "PatientId=$PAT_ID" | tee -a "$LOG"

# 4) book appointment (valid token)
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"Refund Test\"}")
echo "Booking: $BOOKJSON" | tee -a "$LOG"
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment?.id||"");' "$BOOKJSON")
test -n "$APPT_ID"
echo "AppointmentId=$APPT_ID" | tee -a "$LOG"

# 5) create payment (valid token) to get paymentId
PAYJSON=$(curl -s -X POST "$API/payments/v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"appointmentId\":$APPT_ID,\"amount\":1000,\"paymentType\":\"CARD\"}")
echo "Payment create: $PAYJSON" | tee -a "$LOG"
PAYMENT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.payment?.id||"");' "$PAYJSON")
test -n "$PAYMENT_ID"
echo "PaymentId=$PAYMENT_ID" | tee -a "$LOG"

# 6) mint short token (1s) then expire it
SHORT_TOKEN=$(node -e '
const jwt=require("jsonwebtoken");
const secret=process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || "";
if(!secret){ console.error("Missing JWT_SECRET/ACCESS_TOKEN_SECRET"); process.exit(2); }
const userId=parseInt(process.argv[1],10);
console.log(jwt.sign({ userId, userRole:"PATIENT" }, secret, { expiresIn:"1s" }));
' "$PAT_ID")
test -n "$SHORT_TOKEN"
echo "Short token minted (1s)..." | tee -a "$LOG"
sleep 2

# 7) refund attempt with expired token (should 401)
REFJSON=$(curl -s -i -X POST "$API/payments/v2/$PAYMENT_ID/refund" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SHORT_TOKEN" \
  -d "{\"amount\":100}")
echo "Refund response (raw):" | tee -a "$LOG"
echo "$REFJSON" | tee -a "$LOG"

# 8) verify no side-effects in audit (should be 0)
REFCOUNT=$(psql "$PSQL_URL" -t -A -c \
"SELECT COUNT(*) FROM \"PaymentAuditLog\" WHERE \"paymentId\"=$PAYMENT_ID AND action IN ('REFUNDED','PARTIAL_REFUND');")
echo "Refund audit entries => $REFCOUNT" | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
