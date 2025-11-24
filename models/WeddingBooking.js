import mongoose from "mongoose";

const weddingBookingSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  weddingPlace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Weddingplace', // Must match your Wedding Model name
    required: true 
  },
  bookingDate: { type: Date, default: Date.now },
  status: { type: String, default: 'Confirmed' }
});

export const WeddingBooking = mongoose.model("WeddingBooking", weddingBookingSchema);