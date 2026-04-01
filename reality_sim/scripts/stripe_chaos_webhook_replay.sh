#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

API="${API_BASE_URL:-http://localhost:3000}"
WEBHOOK_PATH="/payments/webhook"
LOG="reality_sim/logs/stripe_chaos_webhook_replay_$(date +%Y%m%d_%H%M%S).log"
PSQL_URL="${DATABASE_URL%%\?*}"

echo "Starting Stripe Chaos — Webhook REPLAY STORM" | tee -a "$LOG"

# provider
PROVEMAIL="prov_replay_$(date +%s%N)@test.local"
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
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"Stripe Replay Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

# patient
PATEMAIL="pat_replay_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.user.id);' "$PATJSON")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

# booking
BOOKJSON=$(curl -s -X POST "$API/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -d "{\"slotId\":$SLOT_ID,\"title\":\"Stripe Replay Test\"}")
APPT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.appointment.id);' "$BOOKJSON")

echo "AppointmentId=$APPT_ID" | tee -a "$LOG"

# payload
PAYLOAD=$(cat <<JSON
{
  "id": "evt_replay_test",
  "type": "charge.refunded",
  "data": {
    "object": {
      "id": "ch_replay_test",
      "amount_refunded": 1000,
      "payment_intent": "pi_replay_test",
      "metadata": {
        "appointmentId": "$APPT_ID"
      }
    }
  }
}
JSON
)

SIG=$(node -e "
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const header = stripe.webhooks.generateTestHeaderString({
  payload: \`${PAYLOAD}\`,
  secret: process.env.STRIPE_WEBHOOK_SECRET
});
console.log(header);
")

echo "🔥 Replaying same webhook 20 times..." | tee -a "$LOG"

for i in $(seq 1 20); do
  RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API$WEBHOOK_PATH" \
    -H "Content-Type: application/json" \
    -H "Stripe-Signature: $SIG" \
    --data-binary "$PAYLOAD")
  echo "Replay $i -> HTTP $RESP" | tee -a "$LOG"
done

# DB check
STATUS=$(psql "$PSQL_URL" -t -A -c \
"SELECT status FROM \"Appointment\" WHERE id=$APPT_ID;")

echo "DB check: appointment.status => $STATUS" | tee -a "$LOG"
echo "DONE" | tee -a "$LOG"
