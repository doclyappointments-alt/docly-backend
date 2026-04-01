// src/modules/reviews/review.routes.ts
import { Router } from "express";
import * as ReviewController from "./review.controller.js";
import { authenticate } from "../../common/middleware/auth.js";
import { validate } from "../../common/middleware/validate.js";
import { createReviewSchema, updateReviewSchema } from "./review.schema.js";

const router = Router();

router.post(
  "/",
  authenticate,
  validate(createReviewSchema),
  ReviewController.createReview,
);

router.patch(
  "/:id",
  authenticate,
  validate(updateReviewSchema),
  ReviewController.updateReview,
);

router.delete("/:id", authenticate, ReviewController.deleteReview);
router.get("/provider/:providerId", ReviewController.getProviderReviews);

export default router;
