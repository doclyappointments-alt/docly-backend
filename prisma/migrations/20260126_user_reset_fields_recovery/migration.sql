-- Recovery migration: add missing password reset fields to User

ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;

ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiry" TIMESTAMP;
