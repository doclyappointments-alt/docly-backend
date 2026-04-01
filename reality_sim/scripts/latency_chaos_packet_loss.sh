#!/usr/bin/env bash
source .env || true
set -euo pipefail

API=http://localhost:3000
DB_URL="${DATABASE_URL%%\?*}"

echo "Starting Latency Chaos — PACKET LOSS simulation"

# Setup
PROVEMAIL="prov_pkt_$(date +%s%N)@test.local"
PROVJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROVEMAIL\",\"password\":\"pass1234\",\"role\":\"PROVIDER\"}")
PROV_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PROVJSON")

psql -qAt "$DB_URL" -c \
"UPDATE \"Provider\" SET \"status\"='VERIFIED', \"verifiedAt\"=NOW(), \"verifiedByAdmin\"=1 
 WHERE id=(SELECT MAX(id) FROM \"Provider\");"

START_ISO=$(node -e 'console.log(new Date(Date.now()+60*60*1000).toISOString());')
END_ISO=$(node -e 'console.log(new Date(Date.now()+2*60*60*1000).toISOString());')

SLOTJSON=$(curl -s -X POST "$API/slots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROV_TOKEN" \
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"PacketLoss Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

PATEMAIL="pat_pkt_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

echo "Simulating packet loss via random connection drops"

for i in {1..10}; do
  if (( RANDOM % 3 == 0 )); then
    echo "💥 Drop $i"
    timeout 0.01 curl -s "$API/appointments" >/dev/null || true
  else
    CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$API/appointments" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $PAT_TOKEN" \
      -d "{\"slotId\":$SLOT_ID,\"title\":\"PktLoss Test $i\"}")
    echo "Request $i -> HTTP $CODE"
  fi
done

echo "DB check:"
psql "$DB_URL" -c "SELECT id,status FROM \"Appointment\" ORDER BY id DESC LIMIT 5;"

echo "DONE"
