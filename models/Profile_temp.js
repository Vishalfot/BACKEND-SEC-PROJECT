import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ["Tourist", "Local", "Shopper"], // Matched to User model exactly
    required: true
  },
  verification_status: {
    type: String,
    enum: ["not_required", "pending", "approved", "rejected"],
    default: "not_required"
  },
  name: { type: String, trim: true },
  about: { type: String },
  avatar: { type: String },

  // Tourist & Shopper Specific
  country: { type: String },
  interests: { type: [String] }, // Changed to Array for better filtering/Discovery Engine

  // Local Specific
  city: { type: String },
  experience: { type: Number },
  contact: { type: String },
  id_document: { type: String },

  // Shopper Specific
  preferredCategories: { type: [String] } // e.g., ["Handicrafts", "Textiles"]
}, { timestamps: true });

export const Profile = mongoose.model("Profile", profileSchema);