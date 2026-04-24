import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true // One user = One profile
  },
  role: {
    type: String,
    enum: ["tourist", "local", "Shopper"],
    required: true
  },
  verification_status: {
    type: String,
    enum: ["not_required", "pending", "approved", "rejected"],
    default: "not_required"
  },
  // Common Fields
  name: { type: String },
  about: { type: String },
  avatar: { type: String }, // Default placeholder

  // Tourist Specific
  country: { type: String },
  interests: { type: String }, // Can be comma separated string like "Art, Food, History"

  // Local Specific
  city: { type: String },
  experience: { type: Number }, // Years of experience
  contact: { type: String },
  id_document: { type: String }
});

export const Profile = mongoose.model("Profile", profileSchema);