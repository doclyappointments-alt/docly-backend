#!/bin/bash

API="http://localhost:3000"
LOG="reality_sim/logs/soak_baseline_$(date +%Y%m%d_%H%M%S).log"

echo "Starting baseline soak test..." | tee -a "$LOG"

while true; do
  TS=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$TS] New cycle" | tee -a "$LOG"

  # register patient
  PEMAIL="p_$(date +%s%N)@test.local"
  PTOKEN=$(curl -s -X POST $API/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}" | jq -r '.accessToken')

  # register provider
  PROVEMAIL="prov_$(date +%s%N)@test.local"
  PROVTOKEN=$(curl -s -X POST $API/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}" | jq -r '.accessToken')

  # provider create slot
  SLOT=$(curl -s -X POST $API/slots \
    -H "Authorization: Bearer $PROVTOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"start\":\"$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)\",\"end\":\"$(date -u -d '+2 hour' +%Y-%m-%dT%H:%M:%SZ)\"}")

  SLOT_ID=$(echo "$SLOT" | jq -r '.id')

  # patient book
  BOOK=$(curl -s -X POST $API/appointments \
    -H "Authorization: Bearer $PTOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"slotId\":$SLOT_ID}")

  APPT_ID=$(echo "$BOOK" | jq -r '.id')

  # cancel
  curl -s -X POST $API/appointments/$APPT_ID/cancel \
    -H "Authorization: Bearer $PTOKEN" >> "$LOG"

  sleep 2
done
