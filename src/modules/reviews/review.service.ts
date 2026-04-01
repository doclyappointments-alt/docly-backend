// src/modules/reviews/review.service.ts
import prisma from "../../common/utils/prismaClient.js";

export const createReview = async (userId: number, appointmentId: number, providerId: number, rating: number, review?: string) => {
  // 🔒 Enforce post-appointment rule (COMPLETED only)
  const completedAppointment = await prisma.appointment.findFirst({ where: { id: appointmentId, userId, providerId, status: "COMPLETED" } });

  if (!completedAppointment) {
    throw new Error(
      "You can only review a provider after a completed appointment",
    );
  }

  // 1. Check if user already reviewed this provider
  const existing = await prisma.review.findUnique({ where: { userId_providerId: { userId, providerId } } });

  if (existing) {
    throw new Error("You have already reviewed this provider");
  }

  // 2. Create review
  const created = await prisma.review.create({
    data: { userId, providerId, rating, review },
  });

  // 3. Recalculate provider rating
  await recalcProviderRating(providerId);

  return created;
};

export const updateReview = async (
  reviewId: number,
  userId: number,
  rating?: number,
  review?: string,
) => {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });

  if (!existing) throw new Error("Review not found");

  if (existing.userId !== userId) {
    throw new Error("You cannot edit this review");
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { rating, review },
  });

  await recalcProviderRating(existing.providerId);

  return updated;
};

export const deleteReview = async (reviewId: number, userId: number) => {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });

  if (!existing) throw new Error("Review not found");

  // owner OR admin can delete
  const isAdmin = await prisma.user.findFirst({
    where: { id: userId, role: "ADMIN" },
  });

  if (existing.userId !== userId && !isAdmin) {
    throw new Error("Not allowed");
  }

  await prisma.review.delete({ where: { id: reviewId } });

  await recalcProviderRating(existing.providerId);
};

export const getProviderReviews = async (providerId: number) => {
  return prisma.review.findMany({
    where: { providerId },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ----------------------------------
// Recalculate rating for provider
// ----------------------------------
const recalcProviderRating = async (providerId: number) => {
  const reviews = await prisma.review.findMany({
    where: { providerId },
  });

  if (reviews.length === 0) {
    return prisma.provider.update({
      where: { id: providerId },
      data: { ratingAverage: 0, ratingCount: 0 },
    });
  }

  const count = reviews.length;
  const avg = reviews.reduce((a: number, r: any) => a + r.rating, 0) / count;

  await prisma.provider.update({
    where: { id: providerId },
    data: {
      ratingAverage: avg,
      ratingCount: count,
    },
  });
};
