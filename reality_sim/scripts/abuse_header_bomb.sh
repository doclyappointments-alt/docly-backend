#!/bin/bash

echo "🔥 HEADER BOMBING SIMULATION"

URL="http://localhost:3000/search/providers?q=test"

# Create massive headers
BIG=$(head -c 16384 </dev/urandom | base64 | tr -d '\n')

for i in {1..50}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-Header-A: $BIG" \
    -H "X-Header-B: $BIG" \
    -H "X-Header-C: $BIG" \
    -H "X-Header-D: $BIG" \
    -H "X-Header-E: $BIG" \
    "$URL" &
done

wait
echo "✅ Header bombing complete"
