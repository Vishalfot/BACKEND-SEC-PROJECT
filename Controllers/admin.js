// Controllers/admin.js
import { Profile } from "../models/Profile_temp.js";
import Event from "../models/Event.js";
import { Product } from "../models/Product.js";
import Weddingplace from "../models/weddings.js";
import { Touristplace } from "../models/Touristplace.js";
import Place from "../models/PlaceSchema.js";
import User from "../models/User.js";

// --- 1. PROFILE VERIFICATION ---

// Get all pending local profiles
export const getPendingProfiles = async (req, res) => {
    try {
        // Only fetch profiles with "pending" status
        const pendingProfiles = await Profile.find({ verification_status: "pending" })
            .populate("user", "username email avatar role");
            
        // Robust filter: Role must be "Local" (case-insensitive) in both User and Profile model
        const filtered = pendingProfiles.filter(p => {
           const hasUserLocalRole = p.user && p.user.role && p.user.role.toLowerCase() === "local";
           const hasProfileLocalRole = p.role && p.role.toLowerCase() === "local";
           return hasUserLocalRole || hasProfileLocalRole;
        });
        res.status(200).json(filtered);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending profiles" });
    }
};

// Approve or Reject a Profile
export const verifyProfile = async (req, res) => {
    const { profileId } = req.params;
    const { status } = req.body; // Expecting "approved" or "rejected"

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use 'approved' or 'rejected'" });
    }

    try {
        const profile = await Profile.findByIdAndUpdate(
            profileId, 
            { verification_status: status }, 
            { new: true }
        );
        if (!profile) return res.status(404).json({ error: "Profile not found" });
        res.status(200).json({ message: `Profile marked as ${status}`, profile });
    } catch (error) {
        res.status(500).json({ error: "Failed to update profile status" });
    }
};

// --- 2. EVENT VERIFICATION ---

// Get all pending events
export const getPendingEvents = async (req, res) => {
    try {
        const pendingEvents = await Event.find({ verified: { $ne: true }, rejected: { $ne: true } })
            .populate("createdBy", "username email");
        res.status(200).json(pendingEvents);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending events" });
    }
};

// Approve or Reject an Event
export const verifyEvent = async (req, res) => {
    const { eventId } = req.params;
    const { status } = req.body; 

    try {
        if (status === "rejected") {
            const event = await Event.findByIdAndUpdate(eventId, { rejected: true }, { new: true }); return res.status(200).json({ message: "Event rejected", event });
        }
        const event = await Event.findByIdAndUpdate(
            eventId, 
            { verified: true }, 
            { new: true }
        );
        if (!event) return res.status(404).json({ error: "Event not found" });
        res.status(200).json({ message: "Event approved", event });
    } catch (error) {
        res.status(500).json({ error: "Failed to update event status" });
    }
};

// --- 3. PRODUCT VERIFICATION ---

// Get all pending products
export const getPendingProducts = async (req, res) => {
    try {
        const pendingProducts = await Product.find({ verified: { $ne: true }, rejected: { $ne: true } })
            .populate("createdBy", "username email");
        res.status(200).json(pendingProducts);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending products" });
    }
};

// Approve or Reject a Product
export const verifyProduct = async (req, res) => {
    const { productId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use 'approved' or 'rejected'" });
    }

    try {
        if (status === "rejected") {
            const product = await Product.findByIdAndUpdate(productId, { rejected: true }, { new: true }); return res.status(200).json({ message: "Product rejected", product });
        }
        const product = await Product.findByIdAndUpdate(
            productId,
            { verified: true },
            { new: true }
        );
        if (!product) return res.status(404).json({ error: "Product not found" });
        res.status(200).json({ message: `Product approved`, product });
    } catch (error) {
        res.status(500).json({ error: "Failed to update product status" });
    }
};

// --- 4. WEDDING VENUE VERIFICATION ---

// Get all pending wedding venues
export const getPendingWeddings = async (req, res) => {
    try {
        const pendingWeddings = await Weddingplace.find({ verified: { $ne: true }, rejected: { $ne: true } })
            .populate("host_user", "username email")
            .populate("place_ref", "name area");
        res.status(200).json(pendingWeddings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending weddings" });
    }
};

// Approve or Reject a Wedding Venue
export const verifyWedding = async (req, res) => {
    const { weddingId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use 'approved' or 'rejected'" });
    }

    try {
        if (status === "rejected") {
            const wedding = await Weddingplace.findByIdAndUpdate(weddingId, { rejected: true }, { new: true }); return res.status(200).json({ message: "Wedding venue rejected", wedding });
        }
        const wedding = await Weddingplace.findByIdAndUpdate(
            weddingId,
            { verified: true },
            { new: true }
        );
        if (!wedding) return res.status(404).json({ error: "Wedding venue not found" });
        res.status(200).json({ message: `Wedding venue approved`, wedding });
    } catch (error) {
        res.status(500).json({ error: "Failed to update wedding venue status" });
    }
};

// --- 5. TOURIST PLACE VERIFICATION ---

// Get all pending tourist places
export const getPendingTouristPlaces = async (req, res) => {
    try {
        const pendingPlaces = await Touristplace.find({ verified: { $ne: true }, rejected: { $ne: true } })
            .populate("createdBy", "username email");
        res.status(200).json(pendingPlaces);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending tourist places" });
    }
};

// Approve or Reject a Tourist Place
export const verifyTouristPlace = async (req, res) => {
    const { placeId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use 'approved' or 'rejected'" });
    }

    try {
        if (status === "rejected") {
            const place = await Touristplace.findByIdAndUpdate(placeId, { rejected: true }, { new: true }); return res.status(200).json({ message: "Tourist place rejected", place });
        }
        const place = await Touristplace.findByIdAndUpdate(
            placeId,
            { verified: true },
            { new: true }
        );
        if (!place) return res.status(404).json({ error: "Tourist place not found" });
        res.status(200).json({ message: `Tourist place approved`, place });
    } catch (error) {
        res.status(500).json({ error: "Failed to update tourist place status" });
    }
};

// --- 6. HERITAGE SITES FOR MAP ---
export const getAllAdminPlaces = async (req, res) => {
    try {
        const places = await Place.find({}, "name category area location scores tags");
        res.status(200).json(places);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch heritage places" });
    }
};

// --- 7. LOCAL PARTNER PORTFOLIOS ---

// Get all verified locals
export const getApprovedLocals = async (req, res) => {
    try {
        const approvedProfiles = await Profile.find({ verification_status: "approved" })
            .populate("user", "username email avatar role");
        
        const locals = approvedProfiles
            .filter(p => {
               const isUserLocal = p.user && p.user.role && p.user.role.toLowerCase() === "local";
               const isProfileLocal = p.role && p.role.toLowerCase() === "local";
               return isUserLocal || isProfileLocal;
            })
            .map(p => p.user)
            .filter(Boolean);
        res.status(200).json(locals);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch approved locals" });
    }
};

// Get a specific local's full portfolio
export const getLocalPortfolio = async (req, res) => {
    const { userId } = req.params;
    try {
        const [events, products, weddings, places] = await Promise.all([
            Event.find({ createdBy: userId }),
            Product.find({ createdBy: userId }),
            Weddingplace.find({ host_user: userId }),
            Touristplace.find({ createdBy: userId })
        ]);

        res.status(200).json({
            events,
            products,
            weddings,
            touristPlaces: places
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch local portfolio" });
    }
};

// --- 8. GLOBAL ADMIN STATS ---

export const getAdminStats = async (req, res) => {
    try {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            last7Days.push(d);
        }

        const getStatsForModel = async (Model) => {
            const [pending, approved, rejected] = await Promise.all([
                Model.countDocuments({ verified: { $ne: true }, rejected: { $ne: true } }),
                Model.countDocuments({ verified: true }),
                Model.countDocuments({ rejected: true })
            ]);

            const dailyTrends = await Promise.all(last7Days.map(async (date) => {
                const nextDay = new Date(date);
                nextDay.setDate(date.getDate() + 1);

                const acceptedCount = await Model.countDocuments({
                    verified: true,
                    updatedAt: { $gte: date, $lt: nextDay }
                });
                const rejectedCount = await Model.countDocuments({
                    rejected: true,
                    updatedAt: { $gte: date, $lt: nextDay }
                });

                return {
                    date: date.toISOString().split('T')[0],
                    accepted: acceptedCount,
                    rejected: rejectedCount
                };
            }));

            return { pending, approved, rejected, dailyTrends };
        };

        const [events, products, weddings, places, profiles] = await Promise.all([
            getStatsForModel(Event),
            getStatsForModel(Product),
            getStatsForModel(Weddingplace),
            getStatsForModel(Touristplace),
            Profile.countDocuments({ verification_status: "pending" })
        ]);

        res.status(200).json({
            summary: {
                events: events.pending,
                products: products.pending,
                weddings: weddings.pending,
                places: places.pending,
                profiles: profiles
            },
            approvedCounts: {
                events: events.approved,
                products: products.approved,
                weddings: weddings.approved,
                places: places.approved
            },
            trends: {
                events: events.dailyTrends,
                products: products.dailyTrends,
                weddings: weddings.dailyTrends,
                places: places.dailyTrends
            }
        });
    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ error: "Failed to fetch admin stats" });
    }
};

// Generic "All" fetchers for filtering
export const getAllEvents = async (req, res) => {
    try {
        const items = await Event.find({}).populate("createdBy", "username email");
        res.status(200).json(items);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getAllProducts = async (req, res) => {
    try {
        const items = await Product.find({}).populate("createdBy", "username email");
        res.status(200).json(items);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getAllWeddings = async (req, res) => {
    try {
        const items = await Weddingplace.find({}).populate("host_user", "username email").populate("place_ref", "name");
        res.status(200).json(items);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getAllTouristPlaces = async (req, res) => {
    try {
        const items = await Touristplace.find({}).populate("createdBy", "username email");
        res.status(200).json(items);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getAllProfiles = async (req, res) => {
    try {
        const items = await Profile.find({}).populate("user", "username email avatar role");
        const filtered = items.filter(p => {
           const isUserLocal = p.user && p.user.role && p.user.role.toLowerCase() === "local";
           const isProfileLocal = p.role && p.role.toLowerCase() === "local";
           return isUserLocal || isProfileLocal;
        });
        res.status(200).json(filtered);
    } catch (e) { res.status(500).json({ error: e.message }); }
};