import { Booking } from "../models/Booking.js";
import { Product } from "../models/Product.js";
import Event from "../models/Event.js";
import Weddingplace from "../models/weddings.js";
import Homestay from "../models/Homestay.js";
import User from "../models/User.js";
import { Notification } from "../models/Notification.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
});

/**
 * --- HELPER: CALCULATE FINAL PRICE ---
 * Centralized logic for Price Shield, Coupons, and Coins.
 */
const calculateFinalPrice = async (userId, data) => {
    const { category, relatedId, quantity = 1, couponCode, useCoins, selectedPrograms, isFullPackage, checkIn, checkOut } = data;
    
    let originalAmount = 0;
    let itemData = null;

    // 1. Fetch Item & Base Price
    switch (category) {
        case 'Product':
            itemData = await Product.findById(relatedId);
            if (!itemData) throw new Error("Product not found");
            if (itemData.stock <= 0) throw new Error("This product is out of stock");
            if (itemData.stock < quantity) throw new Error(`Only ${itemData.stock} unit${itemData.stock === 1 ? '' : 's'} left in stock`);
            originalAmount = itemData.price * quantity;
            break;

        case 'Event':
            itemData = await Event.findById(relatedId);
            if (!itemData) throw new Error("Event not found");
            const availableTickets = itemData.capacity - (itemData.tickets_sold || 0);
            if (quantity > availableTickets) throw new Error(`Only ${availableTickets} tickets left`);
            originalAmount = itemData.price * quantity;
            break;

        case 'Homestay':
            itemData = await Homestay.findById(relatedId);
            if (!itemData) throw new Error("Homestay not found");
            if ((itemData.rooms_available || 0) < quantity) throw new Error(`Only ${itemData.rooms_available} rooms available`);
            const stayDuration = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
            originalAmount = itemData.price_per_night * (stayDuration || 1) * quantity;
            break;

        case 'Weddingplace':
            itemData = await Weddingplace.findById(relatedId);
            if (!itemData) throw new Error("Wedding venue not found");
            if (isFullPackage) {
                originalAmount = itemData.full_package_price || itemData.base_price || 0;
            } else {
                if (!selectedPrograms?.length) throw new Error("No programs selected");
                // Validate per-ritual capacity
                for (const prog of selectedPrograms) {
                    const dbProg = itemData.programs.find(p => p.name === prog.programName);
                    if (dbProg) {
                        const availSeats = dbProg.capacity - (dbProg.tickets_sold || 0);
                        if (availSeats <= 0) throw new Error(`"${prog.programName}" ritual is fully booked`);
                    }
                }
                originalAmount = selectedPrograms.reduce((sum, p) => sum + p.priceAtTimeOfBooking, 0);
            }
            break;
    }

    // 2. Discounts
    let couponDiscount = 0;
    if (couponCode === "WELCOME10") couponDiscount = originalAmount * 0.10;

    let coinValueDiscount = 0;
    let coinsToDeduct = 0;
    const user = await User.findById(userId);
    const validCoins = Math.max(0, user.coins || 0);

    if (useCoins && validCoins > 0) {
        const maxCoinDiscountAllowed = originalAmount * 0.20;
        coinValueDiscount = Math.min(validCoins / 10, maxCoinDiscountAllowed);
        coinsToDeduct = Math.floor(coinValueDiscount * 10);
    }

    const totalAmount = Math.max(originalAmount - couponDiscount - coinValueDiscount, 0);
    // Determine seller ID using the correct field for each model
    let sellerId;
    if (category === 'Product')       sellerId = itemData.createdBy;
    else if (category === 'Event')    sellerId = itemData.createdBy || itemData.submitted_by;
    else if (category === 'Homestay') sellerId = itemData.submitted_by;
    else if (category === 'Weddingplace') sellerId = itemData.createdBy || itemData.submitted_by;

    if (!sellerId) sellerId = userId; // last resort fallback

    const sellerIdFinal = sellerId?._id || sellerId;
    return { originalAmount, couponDiscount, coinsToDeduct, coinValueDiscount, totalAmount, sellerId: sellerIdFinal, itemData };
};

/**
 * ── STEP 1: INITIATE PAYMENT ──
 * Creates a "Pending" record in DB first, then asks Razorpay for an Order ID.
 */
export const initiatePayment = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const { bookingId } = req.body;
        
        const pricing = await calculateFinalPrice(userId, req.body);
        let booking;

        if (bookingId) {
            booking = await Booking.findOne({ _id: bookingId, user: userId });
            if (!booking) return res.status(404).json({ error: "Booking record not found" });
            // Update pricing in case it changed (Price Shield)
            booking.totalAmount = pricing.totalAmount;
        } else {
            // 1. Create a "Ghost" booking record first
            booking = new Booking({
                user: userId,
                sellerId: pricing.sellerId,
                category: req.body.category,
                relatedId: req.body.relatedId,
                originalAmount: pricing.originalAmount,
                totalAmount: pricing.totalAmount,
                coinsUsed: pricing.coinsToDeduct,
                coinValueDiscount: pricing.coinValueDiscount,
                couponCode: req.body.couponCode || null,
                couponDiscount: pricing.couponDiscount,
                quantity: req.body.quantity || 1,
                selectedPrograms: req.body.category === 'Weddingplace' ? req.body.selectedPrograms : [],
                isFullWeddingPackage: req.body.category === 'Weddingplace' ? req.body.isFullPackage : false,
                checkIn: req.body.checkIn,
                checkOut: req.body.checkOut,
                paymentStatus: 'pending',
                status: 'pending'
            });
        }

        await booking.save();

        // 2. Handle Free Bookings
        if (pricing.totalAmount === 0) {
            booking.paymentStatus = 'completed';
            booking.status = 'confirmed';
            await booking.save();
            return res.status(201).json({ success: true, bookingId: booking._id, message: "Free booking confirmed" });
        }

        // 3. Create Razorpay Order
        const options = {
            amount: Math.round(pricing.totalAmount * 100),
            currency: "INR",
            receipt: `rcpt_${booking._id.toString().slice(-6)}`,
            notes: { bookingId: booking._id.toString() }
        };

        const order = await razorInstance.orders.create(options);

        // 4. Link Order ID to our Booking
        booking.razorpay_order_id = order.id;
        await booking.save();

        res.status(200).json({ 
            success: true, 
            order, 
            bookingId: booking._id,
            totalAmount: pricing.totalAmount 
        });

    } catch (error) {
        console.error("Payment Initiation Error:", error);
        res.status(500).json({ error: error.message || "Failed to initiate payment" });
    }
};

/**
 * ── STEP 2: VERIFY & CONFIRM ──
 * Robust Signature Check. Only after Razorpay's digital signature is verified do we finalize the booking.
 */
export const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature 
        } = req.body;
        const userId = req.user.userId || req.user._id;

        // 1. Signature Verification (The "Robust" Part)
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            // Update booking to 'failed' status for audit
            await Booking.findOneAndUpdate({ razorpay_order_id }, { paymentStatus: 'failed' });
            return res.status(400).json({ success: false, message: "Digital signature mismatch. Security alert triggered." });
        }

        // 2. Find and Finalize the Booking
        let booking = await Booking.findOne({ razorpay_order_id, user: userId });
        if (!booking) {
            // Fallback: match on order_id alone (handles shopper session edge cases)
            booking = await Booking.findOne({ razorpay_order_id });
        }
        if (!booking) return res.status(404).json({ error: "Original booking record not found." });

        if (booking.paymentStatus === 'completed') {
            return res.status(400).json({ error: "Payment already processed for this order." });
        }

        // 3. Update Status
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.razorpay_payment_id = razorpay_payment_id;
        booking.razorpay_signature = razorpay_signature;
        await booking.save();

        // 4. Atomic Updates (Stock & Coins)
        if (booking.category === 'Product') {
            await Product.findByIdAndUpdate(booking.relatedId, { $inc: { stock: -booking.quantity } });
        } else if (booking.category === 'Event') {
            await Event.findByIdAndUpdate(booking.relatedId, { $inc: { tickets_sold: booking.quantity } });
        } else if (booking.category === 'Homestay') {
            await Homestay.findByIdAndUpdate(booking.relatedId, { $inc: { rooms_available: -booking.quantity } });
        } else if (booking.category === 'Weddingplace' && !booking.isFullWeddingPackage && booking.selectedPrograms?.length) {
            // Decrement tickets_sold for each selected ritual
            for (const prog of booking.selectedPrograms) {
                await Weddingplace.findOneAndUpdate(
                    { _id: booking.relatedId, 'programs.name': prog.programName },
                    { $inc: { 'programs.$.tickets_sold': 1 } }
                );
            }
        }
        if (booking.coinsUsed > 0) {
            await User.findByIdAndUpdate(userId, { $inc: { coins: -booking.coinsUsed } });
        }

        // 5. Notifications — include item name from the booking
        const itemRef = await (async () => {
            try {
                const modelMap = { Product: 'Product', Event: 'Event', Homestay: 'Homestay', Weddingplace: 'Wedding' };
                const mn = modelMap[booking.category];
                if (!mn) return null;
                const mongoose_ = (await import('mongoose')).default;
                return mn ? await mongoose_.model(mn).findById(booking.relatedId).lean() : null;
            } catch { return null; }
        })();
        const itemName = itemRef?.product_name || itemRef?.event_name || itemRef?.name || itemRef?.title || booking.category;

        const touristNote = new Notification({
            recipient: userId,
            title: "Payment Verified! 🛡️",
            message: `Your booking for "${itemName}" is confirmed. Order ID: #${booking._id.toString().slice(-8).toUpperCase()}`,
            type: "order"
        });
        const localNote = new Notification({
            recipient: booking.sellerId,
            title: "New Order Received! 💰",
            message: `New ${booking.category} booking for "${itemName}" worth ₹${booking.totalAmount}. Check Manage Bookings.`,
            type: "order"
        });
        await Promise.all([touristNote.save(), localNote.save()]);

        res.status(200).json({ 
            success: true, 
            message: "Payment verified and booking confirmed", 
            bookingId: booking._id 
        });

    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ error: "Verification process failed" });
    }
};

/**
 * ── GET RAZORPAY KEY ──
 * Securely share the public key with frontend.
 */
export const getRazorpayKey = async (req, res) => {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });
};

/**
 * ── GET LOCAL ANALYTICS ──
 * Total revenue broken down by product, event, wedding, etc.
 */
export const getLocalAnalytics = async (req, res) => {
    try {
        const localId = req.user.userId || req.user._id;

        // Get all completed bookings for this seller
        const bookings = await Booking.find({ 
            sellerId: localId, 
            paymentStatus: 'completed' 
        });

        // Group by category
        const analytics = bookings.reduce((acc, booking) => {
            const cat = booking.category || 'Other';
            if (!acc[cat]) {
                acc[cat] = { revenue: 0, count: 0 };
            }
            acc[cat].revenue += booking.totalAmount;
            acc[cat].count += 1;
            return acc;
        }, {});

        const totalRevenue = Object.values(analytics).reduce((sum, item) => sum + item.revenue, 0);

        res.status(200).json({
            analytics,
            totalRevenue,
            totalBookings: bookings.length
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to load analytics" });
    }
};
/**
 * ── ADMIN STATS ──
 * Total platform performance
 */
export const getAdminStats = async (req, res) => {
    try {
        const bookings = await Booking.find({ paymentStatus: 'completed' });
        const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
        const totalBookings = bookings.length;
        
        res.status(200).json({ totalRevenue, totalBookings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * ── SAFE POPULATE HELPER ──
 * Mongoose's refPath requires the category value to EXACTLY match the
 * registered model name. Our wedding model is registered as 'Wedding'
 * but category is 'Weddingplace' — this breaks automatic populate.
 * This helper manually populates each booking safely.
 */
const CATEGORY_MODEL_MAP = {
    Product:     'Product',
    Event:       'Event',
    Homestay:    'Homestay',
    Weddingplace: 'Wedding',
};

async function safePopulateBookings(bookings) {
    const mongoose = (await import('mongoose')).default;
    return Promise.all(bookings.map(async (b) => {
        try {
            const modelName = CATEGORY_MODEL_MAP[b.category];
            if (modelName && mongoose.modelNames().includes(modelName)) {
                const Model = mongoose.model(modelName);
                b.relatedId = await Model.findById(b.relatedId).lean();
            }
        } catch (e) {
            // leave relatedId as-is (ObjectId) if model lookup fails
        }
        return b;
    }));
}

/**
 * ── GET USER BOOKINGS (Tourist) ──
 */
export const getMyBookings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const bookings = await Booking.find({ user: userId })
            .sort("-createdAt")
            .lean();
        const populated = await safePopulateBookings(bookings);
        // Also populate user info
        const User_ = (await import('../models/User.js')).default;
        const withUser = await Promise.all(populated.map(async (b) => {
            try { b.user = await User_.findById(b.user).select('username email avatar').lean(); } catch(e){}
            return b;
        }));
        res.status(200).json(withUser);
    } catch (error) {
        console.error('getMyBookings error:', error);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
};

/**
 * ── GET LOCAL BOOKINGS (Seller Dashboard) ──
 */
export const getLocalBookings = async (req, res) => {
    try {
        const localId = req.user.userId || req.user._id;
        console.log(`[getLocalBookings] localId=${localId}`);

        // Cast to ObjectId for reliable matching
        const mongoose_ = (await import('mongoose')).default;
        let localObjId;
        try { localObjId = new mongoose_.Types.ObjectId(String(localId)); }
        catch { localObjId = localId; }

        const bookings = await Booking.find({ sellerId: localObjId })
            .sort("-createdAt")
            .lean();

        console.log(`[getLocalBookings] found ${bookings.length} booking(s) for seller`);

        const populated = await safePopulateBookings(bookings);

        const User_ = (await import('../models/User.js')).default;
        const withUser = await Promise.all(populated.map(async (b) => {
            try { b.user = await User_.findById(b.user).select('username email avatar').lean(); } catch(e){}
            return b;
        }));

        res.status(200).json(withUser);
    } catch (error) {
        console.error('getLocalBookings error:', error);
        res.status(500).json({ error: "Failed to fetch local bookings" });
    }
};

/**
 * ── UPDATE BOOKING STATUS (Local Dashboard) ──
 * Allows seller to mark as 'completed' or 'cancelled'
 */
export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'completed' or 'cancelled'
        const localId = req.user.userId || req.user._id;

        const booking = await Booking.findOne({ _id: id, sellerId: localId });

        if (!booking) return res.status(404).json({ error: "Booking not found" });
        if (booking.status === 'cancelled' || booking.status === 'completed') {
            return res.status(400).json({ error: `Booking is already ${booking.status}` });
        }

        booking.status = status;
        await booking.save();

        // REFUND LOGIC: If seller cancels, refund coins to tourist
        if (status === 'cancelled' && booking.coinsUsed > 0) {
            await User.findByIdAndUpdate(booking.user, { $inc: { coins: booking.coinsUsed } });
            const refundNote = new Notification({
                recipient: booking.user,
                title: "Refund Processed 💸",
                message: `Your booking for ${booking.category} was cancelled by the host. ${booking.coinsUsed} coins have been returned to your wallet.`,
                type: "system"
            });
            await refundNote.save();
        }

        // STAGE-WISE NOTIFICATIONS for product orders
        const stageMessages = {
            packed:    { title: "Order Packed! 📦",   msg: `Your ${booking.category} order has been packed and is ready to ship.` },
            shipped:   { title: "Order Shipped! 🚚",  msg: `Your ${booking.category} order is on its way! It will be delivered soon.` },
            completed: { title: "Order Delivered! ✨", msg: `Your ${booking.category} has been delivered. You can now leave a review and earn 50 coins!` }
        };
        if (stageMessages[status]) {
            const note = new Notification({
                recipient: booking.user,
                title: stageMessages[status].title,
                message: stageMessages[status].msg,
                type: "system"
            });
            await note.save();
        }

        res.status(200).json({
            success: true,
            message: `Booking status updated to ${status}`,
            booking
        });
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ error: "Update failed" });
    }
};

/**
 * ── CANCEL BOOKING (Tourist side) ──
 */
export const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user._id;

        const booking = await Booking.findOne({ _id: id, user: userId });

        if (!booking) return res.status(404).json({ error: "Booking not found" });
        if (booking.status === 'cancelled') return res.status(400).json({ error: "Already cancelled" });

        booking.status = 'cancelled';
        await booking.save();

        // REFUND COINS
        if (booking.coinsUsed > 0) {
            await User.findByIdAndUpdate(userId, { $inc: { coins: booking.coinsUsed } });
        }

        res.status(200).json({
            message: "Booking cancelled. Coins have been refunded.",
            refundedCoins: booking.coinsUsed
        });
    } catch (error) {
        res.status(500).json({ error: "Cancellation failed" });
    }
};