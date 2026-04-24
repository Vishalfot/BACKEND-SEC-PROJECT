import { Touristplace } from "../models/Touristplace.js";
import { Profile } from "../models/Profile_temp.js"; // ✅ NEW: For Gatekeeper
import { uploadonCloudinary } from "../utils/cloudnary.js";

const addtouristplace = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        // ✅ GATEKEEPER CHECK: Ensure local profile is approved
        const userProfile = await Profile.findOne({ user: userId });
        if (!userProfile || userProfile.verification_status !== "approved") {
            return res.status(403).json({ 
                error: "You cannot add a tourist place until your Local Profile is verified by an admin." 
            });
        }

        // ❌ BUG FIXED: Added `location` to destructuring
        const { tourist_place_name, description, opening_time, closing_time, location } = req.body;
        
        const avatarlocalPath = req.file?.path;
        if (!avatarlocalPath) {
            return res.status(400).json("tourist place image not fetched");
        }
    
        const touristplace_image = await uploadonCloudinary(avatarlocalPath);

        if (!touristplace_image) {
            return res.status(400).json("tourist place Image file is required");
        }

        const newTouristplace = new Touristplace({
            tourist_place_name,
            description,
            opening_time,
            closing_time,
            location, // ✅ Now properly passed
            avatar: touristplace_image.secure_url, // ✅ Changed to secure_url
            createdBy: userId // ✅ Linked to the local user
        });

        const savedtouristplace = await newTouristplace.save();
        res.status(201).json({
            message: "Tourist Place submitted successfully. Awaiting Admin verification.",
            place: savedtouristplace
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Tourist place addition failed" });
    }
};

// ✅ NEW: FOR TOURISTS - Shows ONLY VERIFIED Places
const getAllTouristplaces = async (req, res) => {
    try {
        const touristplaces = await Touristplace.find({ verified: true }).populate('createdBy', 'username');
        res.status(200).json(touristplaces);
    } catch (error) {
        res.status(400).json("tourist places not able to fetch");
    }
};

// ✅ NEW: FOR LOCALS - Shows all their places (Pending & Approved)
const getMyTouristplaces = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const myPlaces = await Touristplace.find({ createdBy: userId });
        res.status(200).json(myPlaces);
    } catch (error) {
        res.status(400).json("your tourist places not able to fetch");
    }
};

const updatetouristplace = async (req, res) => {
    const { id } = req.params;
    const { tourist_place_name, description, opening_time, closing_time, location, avatar } = req.body;
    try {
        const utouristplace = await Touristplace.findByIdAndUpdate(
            id,
            { tourist_place_name, description, opening_time, closing_time, location, avatar },
            { new: true }
        );
        if (!utouristplace) {
            return res.status(400).json("tourist place not found");
        }
        res.status(200).json(utouristplace);
    } catch (error) {
        res.status(400).json("tourist places updation failed");
    }
};

const deletetouristplace = async (req, res) => {
    const { id } = req.params;
    try {
        const dtouristplace = await Touristplace.findByIdAndDelete(id);
        if (!dtouristplace) {
            return res.status(400).json("tourist place not found");
        }
        // ❌ BUG FIXED: Sent a success response
        res.status(200).json({ message: "Tourist place deleted successfully" }); 
    } catch (error) {
        res.status(400).json("deletion failed");
    }
};

export { 
    addtouristplace, 
    getAllTouristplaces, 
    getMyTouristplaces, 
    updatetouristplace, 
    deletetouristplace 
};