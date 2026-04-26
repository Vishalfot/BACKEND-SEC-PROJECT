import { Profile } from "../models/Profile_temp.js";
import Event from "../models/Event.js";
import { Product } from "../models/Product.js";
import Weddingplace from "../models/weddings.js";
import { Touristplace } from "../models/Touristplace.js";
import Homestay from "../models/Homestay.js";
import { Notification } from "../models/Notification.js";
import Usermodel from "../models/User.js";
import { Booking } from "../models/Booking.js";

// --- HELPER: Map string type to Model ---
const getModel = (type) => {
    const models = {
        event: Event,
        events: Event,
        product: Product,
        products: Product,
        item: Product,
        items: Product,
        wedding: Weddingplace,
        weddings: Weddingplace,
        place: Touristplace,
        places: Touristplace,
        touristplace: Touristplace,
        touristplaces: Touristplace,
        homestay: Homestay,
        homestays: Homestay,
        profile: Profile,
        profiles: Profile
    };
    const model = models[type.toLowerCase()];
    console.log(`[getModel] type: "${type}", found: ${model ? 'YES' : 'NO'}`);
    return model;
};

// ─── 1. GENERIC VERIFICATION & NOTIFICATION ───
export const verifyContent = async (req, res) => {
    const { contentType, id } = req.params;
    const { status, adminFeedback } = req.body;

    try {
        console.log(`[verifyContent] contentType: "${contentType}", id: "${id}", status: "${status}"`);
        const Model = getModel(contentType);
        if (!Model) {
            console.log(`[verifyContent] FAILED: No model for "${contentType}"`);
            return res.status(400).json({ error: "Invalid content type" });
        }

        // A. Update the item status
        const updateData = status === "approved"
            ? { 
                status: "approved", 
                verificationStatus: "approved", // for Event model
                verification_status: "approved", // for Profile model
                verified: true, 
                rejected: false, 
                adminFeedback: "",
                admin_note: "" 
              }
            : { 
                status: "rejected", 
                verificationStatus: "rejected", // for Event model
                verification_status: "rejected", // for Profile model
                verified: false, 
                rejected: true, 
                adminFeedback,
                admin_note: adminFeedback 
              };

        const item = await Model.findByIdAndUpdate(id, updateData, { new: true });
        if (!item) return res.status(404).json({ error: "Item not found" });

        // B. Send Automatic Notification to the Local Partner
        const ownerId = item.createdBy || item.host_user || item.submitted_by || item.user;
        const itemName = item.tourist_place_name || item.name || item.title || "your listing";

        if (ownerId) {
            const notification = new Notification({
                recipient: ownerId,
                title: status === "approved" ? "Listing Approved! 🎉" : "Action Required: Listing Rejected",
                message: status === "approved"
                    ? `Your ${contentType} "${itemName}" is now live on the platform.`
                    : `Your ${contentType} "${itemName}" was rejected. Reason: ${adminFeedback}`,
                type: status === "approved" ? "approval" : "rejection",
                relatedId: item._id
            });
            await notification.save();
        }

        res.status(200).json({ success: true, message: `Item ${status} successfully`, item });

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ error: "Verification process failed" });
    }
};

// ─── 2. ADMIN: SEND CUSTOM MESSAGE ───
export const sendAdminMessage = async (req, res) => {
    try {
        const { recipientId, title, message } = req.body;
        const adminId = req.user.userId || req.user._id;

        const customNote = new Notification({
            recipient: recipientId,
            sender: adminId,
            title: title || "Important: Instruction from Admin",
            message: message,
            type: "message"
        });

        await customNote.save();
        res.status(201).json({ success: true, message: "Instruction sent successfully." });
    } catch (error) {
        res.status(500).json({ error: "Failed to send message." });
    }
};

// ─── 3. STATS & PENDING FETCHERS ───
export const getAdminStats = async (req, res) => {
    try {
        const [eP, pP, wP, tP, hP, prP, eA, pA, wA, tA, hA, prA, bookings] = await Promise.all([
            Event.countDocuments({ verificationStatus: 'pending' }),
            Product.countDocuments({ status: 'pending' }),
            Weddingplace.countDocuments({ status: 'pending' }),
            Touristplace.countDocuments({ status: 'pending' }),
            Homestay.countDocuments({ status: "pending" }),
            Profile.countDocuments({ verification_status: "pending", role: "Local" }),
            
            Event.countDocuments({ $or: [{ verificationStatus: 'approved' }, { status: 'approved' }, { verified: true }] }),
            Product.countDocuments({ $or: [{ status: 'approved' }, { verified: true }] }),
            Weddingplace.countDocuments({ $or: [{ status: 'approved' }, { verified: true }] }),
            Touristplace.countDocuments({ $or: [{ status: 'approved' }, { verified: true }] }),
            Homestay.countDocuments({ $or: [{ status: "approved" }, { verified: true }] }),
            Profile.countDocuments({ $or: [{ verification_status: "approved" }, { verified: true }], role: "Local" }),

            Booking.find({ paymentStatus: 'completed' })
        ]);

        const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);

        console.log(`[Stats] eP:${eP}, pP:${pP}, wP:${wP}, tP:${tP}, hP:${hP}, prP:${prP}`);
        console.log(`[Stats] eA:${eA}, pA:${pA}, wA:${wA}, tA:${tA}, hA:${hA}, prA:${prA}`);

        res.status(200).json({
            pending: { events: eP, products: pP, weddings: wP, places: tP, homestays: hP, profiles: prP },
            verified: { events: eA, products: pA, weddings: wA, places: tA, homestays: hA, profiles: prA },
            revenue: totalRevenue,
            totalBookings: bookings.length
        });
    } catch (error) {
        console.error("Admin Stats Error:", error);
        res.status(500).json({ error: "Failed to load dashboard stats" });
    }
};

export const getPendingItems = async (req, res) => {
    const { contentType } = req.params;
    try {
        const Model = getModel(contentType);
        const items = await Model.find({})
            .populate("createdBy host_user submitted_by", "username email avatar");
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ error: `Could not fetch pending ${contentType}` });
    }
};

export const getAllItems = async (req, res) => {
    const { contentType } = req.params;
    try {
        const Model = getModel(contentType);
        if (!Model) {
            return res.status(400).json({ error: "Invalid content type" });
        }

        const items = await Model.find({}).lean();
        
        // Safely try to populate - if one path fails, others might still work
        try {
            await Model.populate(items, [
                { path: "createdBy", select: "username email avatar" },
                { path: "host_user", select: "username email avatar" },
                { path: "submitted_by", select: "username email avatar" }
            ]);
        } catch (popErr) {
            console.error("Population partially failed (returning available data):", popErr.message);
        }

        res.status(200).json(items);
    } catch (error) {
        console.error(`Error fetching ${contentType}:`, error);
        res.status(500).json({ error: `Could not fetch all ${contentType}: ${error.message}` });
    }
};

export const getAllLocals = async (req, res) => {
    try {
        // MATCHING CAPITALIZED 'Local' FROM USER MODEL ENUM
        // Using exact match for role 'Local' as defined in User enum
        const locals = await Usermodel.find({ role: 'Local' })
            .select("-password");
        console.log(`[Locals] Found ${locals.length} local partners in DB`);
        res.status(200).json(locals);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch local partners" });
    }
};

export const getLocalPortfolio = async (req, res) => {
    const { userId } = req.params;
    try {
        const [events, products, weddings, places, homestays] = await Promise.all([
            Event.find({ createdBy: userId }),
            Product.find({ createdBy: userId }),
            Weddingplace.find({ host_user: userId }),
            Touristplace.find({ createdBy: userId }),
            Homestay.find({ submitted_by: userId })
        ]);
        res.json({ events, products, weddings, touristPlaces: places, homestays });
    } catch (error) {
        res.status(500).json({ error: "Failed to load partner portfolio" });
    }
};

// --- UTILITY: NOTIFY ALL ADMINS ---
export const notifyAdmins = async (contentType, itemName, sellerName) => {
    try {
        const admins = await Usermodel.find({ role: "admin" }).select("_id");
        const notifications = admins.map(admin => ({
            recipient: admin._id,
            title: "New Verification Needed",
            message: `${sellerName} has submitted/updated ${contentType}: "${itemName}". Please verify.`,
            type: "system",
        }));
        await Notification.insertMany(notifications);
    } catch (error) {
        console.error("Admin Notification Error:", error);
    }
};

// ─── 4. PROFILE VERIFICATION ───
export const getPendingProfiles = async (req, res) => {
    try {
        const profiles = await Profile.find({ 
            verification_status: "pending",
            role: "Local" // Only verify Local Partners
        })
            .populate("user", "username email");
        res.status(200).json(profiles);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending profiles" });
    }
};

export const getAllProfiles = async (req, res) => {
    try {
        const profiles = await Profile.find({ role: 'Local' })
            .populate("user", "username email");
        console.log(`[Profiles] Found ${profiles.length} Local profiles`);
        res.status(200).json(profiles);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch all profiles" });
    }
};

export const verifyProfile = async (req, res) => {
    try {
        const { profileId } = req.params;
        const { status, adminFeedback } = req.body;

        const profile = await Profile.findByIdAndUpdate(profileId, {
            verification_status: status,
            adminFeedback: status === "rejected" ? adminFeedback : ""
        }, { new: true });

        if (!profile) return res.status(404).json({ error: "Profile not found" });

        // Notify User
        const note = new Notification({
            recipient: profile.user,
            title: status === "approved" ? "Account Verified! 🛡️" : "Verification Rejected",
            message: status === "approved" 
                ? "Congratulations! Your Local Partner status is now active." 
                : `Your verification was rejected. Reason: ${adminFeedback}`,
            type: status === "approved" ? "approval" : "rejection"
        });
        await note.save();

        res.status(200).json({ success: true, message: `Profile ${status}`, profile });
    } catch (error) {
        res.status(500).json({ error: "Profile verification failed" });
    }
};