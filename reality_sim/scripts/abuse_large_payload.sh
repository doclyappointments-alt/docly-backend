#!/bin/bash

echo "🔥 LARGE PAYLOAD ABUSE SIMULATION"

URL="http://localhost:3000/auth/register"

# Generate 1MB payload
BIG=$(head -c 1048576 </dev/urandom | base64 | tr -d '\n')

for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"big$i@test.com\",
      \"password\": \"pass123\",
      \"name\": \"$BIG\"
    }" &
done

wait
echo "✅ Large payload abuse complete"
