import { WeddingBooking } from "../models/WeddingBooking.js";

// 1. BOOK A VENUE
const bookVenue = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id; 
        const { venueId } = req.body; // We will send this from frontend

        const newBooking = new WeddingBooking({
            user: userId,
            weddingPlace: venueId
        });

        await newBooking.save();
        res.status(201).json({ message: "Booking successful!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Booking failed" });
    }
};

// 2. GET MY VENUE BOOKINGS
const getMyVenueBookings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id; 

        const bookings = await WeddingBooking.find({ user: userId })
            .populate('weddingPlace') // Fetch venue details (name, image)
            .sort({ bookingDate: -1 });

        res.status(200).json(bookings);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching bookings" });
    }
};

export { bookVenue, getMyVenueBookings };