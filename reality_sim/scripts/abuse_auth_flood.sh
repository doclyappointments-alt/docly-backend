#!/bin/bash

echo "🔥 AUTH FLOOD ATTACK SIMULATION"

URL="http://localhost:3000/auth/login"
EMAIL="bot@spam.com"

for i in {1..200}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$EMAIL\",
      \"password\": \"wrongpassword$i\"
    }" &
done

wait
echo "✅ Flood complete"
