// src/modules/reminders/reminder.service.ts

import prisma from "../../common/utils/prismaClient.js";
import { logger } from "../../common/utils/logger.js";
import { sendNotification } from "../notifications/notification.service.js";

type ReminderType = "24h" | "1h";

export async function sendReminder(
  appointmentId: number,
  type: ReminderType,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      user: true,
      provider: true,
    },
  });

  if (!appointment) {
    logger.warn(
      { appointmentId },
      "Reminder skipped: appointment not found",
    );
    return;
  }

  if (appointment.status !== "CONFIRMED") {
    logger.info(
      { appointmentId, status: appointment.status },
      "Reminder skipped: appointment not confirmed",
    );
    return;
  }

  if (type === "24h" && appointment.reminder24Sent) return;
  if (type === "1h" && appointment.reminder1hSent) return;

  const message =
    type === "24h"
      ? `Reminder: You have an appointment with ${appointment.provider.displayName} in 24 hours.`
      : `Reminder: Your appointment with ${appointment.provider.displayName} is in 1 hour.`;

  // Send notifications
  await sendNotification({
    userId: appointment.userId,
    channel: "SMS",
    message,
  });

  await sendNotification({
    userId: appointment.userId,
    channel: "PUSH",
    message,
  });

  // Mark reminder as sent
  await prisma.appointment.update({
    where: { id: appointmentId },
    data:
      type === "24h"
        ? { reminder24Sent: true }
        : { reminder1hSent: true },
  });

  logger.info(
    { appointmentId, type },
    "Reminder sent successfully",
  );
}
