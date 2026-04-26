import mongoose from "mongoose";

const TouristplaceSchema = new mongoose.Schema({
    tourist_place_name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    // Why is this important? (e.g., "Architecture", "Street Food", "Quiet Spot")
    significance: {
        type: String,
        required: true
    },
    // GEO LOCATION (The most important update)
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    address: {
        type: String, // Readable address for the UI
        required: true
    },
    opening_time: { type: String }, // e.g., "09:00 AM"
    closing_time: { type: String }, // e.g., "06:00 PM"
    
    // Multiple photos are better for discovery
    images: [{
        url: String,
        public_id: String
    }],

    category: {
        type: String,
        enum: ["Heritage", "Nature", "Religious", "Market", "Food Stall", "Secret Spot"],
        default: "Secret Spot"
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
    adminFeedback: { type: String },
    verified: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    
    // How many other tourists "vouched" for this spot?
    upvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // Performance metrics for your discovery engine
    averageRating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 }

}, { timestamps: true });

// Indexing for "Nearby" search
TouristplaceSchema.index({ location: "2dsphere" });

const Touristplace = mongoose.model("Touristplace", TouristplaceSchema);
export { Touristplace };