// src/modules/slots/availabilityException.util.ts

import { AvailabilityException } from '@prisma/client';

/**
 * Returns true if a slot should be BLOCKED by availability exceptions.
 *
 * Rules:
 * - If NO exceptions exist → allow slot
 * - If ANY exception exists for the date:
 *   - isAvailable = false
 *     - no start/end → block full day
 *     - with start/end → block overlapping window
 *   - isAvailable = true
 *     - allow ONLY inside [start, end]
 *     - missing window → deny defensively
 */
export function isSlotBlockedByExceptions(
  slotStart: Date,
  slotEnd: Date,
  exceptions: AvailabilityException[],
): boolean {
  if (!exceptions.length) return false;

  for (const exception of exceptions) {
    const { isAvailable, start, end } = exception;

    // ❌ Hard block — full day
    if (!isAvailable && !start && !end) {
      return true;
    }

    // ❌ Partial block — overlapping window
    if (!isAvailable && start && end) {
      const overlaps = slotStart < end && slotEnd > start;
      if (overlaps) return true;
    }

    // ✅ Open override — allow ONLY inside window
    if (isAvailable) {
      // Defensive deny if window is malformed
      if (!start || !end) return true;

      const insideWindow =
        slotStart >= start && slotEnd <= end;

      if (!insideWindow) return true;
    }
  }

  return false;
}
