import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true // One user = One profile
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
  contact: { type: String }
});

export const Profile = mongoose.model("Profile", profileSchema);