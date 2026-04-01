import prisma from "../../common/utils/prismaClient.js";
import {
  PaymentStatus,
  PaymentAuditAction,
} from "@prisma/client";
import { recordPaymentAudit } from "./payment.audit.js";

export async function createPayment({
  appointmentId,
  userId,
  amount,
  provider,
  providerRef,
  currency = "GBP",
}: {
  appointmentId: number;
  userId: number;
  amount: number;
  provider: string;
  providerRef: string;
  currency?: string;
}) {
  const payment = await prisma.payment.create({
    data: {
      appointmentId,
      userId,
      amount,
      currency,
      provider,
      providerRef,
      status: PaymentStatus.PENDING,
    },
  });

  await recordPaymentAudit(
    payment.id,
    PaymentAuditAction.CREATED,
    null,
    PaymentStatus.PENDING,
    { appointmentId, provider }
  );

  return payment;
}

export async function updatePaymentStatus({
  paymentId,
  newStatus,
  meta,
}: {
  paymentId: number;
  newStatus: PaymentStatus;
  meta?: Record<string, unknown>;
}) {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!existing) {
    throw new Error("Payment not found");
  }

  if (existing.status === newStatus) {
    return existing;
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: newStatus },
  });

  await recordPaymentAudit(
    paymentId,
    mapStatusToAuditAction(newStatus),
    existing.status,
    newStatus,
    meta
  );

  return updated;
}

console.log("REFUND_SERVICE_ENTER");
export async function refundPayment({
  paymentId,
  refundAmount,
  meta,
}: {
  paymentId: number;
  refundAmount?: number;
  meta?: Record<string, unknown>;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  const isPartial =
    typeof refundAmount === "number" && refundAmount < payment.amount;

  const newStatus = isPartial
    ? PaymentStatus.PARTIALLY_REFUNDED
    : PaymentStatus.REFUNDED;

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: newStatus },
  });

  await recordPaymentAudit(
    paymentId,
    isPartial
      ? PaymentAuditAction.PARTIAL_REFUND
      : PaymentAuditAction.REFUNDED,
    payment.status,
    newStatus,
    meta ?? { refundAmount }
  );

  return updated;
}

function mapStatusToAuditAction(status: PaymentStatus): PaymentAuditAction {
  switch (status) {
    case PaymentStatus.CONFIRMED:
      return PaymentAuditAction.CONFIRMED;
    case PaymentStatus.FAILED:
      return PaymentAuditAction.FAILED;
    case PaymentStatus.REFUNDED:
      return PaymentAuditAction.REFUNDED;
    case PaymentStatus.PARTIALLY_REFUNDED:
      return PaymentAuditAction.PARTIAL_REFUND;
    default:
      return PaymentAuditAction.CREATED;
  }
}
