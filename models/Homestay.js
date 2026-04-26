import mongoose from "mongoose";

const homestaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    
    // THE CULTURAL ELEMENT
    // Why stay here? (e.g., "3 generations of traditional potters", "Old Haveli vibe")
    cultural_experience: { type: String }, 
    host_bio: { type: String }, // Helps tourists connect with the local family

    price_per_night: { type: Number, required: true },
    
    // GEO LOCATION (Consistent with your Events/Gems)
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    address: { type: String, required: true },
    city: { type: String, required: true, lowercase: true, index: true },

    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String }, // For Cloudinary/S3 management
      },
    ],

    amenities: [{ type: String }], // e.g., "Home-cooked Satvik food", "Village tour"
    
    // CAPACITY & RULES
    max_guests: { type: Number, default: 2 },
    rooms_available: { type: Number, default: 1 },
    house_rules: { type: String },
    
    // BOOKING LOGIC
    // Simple way to handle "Stock" of nights
    booked_dates: [{ type: Date }], 

    // RATINGS (Consistent with your other models)
    averageRating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },

    // SUBMISSION & AUTHENTICATION
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    admin_note: { type: String },
    license_url: { type: String }, // Verification for local government permits
  },
  { timestamps: true }
);

// Indexes for fast searching
homestaySchema.index({ location: "2dsphere" });
homestaySchema.index({ price_per_night: 1 });

export default mongoose.model("Homestay", homestaySchema);