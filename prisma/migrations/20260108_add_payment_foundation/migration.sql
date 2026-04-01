-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."google_events" DROP CONSTRAINT IF EXISTS "google_events_providerId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."google_events" DROP CONSTRAINT IF EXISTS "google_events_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."Payment" DROP CONSTRAINT IF EXISTS "Payment_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."Payment" DROP CONSTRAINT IF EXISTS "Payment_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."PaymentAuditLog" DROP CONSTRAINT IF EXISTS "PaymentAuditLog_paymentId_fkey";

-- DropTable
DROP TABLE IF EXISTS "public"."Payment";

-- DropTable
DROP TABLE IF EXISTS "public"."PaymentAuditLog";

-- DropEnum
DROP TYPE IF EXISTS "public"."PaymentStatus";

-- DropEnum
DROP TYPE IF EXISTS "public"."PaymentAuditAction";

-- AddForeignKey
-- DISABLED: schema drift - providerId no longer exists
-- ALTER TABLE IF EXISTS "public"."google_events" ADD CONSTRAINT "google_events_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- DISABLED: schema drift - userId no longer exists
-- ALTER TABLE IF EXISTS "public"."google_events" ADD CONSTRAINT "google_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

