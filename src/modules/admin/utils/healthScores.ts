// src/modules/admin/utils/healthScores.ts

export type ProviderHealthFactors = {
  hasSlots: boolean;
  hasConflicts: boolean;
  googleSynced: boolean;
  bookingsCount: number;
  cancellationsCount: number;
  hasProfile: boolean;
};

export const calculateProviderHealthScore = (factors: ProviderHealthFactors): number => {
  let score = 50; // base

  if (!factors.hasSlots) score -= 15;
  if (factors.hasConflicts) score -= 10;
  if (!factors.googleSynced) score -= 5;
  if (!factors.hasProfile) score -= 10;

  if (factors.bookingsCount === 0) score -= 10;
  else if (factors.bookingsCount > 20) score += 10;

  const cancelRate =
    factors.bookingsCount > 0 ? factors.cancellationsCount / factors.bookingsCount : 0;

  if (cancelRate > 0.5) score -= 15;
  else if (cancelRate < 0.1 && factors.bookingsCount >= 5) score += 5;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
};
