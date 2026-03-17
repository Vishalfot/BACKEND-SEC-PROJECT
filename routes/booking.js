import express from "express";

import { addBooking, getUserBookings } from "../Controllers/booking.js"; 
import authentication from "../middleware/authentication.js"; 

const router = express.Router();

router.post('/add', authentication, addBooking);
router.get('/get', authentication, getUserBookings);

export default router;