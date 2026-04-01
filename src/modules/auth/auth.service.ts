// src/modules/auth/auth.service.ts
import prisma from "../../common/utils/prismaClient.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Request password reset (silent success)
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // silent fail

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const expiry = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetTokenExpiry: expiry,
    },
  });

  // TODO: send email
  // DEV ONLY: never print tokens in production
  if (process.env.NODE_ENV !== "production") {
    console.log(`[PASSWORD RESET] Token for ${email}: ${rawToken}`);
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const hashedToken = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    const err: any = new Error("Invalid or expired reset token");
    err.status = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    },
  });
}
