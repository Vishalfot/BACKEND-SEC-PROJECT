import { Profile } from "../models/Profile_temp.js";
import { uploadonCloudinary } from "../utils/cloudnary.js"; // Your existing util

// 1. GET PROFILE
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // Find profile linked to this user
        const profile = await Profile.findOne({ user: userId });

        if (!profile) {
            return res.status(200).json({}); // Return empty object if no profile yet
        }
        res.status(200).json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching profile" });
    }
};

// 2. UPDATE/CREATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // Collect all possible fields
        const { name, about, country, interests, city, experience, contact } = req.body;
        
        // Prepare data object
        let updateData = {
            name, about, country, interests, city, experience, contact
        };

        // Handle Image Upload (if user selected a new file)
        if (req.file) {
            const avatarLocalPath = req.file.path;
            const avatarCloud = await uploadonCloudinary(avatarLocalPath);
            if (avatarCloud) {
                updateData.avatar = avatarCloud.url;
            }
        }

        // Find and Update (or Create if not exists -> upsert: true)
        const profile = await Profile.findOneAndUpdate(
            { user: userId },
            { $set: updateData },
            { new: true, upsert: true } // Magic line: Creates if missing, Updates if exists
        );

        res.status(200).json({ message: "Profile updated!", profile });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating profile" });
    }
};

export { getProfile, updateProfile };