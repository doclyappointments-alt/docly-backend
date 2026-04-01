import prisma from "../../common/utils/prismaClient.js";
import {
  PaymentStatus,
  PaymentAuditAction,
  Prisma,
} from "@prisma/client";

/**
 * Append-only audit log for payment state changes.
 * NEVER update or delete audit rows.
 */
export async function recordPaymentAudit(
  paymentId: number,
  action: PaymentAuditAction,
  oldStatus: PaymentStatus | null,
  newStatus: PaymentStatus | null,
  meta?: Record<string, unknown>
) {
  console.log("AUDIT_WRITE", { paymentId, action, oldStatus, newStatus, meta });
  return prisma.paymentAuditLog.create({
    data: {
      paymentId,
      action,
      oldStatus,
      newStatus,
      meta: meta as Prisma.InputJsonValue | undefined,
    },
  });
}
