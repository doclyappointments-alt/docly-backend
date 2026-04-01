#!/usr/bin/env bash
set -euo pipefail
source .env || true

API="http://localhost:3000"
DB_URL="${DATABASE_URL%%\?*}"

echo "Starting Latency Chaos — INBOUND API DELAY"

# Create slot
SLOT_ID=$(psql -qAt "$DB_URL" -c "
INSERT INTO \"AppointmentSlot\" (\"start\",\"end\",\"providerId\",\"booked\")
VALUES (NOW()+interval '1 hour', NOW()+interval '2 hours', 1, false)
RETURNING id;
")
echo "SlotId=$SLOT_ID"

# Register patient
EMAIL="lat_in_$(date +%s%N)@test.local"
RESP=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"pass1234\",\"role\":\"PATIENT\"}")

TOKEN=$(echo "$RESP" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(j.accessToken)')
USER_ID=$(echo "$RESP" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(j.user.id)')

echo "UserId=$USER_ID"

echo "⏳ Simulating inbound API delays"

for d in 0.2 0.5 1 2 3; do
  echo "Delay ${d}s"
  sleep "$d"

  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API/appointments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"slotId\":$SLOT_ID,\"title\":\"Inbound Latency Chaos\"}")

  echo "HTTP $CODE"
done

echo "DB check:"
psql "$DB_URL" -c "SELECT id,status FROM \"Appointment\" ORDER BY id DESC LIMIT 5;"

echo "DONE"
