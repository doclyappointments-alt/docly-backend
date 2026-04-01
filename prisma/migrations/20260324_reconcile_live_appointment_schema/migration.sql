ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "slotId" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminder24Sent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminder1hSent" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_slotId_key"
  ON "Appointment"("slotId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Appointment_slotId_fkey'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_slotId_fkey"
      FOREIGN KEY ("slotId") REFERENCES "AppointmentSlot"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
