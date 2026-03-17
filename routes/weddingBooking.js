import express from "express";
import authentication from "../middleware/authentication.js";
import { bookVenue, getMyVenueBookings } from "../Controllers/weddingBooking.js";

const router = express.Router();

// Apply Authentication to both
router.post("/book", authentication, bookVenue);
router.get("/get", authentication, getMyVenueBookings);

export default router;