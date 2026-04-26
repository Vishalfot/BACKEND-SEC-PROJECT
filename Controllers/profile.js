import { Profile } from "../models/Profile_temp.js";
import Usermodel from "../models/User.js"; // Correct import
import { uploadonCloudinary } from "../utils/cloudnary.js";

// 1. GET PROFILE
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        const profile = await Profile.findOne({ user: userId })
            .populate("user", "username email role coins avatar"); // ✅ Get Coins from User model

        if (!profile) {
            const user = await Usermodel.findById(userId).select("username email role coins avatar");
            return res.status(200).json({ user, message: "Profile not yet created." });
        }
        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: "Error fetching profile" });
    }
};

// 2. UPDATE/CREATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const { name, about, country, interests, city, experience, contact } = req.body;
        const role = req.user.role; // Get from token to prevent role-spoofing

        let updateData = { name, about, country, city, experience, contact };

        // Handle Array conversion for interests
        if (interests) {
            updateData.interests = interests.split(",").map(i => i.trim());
        }

        // Verification Logic
        if (role === "Local") {
            updateData.verification_status = "pending";
        } else {
            updateData.verification_status = "not_required";
        }

        // Uploads
        if (req.files?.avatar) {
            const avatarCloud = await uploadonCloudinary(req.files.avatar[0].path);
            if (avatarCloud) {
                updateData.avatar = avatarCloud.secure_url;
                // ✅ SYNC: Update the Avatar in the User model too
                await Usermodel.findByIdAndUpdate(userId, { avatar: avatarCloud.secure_url });
            }
        }

        if (req.files?.id_document && role === "Local") {
            const idCloud = await uploadonCloudinary(req.files.id_document[0].path);
            if (idCloud) updateData.id_document = idCloud.secure_url;
        }

        const profile = await Profile.findOneAndUpdate(
            { user: userId },
            { $set: { ...updateData, role } },
            { new: true, upsert: true }
        );

        res.status(200).json({
            message: role === "Local" ? "Local profile submitted for verification!" : "Profile updated!",
            profile
        });

    } catch (error) {
        res.status(500).json({ message: "Error updating profile" });
    }
};

export { getProfile, updateProfile };