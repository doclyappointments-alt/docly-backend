#!/bin/bash

echo "🔥 BURST TRAFFIC STORM SIMULATION"

AUTH_URL="http://localhost:3000/auth/login"
SEARCH_URL="http://localhost:3000/search/providers?q=doc"
BOOK_URL="http://localhost:3000/appointments/book"

TOKEN="REPLACE_WITH_VALID_JWT"
SLOT_ID=1

for round in {1..10}; do
  echo "⚡ Burst round $round"

  # auth spam
  for i in {1..50}; do
    curl -s -o /dev/null -X POST "$AUTH_URL" \
      -H "Content-Type: application/json" \
      -d '{"email":"burst@bot.com","password":"wrong"}' &
  done

  # search spam
  for i in {1..50}; do
    curl -s -o /dev/null "$SEARCH_URL" &
  done

  # booking spam
  for i in {1..50}; do
    curl -s -o /dev/null -X POST "$BOOK_URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"slotId\": $SLOT_ID, \"note\": \"burst_$i\"}" &
  done

  wait
  sleep 1
done

echo "✅ Burst traffic storm complete"
