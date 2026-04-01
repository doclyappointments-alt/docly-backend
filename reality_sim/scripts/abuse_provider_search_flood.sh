#!/bin/bash

echo "🔥 PROVIDER SEARCH FLOOD SIMULATION"

URL="http://localhost:3000/search/providers?q=doctor"

for i in {1..300}; do
  curl -s -o /dev/null -w "%{http_code}\n" "$URL" &
done

wait
echo "✅ Provider search flood complete"
