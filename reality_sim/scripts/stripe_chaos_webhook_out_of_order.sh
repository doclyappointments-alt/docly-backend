#!/usr/bin/env bash
source .env || true
set -euo pipefail

API=http://localhost:3000
DB_URL="${DATABASE_URL%%\?*}"
WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"

echo "Starting Stripe Chaos — OUT-OF-ORDER EVENTS"

# Create slot
SLOT_ID=$(psql -qAt "$DB_URL" -c \
"INSERT INTO \"AppointmentSlot\" (\"start\",\"end\",\"providerId\",\"booked\") 
 VALUES (NOW()+interval '1 hour', NOW()+interval '2 hours', 1, false) RETURNING id;")
echo "SlotId=$SLOT_ID"

# Create appointment
APPT_ID=$(psql -qAt "$DB_URL" -c \
"INSERT INTO \"Appointment\" 
(\"title\",\"status\",\"date\",\"userId\",\"providerId\",\"slotId\",\"updatedAt\") 
VALUES ('Stripe OOO Chaos','PENDING', NOW()+interval '1 hour', 1, 1, $SLOT_ID, NOW()) 
RETURNING id;")
echo "AppointmentId=$APPT_ID"

# Build events (refund BEFORE checkout)
REFUND_PAYLOAD=$(cat <<JSON
{
  "id": "evt_refund_first",
  "object": "event",
  "type": "charge.refunded",
  "data": {
    "object": {
      "id": "ch_test_ooo",
      "object": "charge",
      "metadata": {
        "appointmentId": "$APPT_ID"
      }
    }
  }
}
JSON
)

CHECKOUT_PAYLOAD=$(cat <<JSON
{
  "id": "evt_checkout_late",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_ooo",
      "object": "checkout.session",
      "metadata": {
        "appointmentId": "$APPT_ID"
      }
    }
  }
}
JSON
)

sign() {
  local payload="$1"
  local sig
  sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')
  echo "t=$(date +%s),v1=$sig"
}

echo "🔥 Sending REFUND first"
HDR1=$(sign "$REFUND_PAYLOAD")
curl -s -o /dev/null -w "refund -> HTTP %{http_code}\n" \
  -X POST "$API/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: $HDR1" \
  --data "$REFUND_PAYLOAD"

sleep 2

echo "🔥 Sending CHECKOUT after"
HDR2=$(sign "$CHECKOUT_PAYLOAD")
curl -s -o /dev/null -w "checkout -> HTTP %{http_code}\n" \
  -X POST "$API/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: $HDR2" \
  --data "$CHECKOUT_PAYLOAD"

echo "DB check:"
psql "$DB_URL" -c "SELECT id,status FROM \"Appointment\" WHERE id=$APPT_ID;"

echo "DONE"
