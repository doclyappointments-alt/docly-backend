import { z } from 'zod';

export const createReviewSchema = z.object({
  appointmentId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional()
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  review: z.string().max(1000).optional()
});

export const moderateReviewSchema = z.object({
  status: z.enum(['APPROVED', 'HIDDEN', 'REMOVED'])
});
