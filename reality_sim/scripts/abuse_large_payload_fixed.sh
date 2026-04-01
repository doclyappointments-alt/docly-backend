#!/bin/bash

echo "🔥 LARGE PAYLOAD ABUSE SIMULATION (FIXED)"

URL="http://localhost:3000/auth/register"
BIG=$(cat /tmp/big_payload.txt)

for i in {1..10}; do
  echo "{\"email\":\"big$i@test.com\",\"password\":\"pass123\",\"name\":\"$BIG\"}" | \
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    --data-binary @- &
done

wait
echo "✅ Large payload abuse complete"
