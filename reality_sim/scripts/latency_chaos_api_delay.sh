#!/usr/bin/env bash
source .env || true
set -euo pipefail

API=http://localhost:3000
DB_URL="${DATABASE_URL%%\?*}"

echo "Starting Latency Chaos — API delay injection"

# Create provider + slot + patient
PROVEMAIL="prov_lat_$(date +%s%N)@test.local"
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
  -d "{\"start\":\"$START_ISO\",\"end\":\"$END_ISO\",\"title\":\"Latency Slot\"}")
SLOT_ID=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.slot.id);' "$SLOTJSON")

PATEMAIL="pat_lat_$(date +%s%N)@test.local"
PATJSON=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATEMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")
PAT_TOKEN=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.accessToken);' "$PATJSON")

echo "Injecting artificial latency (curl client-side delay simulation)"

for d in 200 500 1000 2000; do
  echo "⏱ Delay ${d}ms"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    --limit-rate 5k \
    -X POST "$API/appointments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $PAT_TOKEN" \
    -d "{\"slotId\":$SLOT_ID,\"title\":\"Latency Test ${d}\"}")
  echo "HTTP $CODE"
done

echo "DB check:"
psql "$DB_URL" -c "SELECT id,status FROM \"Appointment\" ORDER BY id DESC LIMIT 3;"

echo "DONE"
