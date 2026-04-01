#!/usr/bin/env bash
set -euo pipefail
source .env || true

API="http://localhost:3000"
DB_URL="${DATABASE_URL%%\?*}"

echo "Starting Latency Chaos — OUTBOUND STRIPE DELAY"

# Create slot
SLOT_ID=$(psql -qAt "$DB_URL" -c "
INSERT INTO \"AppointmentSlot\" (\"start\",\"end\",\"providerId\",\"booked\")
VALUES (NOW()+interval '1 hour', NOW()+interval '2 hours', 1, false)
RETURNING id;
")
echo "SlotId=$SLOT_ID"

# Create appointment
APPT_ID=$(psql -qAt "$DB_URL" -c "
INSERT INTO \"Appointment\"
(\"title\",\"status\",\"date\",\"userId\",\"providerId\",\"slotId\",\"updatedAt\")
VALUES
('Stripe Delay Chaos','PENDING', NOW()+interval '1 hour', 1, 1, $SLOT_ID, NOW())
RETURNING id;
")
echo "AppointmentId=$APPT_ID"

echo "⏳ Simulating outbound Stripe delay (5s)"
sleep 5

PAYLOAD=$(cat <<JSON
{
  "id": "evt_delay_test",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_delay",
      "object": "checkout.session",
      "metadata": {
        "appointmentId": "$APPT_ID"
      }
    }
  }
}
JSON
)

SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$STRIPE_WEBHOOK_SECRET" | sed 's/^.* //')
HEADER="t=$(date +%s),v1=$SIG"

RESP=$(curl -s -i -X POST "$API/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: $HEADER" \
  --data "$PAYLOAD")

echo "$RESP"

echo "DB check:"
psql "$DB_URL" -c "SELECT id,status FROM \"Appointment\" WHERE id=$APPT_ID;"

echo "DONE"
