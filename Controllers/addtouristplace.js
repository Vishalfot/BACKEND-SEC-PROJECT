import { Touristplace } from "../models/Touristplace.js";
import { Profile } from "../models/Profile_temp.js";
import { uploadonCloudinary } from "../utils/cloudnary.js";

/**
 * ── ADD HIDDEN GEM ──
 * Converts latitude/longitude into GeoJSON for nearby search.
 */
const addtouristplace = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        // 1. Gatekeeper Check
        const userProfile = await Profile.findOne({ user: userId });
        if (!userProfile || userProfile.verification_status !== "approved") {
            return res.status(403).json({
                error: "You must be a verified local to suggest a hidden gem."
            });
        }

        const {
            tourist_place_name, description, significance,
            opening_time, closing_time, address,
            latitude, longitude, category
        } = req.body;

        // 2. Validation
        if (!tourist_place_name || !latitude || !longitude || !significance) {
            return res.status(400).json({ error: "Missing name, location, or cultural significance." });
        }

        const avatarlocalPath = req.file?.path;
        if (!avatarlocalPath) return res.status(400).json({ error: "Place image is required" });

        const uploadResult = await uploadonCloudinary(avatarlocalPath);
        if (!uploadResult) return res.status(400).json({ error: "Image upload failed" });

        // 3. Create GeoJSON Point
        const location = {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)] // [long, lat]
        };

        const newPlace = new Touristplace({
            tourist_place_name,
            description,
            significance, // ✅ NEW: Story/Reason for the spot
            opening_time,
            closing_time,
            address,
            location,
            category: category || "Secret Spot",
            images: [{
                url: uploadResult.secure_url,
                public_id: uploadResult.public_id
            }],
            createdBy: userId,
            verified: false // Admin must check if it's a real place
        });

        const savedPlace = await newPlace.save();
        res.status(201).json({
            message: "Hidden Gem submitted for verification.",
            place: savedPlace
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Addition failed", details: error.message });
    }
};

/**
 * ── SEARCH GEMS (TOURIST) ──
 * Finds only verified places. If lat/lng provided, finds nearest gems first.
 */
const getAllTouristplaces = async (req, res) => {
    try {
        const { lat, lng, dist = 5000 } = req.query;
        let query = { verified: true };

        if (lat && lng) {
            query.location = {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(dist)
                }
            };
        }

        const places = await Touristplace.find(query)
            .populate('createdBy', 'username name avatar')
            .lean();

        res.status(200).json(places);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
};

/**
 * ── SECURE UPDATE ──
 */
const updatetouristplace = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user._id;

        const place = await Touristplace.findById(id);
        if (!place) return res.status(404).json({ error: "Place not found" });

        // Security Check
        if (place.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized access." });
        }

        // Reset verification on update (Unified Standard)
        const updates = { 
            ...req.body, 
            status: "pending", 
            verified: false, 
            rejected: false,
            adminFeedback: "" // Clear old feedback
        };

        const updated = await Touristplace.findByIdAndUpdate(id, updates, { new: true });
        res.status(200).json({ message: "Update successful, pending re-verification.", updated });

    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
};

/**
 * ── SECURE DELETE ──
 */
const deletetouristplace = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user._id;

        const place = await Touristplace.findById(id);
        if (!place) return res.status(404).json({ error: "Place not found" });

        if (place.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized." });
        }

        await place.deleteOne();
        res.status(200).json({ message: "Tourist place deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Deletion failed" });
    }
};
const getMyTouristplaces = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const myPlaces = await Touristplace.find({ createdBy: userId });
        res.status(200).json(myPlaces);
    } catch (error) {
        res.status(400).json("your tourist places not able to fetch");
    }
};
export {
    addtouristplace,
    getAllTouristplaces,
    getMyTouristplaces, // Use your existing getMyTouristplaces logic
    updatetouristplace,
    deletetouristplace
};