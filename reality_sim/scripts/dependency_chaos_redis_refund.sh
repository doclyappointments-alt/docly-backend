#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
LOG="reality_sim/logs/dependency_chaos_redis_refund_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Dependency Chaos — Redis kill during refund" | tee -a "$LOG"

# provider
PROVEMAIL="prov_dc_ref_$(date +%s%N)@test.local"
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
  -d "{\"start\":\"$START\",\"end\":\"$END\",\"title\":\"DC Refund Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

# patient
PATEMAIL="pat_dc_ref_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user.id);' "$PATJSON")

# booking
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"DC Refund Booking\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment.id);' "$BOOKJSON")

# payment
PAYJSON=$(curl -s -X POST "$API/payments/v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"appointmentId\":$APPT_ID,\"amount\":1000,\"paymentType\":\"CARD\"}")
PAY_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.payment.id);' "$PAYJSON")

# kill redis
redis-cli shutdown nosave || true
sleep 2

# refund
REFJSON=$(curl -s -i -X POST "$API/payments/v2/$PAY_ID/refund" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN")

echo "$REFJSON" | tee -a "$LOG"

# DB checks
PAY_STATUS=$(psql "$PSQL_URL" -t -A -c "SELECT status FROM \"Payment\" WHERE id=$PAY_ID;")
AUDIT_COUNT=$(psql "$PSQL_URL" -t -A -c "SELECT COUNT(*) FROM \"PaymentAuditLog\" WHERE \"paymentId\"=$PAY_ID;")

echo "DB check: payment.status => $PAY_STATUS" | tee -a "$LOG"
echo "DB check: audit rows => $AUDIT_COUNT" | tee -a "$LOG"

# restart redis
redis-server --daemonize yes
sleep 2
redis-cli ping | tee -a "$LOG"

echo "DONE" | tee -a "$LOG"
