import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

// Import Routes
import eventRoutes from "./routes/Event.js";
import touristRoutes from "./routes/Touristplace.js";
import productRoutes from "./routes/Product.js";
import UserRouter from "./routes/user.js";
import BookingRoutes from "./routes/booking.js";
import WeddingRoutes from "./routes/wedding.js";
import weddingBookingRoutes from "./routes/weddingBooking.js";
import profileRoutes from "./routes/profile.js";
import itineraryRoutes from './routes/itinerary.route.js';
import adminRoutes from "./routes/adminRoutes.js";
import homestayRoutes from "./routes/Homestay.js";
import notificationRoutes from "./routes/notification.js";
import reviewRoutes from "./routes/Review.js";
import paymentRoutes from "./routes/payment.js";

dotenv.config();
const app = express();

// --- Middleware ---
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const ok = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (ok) return callback(null, true);
        callback(new Error("CORS blocked: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
}));

app.use(cookieParser());
app.use(express.json());

// --- Routes Configuration ---
app.use("/api/event", eventRoutes);
app.use("/api/product", productRoutes);
app.use("/api/tourist", touristRoutes);
app.use("/api/auth", UserRouter);
app.use("/api/booking", BookingRoutes);
app.use("/api/wedding", WeddingRoutes);
app.use("/api/wedding-booking", weddingBookingRoutes);
app.use("/api/profile", profileRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/homestays", homestayRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => res.send("Culture Discovery API is Live!"));

// --- Database Connection ---
mongoose.connect(process.env.URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// --- Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});