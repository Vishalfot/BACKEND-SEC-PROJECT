import express from "express";
const router = express.Router();
import authentication from "../middleware/authentication.js";
import { initiatePayment, verifyPayment, getRazorpayKey } from "../Controllers/bookingController.js";

// Securely fetch public key
router.get("/key", authentication, getRazorpayKey);

// Step 1: Create Razorpay Order
router.post("/initiate", authentication, initiatePayment);

// Step 2: Verify Signature & Save Booking
router.post("/verify", authentication, verifyPayment);

export default router;
