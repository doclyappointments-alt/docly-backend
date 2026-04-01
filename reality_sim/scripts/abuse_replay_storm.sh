#!/bin/bash

echo "🔥 REPLAY + DUPLICATE REQUEST STORM"

BOOK_URL="http://localhost:3000/appointments/book"
TOKEN="REPLACE_WITH_VALID_JWT"
SLOT_ID=1

PAYLOAD="{\"slotId\": $SLOT_ID, \"note\": \"replay_attack\"}"

for i in {1..200}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$BOOK_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$PAYLOAD" &
done

wait
echo "✅ Replay storm complete"
