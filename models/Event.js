
import mongoose from "mongoose";

const EventSchema = new mongoose.Schema({
  event_name: {
    type: String,
    required: true
  },
  
  // ❌ YOUR CURRENT: mongoose.Schema.Types.ObjectId
  // ✅ FIXED: String
  description: {
    type: String,  // CHANGED FROM ObjectId
    required: true
  },
  
  address: {
    type: String,
    required: true
  },
  
  // GEO LOCATION
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],  // [longitude, latitude]
      required: true
    }
  },
  
  event_date: {
    type: Date,
    required: true
  },
  
  start_time: {
    type: String,  // e.g., "18:00"
    required: true
  },
  
  end_time: {
    type: String,  // e.g., "21:00"
    required: true
  },
  
  avatar: String,
  
  cultural_weight: {
    type: Number,
    default: 0.8  // Higher than regular places for scoring
  },
  
  experience_type: {
    type: String,
    enum: ["festival", "local_experience", "workshop", "heritage_walk"],
    required: true
  },
  
  category: {
    type: String,
    enum: ['Food', 'Dance', 'Music', 'Craft', 'Other'],
    default: 'Other'
  },

  tags: [String],
  
  price: {
    type: Number,
    default: 0
  },
  booking_required: {
    type: Boolean,
    default: false
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Verification workflow (Unified Standard)
  verificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true
  },
  adminFeedback: { type: String },
  verified: { type: Boolean, default: false }, 
  rejected: { type: Boolean, default: false },

  license_url: { type: String, required: true },
  tickets_sold: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  organizer_name: { type: String, required: true },

  // Event State (different from verification)
  status: {
    type: String,
    enum: ["upcoming", "ongoing", "completed", "cancelled"],
    default: "upcoming"
  },
  capacity: {
    type: Number,
    required: true // Now required to manage booking
  },
  max_tickets_per_person: {
    type: Number,
    default: 5 // Limits how many tickets one user can buy
  },
  ticket_status: {
    type: String,
    enum: ["available", "filling_fast", "sold_out"],
    default: "available"
  },
}, { timestamps: true });

EventSchema.index({ location: "2dsphere" });
EventSchema.index({ event_date: 1 });

export default mongoose.model("Event", EventSchema);
