// src/modules/reviews/review.model.ts

export interface CreateReviewDTO {
  providerId: number;
  rating: number; // 1–5
  review?: string;
}

export interface UpdateReviewDTO {
  rating?: number; // 1–5
  review?: string;
}
