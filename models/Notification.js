import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Can be the Admin or the System
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
        type: String,
        enum: ["approval", "rejection", "order", "system", "message"],
        required: true
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // Link to the specific Booking, Product, etc.
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

export const Notification = mongoose.model("Notification", NotificationSchema);