import cron from "node-cron";
import prisma from "../utils/prismaClient.js";
import { logger } from "../utils/logger.js";

const log = logger.child({ cron: "expire-pending-appointments" });

export function startExpirePendingAppointmentsCron() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const expired = await tx.appointment.findMany({
          where: {
            status: "PENDING",
            createdAt: {
              lt: new Date(Date.now() - 20 * 60 * 1000),
            },
          },
          select: { id: true, slotId: true },
        });

        if (!expired.length) return 0;

        const ids = expired.map((a) => a.id);
        const slotIds = expired.map((a) => a.slotId);

        await tx.appointment.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
          },
        });

        await tx.appointmentSlot.updateMany({
          where: { id: { in: slotIds } },
          data: { booked: false },
        });

        return expired.length;
      });

      if (result > 0) {
        log.info({ expired: result }, "Expired pending appointments");
      }
    } catch (err) {
      log.error({ err }, "Expire cron failed");
    }
  });
}
