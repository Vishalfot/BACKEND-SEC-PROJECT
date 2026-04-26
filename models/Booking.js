import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'category'
  },
  category: {
    type: String,
    required: true,
    enum: ['Event', 'Product', 'Weddingplace', 'Homestay']
  },
  // --- COIN & PRICING SYSTEM ---
  originalAmount: { type: Number, required: true },
  couponCode: { type: String, default: null },
  couponDiscount: { type: Number, default: 0 },
  coinsUsed: { type: Number, default: 0 },
  coinValueDiscount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // --- CATEGORY SPECIFIC ---
  selectedPrograms: [{
    programName: String,
    priceAtTimeOfBooking: Number
  }],
  isFullWeddingPackage: { type: Boolean, default: false },
  quantity: { type: Number, default: 1 },
  checkIn: Date,
  checkOut: Date,

  // --- IDENTITY & TRACKING ---
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // --- RAZORPAY INTEGRATION ---
  razorpay_order_id: { type: String },
  razorpay_payment_id: { type: String },
  razorpay_signature: { type: String },

  // --- STATUS ---
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'packed', 'shipped', 'completed', 'cancelled'],
    default: 'confirmed'
  }
}, { timestamps: true });

export const Booking = mongoose.model("Booking", BookingSchema);