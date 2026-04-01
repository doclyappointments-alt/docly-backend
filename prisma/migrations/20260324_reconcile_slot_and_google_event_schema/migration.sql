ALTER TABLE "AppointmentSlot"
  ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "google_events"
  ADD COLUMN IF NOT EXISTS "providerId" INTEGER;

ALTER TABLE "google_events"
  ALTER COLUMN "summary" DROP NOT NULL;

ALTER TABLE "google_events"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "google_events_eventId_providerId_key"
  ON "google_events"("eventId", "providerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'google_events_providerId_fkey'
  ) THEN
    ALTER TABLE "google_events"
      ADD CONSTRAINT "google_events_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
