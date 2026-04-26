import mongoose from "mongoose";

const ProgramSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    enum: ["Haldi", "Mehendi", "Sangeet", "Wedding", "Reception", "Other"] 
  },
  description: String,
  date: { type: Date, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  price: { type: Number, required: true, default: 0 },
  capacity: { type: Number, required: true },
  tickets_sold: { type: Number, default: 0 },
  images: [String]
});

const WeddingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  
  // The host or the family organizing it
  host_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // Cultural authentication
  cultural_background: String, // e.g., "Traditional Rajasthani Folk Wedding"

  // NEW: Linked Place Reference
  place_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Place"
  },
  
  // Location Data
  address: { type: String, required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },

  // THE CORE IMPROVEMENT: Multi-day programs
  programs: [ProgramSchema],

  // Pricing for the "Full Experience" (Bundle discount)
  full_package_price: { type: Number },
  
  amenities: [String], // e.g., "Traditional Food", "Turban Typing", "Henna"
  
  images: [{
    url: String,
    public_id: String
  }],

  // Verification & Admin (Unified Standard)
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true
  },
  adminFeedback: String,
  verified: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  license_url: { type: String, required: true },

  // Social Proof
  averageRating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 }

}, { timestamps: true });

WeddingSchema.index({ location: "2dsphere" });

export default mongoose.model("Wedding", WeddingSchema);