import { Review } from "../models/Review.js";
import { Booking } from "../models/Booking.js";
import { Product } from "../models/Product.js";
import Event from "../models/Event.js";
import Weddingplace from "../models/weddings.js";
import Homestay from "../models/Homestay.js";
import User from "../models/User.js";
import { Notification } from "../models/Notification.js";

/**
 * ── ADD VERIFIED REVIEW ──
 * Only allowed if user has a completed booking for the item.
 */
export const addReview = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const { relatedId, onModel, rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }

        // 1. VERIFIED PURCHASE CHECK
        const hasBooking = await Booking.findOne({
            user: userId,
            relatedId: relatedId,
            paymentStatus: 'completed'
        });

        if (!hasBooking) {
            return res.status(403).json({ error: "You can only review items you have booked and paid for." });
        }

        // 2. DUPLICATE REVIEW CHECK
        const existingReview = await Review.findOne({ user: userId, relatedId: relatedId });
        if (existingReview) {
            return res.status(400).json({ error: "You have already reviewed this item." });
        }

        // 3. CREATE REVIEW
        const review = new Review({
            user: userId,
            relatedId,
            onModel,
            rating,
            comment
        });
        await review.save();

        // 4. UPDATE AVERAGE RATING & NUM REVIEWS
        let Model;
        if (onModel === 'Product') Model = Product;
        else if (onModel === 'Event') Model = Event;
        else if (onModel === 'Weddingplace') Model = Weddingplace;
        else if (onModel === 'Homestay') Model = Homestay;

        if (Model) {
            const item = await Model.findById(relatedId);
            if (item) {
                const reviews = await Review.find({ relatedId });
                const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
                item.averageRating = (totalRating / reviews.length).toFixed(1);
                item.numReviews = reviews.length;
                await item.save();

                // Notification for Local if rating is low
                if (item.averageRating < 3) {
                    const localId = item.createdBy || item.host_user;
                    if (localId) {
                        const lowRatingNote = new Notification({
                            recipient: localId,
                            title: "Improvement Needed! ⚠️",
                            message: `Your item '${item.product_name || item.event_name || item.title}' has received a low rating (${item.averageRating}). Please check the feedback.`,
                            type: "system"
                        });
                        await lowRatingNote.save();
                    }
                }
            }
        }

        // 5. REWARD COINS (50 coins for a verified review)
        await User.findByIdAndUpdate(userId, { $inc: { coins: 50 } });

        res.status(201).json({
            success: true,
            message: "Review added! You earned 50 loyalty coins. 🪙",
            review,
            newAvgRating: item?.averageRating || null,
            newNumReviews: item?.numReviews || null
        });

    } catch (error) {
        console.error("Review Error:", error);
        res.status(500).json({ error: "Failed to add review." });
    }
};

/**
 * ── GET REVIEWS FOR ITEM ──
 */
export const getReviewsForItem = async (req, res) => {
    try {
        const { id } = req.params;
        const reviews = await Review.find({ relatedId: id })
            .populate("user", "username avatar")
            .sort("-createdAt");
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch reviews." });
    }
};

/**
 * ── ADMIN: DELETE REVIEW ──
 */
export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findByIdAndDelete(id);
        if (!review) return res.status(404).json({ error: "Review not found." });

        // Optionally recalculate rating here too...
        
        res.status(200).json({ message: "Review deleted by moderator." });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete review." });
    }
};

/**
 * ── ADMIN: GET ALL REVIEWS ──
 */
export const getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find({})
            .populate("user", "username email avatar")
            .sort("-createdAt");
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch all reviews." });
    }
};
