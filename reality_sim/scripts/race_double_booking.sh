#!/bin/bash
set -a
source .env
set +a

# strip prisma params for psql compatibility
PSQL_URL="${DATABASE_URL%%\?*}"

API="http://localhost:3000"
LOG="reality_sim/logs/race_double_booking_$(date +%Y%m%d_%H%M%S).log"

echo "Starting race condition test..." | tee -a "$LOG"

# provider
PROVEMAIL="prov_race_$(date +%s%N)@test.local"
PROVTOKEN=$(curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")

echo "Provider register response: $PROVTOKEN" | tee -a "$LOG"

# ADMIN VERIFY PROVIDER
psql "$PSQL_URL" -c "UPDATE \"Provider\"
SET \"status\"='VERIFIED',
\"verifiedAt\"=NOW(),
\"verifiedByAdmin\"=1
WHERE id=(SELECT MAX(id) FROM \"Provider\");"

sleep 0.2

TOKEN=$(echo "$PROVTOKEN" | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Provider token failed" | tee -a "$LOG"
  exit 1
fi

# create slot
SLOT_RESP=$(curl -s -X POST $API/slots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"start\":\"$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)\",\"end\":\"$(date -u -d '+2 hour' +%Y-%m-%dT%H:%M:%SZ)\"}")

echo "Slot response: $SLOT_RESP" | tee -a "$LOG"

SLOT_ID=$(echo "$SLOT_RESP" | jq -r '.slot.id')

if [ "$SLOT_ID" = "null" ] || [ -z "$SLOT_ID" ]; then
  echo "❌ Slot creation failed — aborting race test" | tee -a "$LOG"
  exit 1
fi

echo "Slot ID: $SLOT_ID" | tee -a "$LOG"

# patients
P1="p1_$(date +%s%N)@test.local"
P2="p2_$(date +%s%N)@test.local"

T1=$(curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$P1\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}" | jq -r '.accessToken')

T2=$(curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$P2\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}" | jq -r '.accessToken')

# parallel booking
(
curl -s -X POST $API/appointments \
  -H "Authorization: Bearer $T1" \
  -H "Content-Type: application/json" \
-d "{\"slotId\":$SLOT_ID,\"title\":\"Race booking\"}" >> "$LOG"
) &

(
curl -s -X POST $API/appointments \
  -H "Authorization: Bearer $T2" \
  -H "Content-Type: application/json" \
-d "{\"slotId\":$SLOT_ID,\"title\":\"Race booking\"}" >> "$LOG"
) &

wait

echo "Race test completed" | tee -a "$LOG"
