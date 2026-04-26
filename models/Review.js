// const ReviewSchema = new mongoose.Schema({
//     product: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Product",
//         required: true
//     },
//     user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//         required: true
//     },
//     rating: { type: Number, required: true, min: 1, max: 5 },
//     comment: { type: String, required: true },
// }, { timestamps: true });

// export const Review = mongoose.model("Review", ReviewSchema);
import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
    // The user who wrote the review
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // THE DYNAMIC LINK (Polymorphic)
    // This stores the ID of the Product, Event, Wedding, or Homestay
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'onModel' // This tells Mongoose which collection to look at
    },

    // This stores the STRING of the model name
    onModel: {
        type: String,
        required: true,
        enum: ['Product', 'Event', 'Weddingplace', 'Homestay', 'Touristplace']
    },

    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },

    comment: {
        type: String,
        required: true,
        trim: true
    },

    // Cultural Authenticity vouching (Optional but cool for your project)
    isAuthentic: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Indexing for fast lookups
ReviewSchema.index({ relatedId: 1, onModel: 1 });

export const Review = mongoose.model("Review", ReviewSchema);