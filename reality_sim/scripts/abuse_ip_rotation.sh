#!/bin/bash

echo "🔥 PROXY / IP ROTATION SIMULATION"

URL="http://localhost:3000/auth/login"

IPS=(
"1.1.1.1"
"8.8.8.8"
"9.9.9.9"
"4.4.4.4"
"208.67.222.222"
"185.199.108.153"
"140.82.112.3"
)

for round in {1..50}; do
  for ip in "${IPS[@]}"; do
    curl -s -o /dev/null -w "%{http_code}\n" \
      -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "X-Forwarded-For: $ip" \
      -H "X-Real-IP: $ip" \
      -d "{\"email\":\"rot@$ip.com\",\"password\":\"wrongpass\"}" &
  done
done

wait
echo "✅ IP rotation simulation complete"
