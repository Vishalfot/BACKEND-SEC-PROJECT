// import express from "express";

// import { addBooking, getUserBookings } from "../Controllers/booking.js"; 
// import authentication from "../middleware/authentication.js"; 

// const router = express.Router();

// router.post('/add', authentication, addBooking);
// router.get('/get', authentication, getUserBookings);

// export default router;
import express from "express";
const router = express.Router();
import authentication from "../middleware/authentication.js";
import {
    initiatePayment,
    getMyBookings,
    getLocalBookings,
    updateStatus,
    cancelBooking,
    getLocalAnalytics
} from "../Controllers/bookingController.js";

// ── CREATE ──
router.post("/create", authentication, initiatePayment);

// ── READ ──
router.get("/my-bookings", authentication, getMyBookings);
router.get("/local-bookings", authentication, getLocalBookings);
router.get("/analytics", authentication, getLocalAnalytics);

// ── UPDATE ──
router.patch("/cancel/:id", authentication, cancelBooking);
router.patch("/status/:id", authentication, updateStatus);

export default router;