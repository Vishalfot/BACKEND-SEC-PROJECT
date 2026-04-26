import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
    product_name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    // Adding cultural context for your specific use case
    culturalStory: {
        type: String, 
        required: true 
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    // stock management (decrement logic happens in your Controller)
    stock: {
        type: Number,
        required: true,
        default: 1
    },
    // Array of images for a better shopping experience
    images: [{
        type: String,
        required: true
    }],
    category: {
        type: String,
        enum: ['Handicraft', 'Textile', 'Food', 'Art', 'Other'],
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Verification workflow (Unified Standard)
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true
    },
    adminFeedback: { type: String }, // Why was it rejected?

    // Legacy flags (Keep for backward compat, but sync with 'status')
    verified: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },

    // Ratings Summary (Calculated values for performance)
    averageRating: {
        type: Number,
        default: 0
    },
    numReviews: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Product = mongoose.model("Product", ProductSchema);
export { Product };