// src/modules/reviews/review.controller.ts
import { Request, Response } from "express";
import * as ReviewService from "./review.service.js";

export const createReview = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { appointmentId, providerId, rating, review } = req.body;

    const created = await ReviewService.createReview(userId, appointmentId, providerId, rating, review);

    return res.status(201).json(created);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const reviewId = Number(req.params.id);
    const { rating, review } = req.body;

    const updated = await ReviewService.updateReview(
      reviewId,
      userId,
      rating,
      review,
    );

    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const reviewId = Number(req.params.id);

    await ReviewService.deleteReview(reviewId, userId);
    return res.json({ message: "Review deleted" });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const getProviderReviews = async (req: Request, res: Response) => {
  try {
    const providerId = Number(req.params.providerId);
    const reviews = await ReviewService.getProviderReviews(providerId);
    return res.json(reviews);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};
