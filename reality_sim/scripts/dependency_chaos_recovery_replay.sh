#!/usr/bin/env bash
set -euo pipefail

set -a
source .env
set +a

PSQL_URL="${DATABASE_URL%%\?*}"
LOG="reality_sim/logs/dependency_chaos_recovery_replay_$(date +%Y%m%d_%H%M%S).log"

echo "Starting Dependency Chaos — Recovery replay" | tee -a "$LOG"

IDS=$(psql "$PSQL_URL" -t -A -c "
SELECT id FROM \"Appointment\"
WHERE status='CONFIRMED'
AND (\"reminder24Sent\"=false OR \"reminder1hSent\"=false)
LIMIT 5;
")

echo "Replay candidates: $IDS" | tee -a "$LOG"

for ID in $IDS; do
  echo "Re-enqueue reminders for appointment $ID" | tee -a "$LOG"
  node -e "
  (async () => {
    const mod = await import('./dist/common/queues/reminderQueue.js');
    await mod.enqueueRemindersForAppointment({ appointmentId: $ID, appointmentDate: new Date() });
    console.log('OK $ID');
    process.exit(0);
  })().catch(e => { console.error('ERR $ID', e); process.exit(1); });
  "
done

echo "DONE" | tee -a "$LOG"
