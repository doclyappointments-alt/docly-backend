import { z } from "zod";

export const createPaymentSchema = z.object({
  appointmentId: z.number(),
  amount: z.number().min(0),
  paymentType: z.enum(["CASH", "CARD", "PAYPAL"]),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]).optional(),
});

export const updatePaymentSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]),
});
