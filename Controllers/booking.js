// 1. Use 'import' instead of 'require'
import Booking from '../models/Booking.js'; 

// --- 1. ADD NEW BOOKING ---
// 2. Use 'const' instead of 'exports.addBooking'
const addBooking = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id; 
        
        const { items, totalAmount } = req.body;

        const newBooking = new Booking({
            user: userId,
            items: items,
            totalAmount: totalAmount
        });

        await newBooking.save();

        res.status(201).json({ 
            status: true, 
            message: "Order placed successfully!" 
        });

    } catch (error) {
        console.error("Error adding booking:", error);
        res.status(500).json({ 
            status: false, 
            message: "Failed to place order" 
        });
    }
};

// --- 2. GET USER'S BOOKING HISTORY ---
// 2. Use 'const' instead of 'exports.getUserBookings'
const getUserBookings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        const bookings = await Booking.find({ user: userId })
            .populate('items.product') 
            .sort({ orderDate: -1 });

        res.status(200).json(bookings);

    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ 
            status: false, 
            message: "Failed to fetch history" 
        });
    }
};

// 3. Export them together at the bottom
export { addBooking, getUserBookings };