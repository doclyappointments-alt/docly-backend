#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

PSQL_URL="${DATABASE_URL%%\?*}"

psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "
WITH expired AS (
  SELECT id, \"slotId\"
  FROM \"Appointment\"
  WHERE status = 'PENDING'
    AND \"createdAt\" < NOW() - INTERVAL '20 minutes'
),
updated AS (
  UPDATE \"Appointment\"
  SET status = 'CANCELLED',
      \"cancelledAt\" = NOW()
  WHERE id IN (SELECT id FROM expired)
  RETURNING \"slotId\"
)
UPDATE \"AppointmentSlot\"
SET booked = false
WHERE id IN (SELECT \"slotId\" FROM updated);
"

echo \"✅ Expiry sweep complete.\"
