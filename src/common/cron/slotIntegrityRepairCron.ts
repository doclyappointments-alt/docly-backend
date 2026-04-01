import cron from "node-cron";
import prisma from "../utils/prismaClient.js";
import { logger } from "../utils/logger.js";

const log = logger.child({ cron: "slot-integrity-repair" });

export function startSlotIntegrityRepairCron() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const slots = await prisma.appointmentSlot.findMany({
        select: { id: true, booked: true }
      });

      let fixed = 0;

      for (const slot of slots) {
        const active = await prisma.appointment.findFirst({
          where: {
            slotId: slot.id,
            status: { in: ["PENDING", "CONFIRMED"] }
          },
          select: { id: true }
        });

        const shouldBeBooked = !!active;

        if (slot.booked !== shouldBeBooked) {
          await prisma.appointmentSlot.update({
            where: { id: slot.id },
            data: { booked: shouldBeBooked }
          });

          fixed++;
        }
      }

      if (fixed > 0) {
        log.warn({ fixed }, "Repaired slot integrity drift");
      }

    } catch (err) {
      log.error({ err }, "Slot integrity repair cron failed");
    }
  });
}
