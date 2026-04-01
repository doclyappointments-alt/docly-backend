ALTER TABLE "google_events"
  ADD COLUMN IF NOT EXISTS "id" SERIAL;

ALTER TABLE "google_events"
  ADD COLUMN IF NOT EXISTS "providerId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'google_events_pkey'
  ) THEN
    ALTER TABLE "google_events"
      ADD CONSTRAINT "google_events_pkey" PRIMARY KEY ("id");
  ELSE
    ALTER TABLE "google_events" DROP CONSTRAINT "google_events_pkey";
    ALTER TABLE "google_events" ADD CONSTRAINT "google_events_pkey" PRIMARY KEY ("id");
  END IF;
END
$$;

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
