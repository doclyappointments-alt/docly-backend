#!/bin/bash

echo "🔥 BOOKING FLOOD ATTACK SIMULATION"

URL="http://localhost:3000/appointments/book"
TOKEN="REPLACE_WITH_VALID_JWT"
SLOT_ID=1

for i in {1..200}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"slotId\": $SLOT_ID,
      \"note\": \"spam_booking_$i\"
    }" &
done

wait
echo "✅ Booking flood complete"
