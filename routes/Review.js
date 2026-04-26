import express from "express";
import { addReview, getReviewsForItem, deleteReview, getAllReviews } from "../Controllers/Review.js";
import authentication from "../middleware/authentication.js";
import isAdmin from "../middleware/isAdmin.js";

const router = express.Router();

router.post("/add", authentication, addReview);
router.get("/:id", getReviewsForItem);

// Admin moderation
router.get("/admin/all", authentication, isAdmin, getAllReviews);
router.delete("/admin/:id", authentication, isAdmin, deleteReview);

export default router;
