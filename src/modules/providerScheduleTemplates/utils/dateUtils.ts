// src/modules/providerScheduleTemplates/utils/dateUtils.ts

export function nextMondayUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diff = (1 + 7 - day) % 7;

  const d = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + diff,
    0, 0, 0, 0
  ));

  return d;
}
