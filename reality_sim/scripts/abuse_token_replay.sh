#!/bin/bash

echo "🔥 TOKEN REPLAY ABUSE SIMULATION"

# Use a REAL valid JWT here
TOKEN="REPLACE_WITH_VALID_JWT"

URLS=(
"http://localhost:3000/appointments/book"
"http://localhost:3000/providers/me"
"http://localhost:3000/search/providers?q=test"
)

SLOT_ID=1

for round in {1..50}; do
  for url in "${URLS[@]}"; do
    if [[ "$url" == *"appointments/book"* ]]; then
      curl -s -o /dev/null -w "%{http_code}\n" \
        -X POST "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"slotId\": $SLOT_ID, \"note\": \"replay_$round\"}" &
    else
      curl -s -o /dev/null -w "%{http_code}\n" \
        -H "Authorization: Bearer $TOKEN" \
        "$url" &
    fi
  done
done

wait
echo "✅ Token replay simulation complete"
