#!/usr/bin/env bash
source .env || true
set -euo pipefail

API=http://localhost:3000
DB_URL="${DATABASE_URL%%\?*}"
WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:?missing STRIPE_WEBHOOK_SECRET}"

echo "Starting Stripe Chaos — DUPLICATE EVENT TYPES"

# Create slot
SLOT_ID=$(psql -qAt "$DB_URL" -c \
"INSERT INTO \"AppointmentSlot\" (\"start\",\"end\",\"providerId\",\"booked\")
 VALUES (NOW()+interval '1 hour', NOW()+interval '2 hours', 1, false)
 RETURNING id;")
echo "SlotId=$SLOT_ID"

# Create appointment

APPT_ID=$(psql -qAt "$DB_URL" -c "\

INSERT INTO \"Appointment\" \

(\"title\",\"status\",\"date\",\"userId\",\"providerId\",\"slotId\",\"updatedAt\") \

VALUES ('Stripe Dup Chaos','PENDING', NOW()+interval '1 hour', 1, 1, $SLOT_ID, NOW()) \

RETURNING id;\
")

echo "AppointmentId=$APPT_ID"


# Build webhook payload
PAYLOAD=$(cat <<JSON
{
  "id": "evt_dup_test",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_dup",
      "object": "checkout.session",
      "metadata": {
        "appointmentId": "$APPT_ID"
      }
    }
  }
}
JSON
)

SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
HEADER="t=$(date +%s),v1=$SIG"

echo "🔥 Sending DUPLICATE event types..."
for i in {1..10}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API/payments/webhook" \
    -H "Content-Type: application/json" \
    -H "Stripe-Signature: $HEADER" \
    --data "$PAYLOAD")
  echo "Duplicate $i -> HTTP $CODE"
done

echo "DB check:"
psql -qAt "$DB_URL" -c "SELECT id,status FROM \"Appointment\" WHERE id=$APPT_ID;"

echo "DONE"
