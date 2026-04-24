import { Profile } from "../models/Profile_temp.js";
import User from "../models/User.js";
import { uploadonCloudinary } from "../utils/cloudnary.js";

// 1. GET PROFILE
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // Find profile linked to this user and populate user info
        const profile = await Profile.findOne({ user: userId }).populate("user", "username email role");

        if (!profile) {
            // If no profile, still return the User object so frontend can show username
            const user = await User.findById(userId).select("username email role");
            return res.status(200).json({ user });
        }
        res.status(200).json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching profile" });
    }
};

// 2. UPDATE/CREATE PROFILE
// const updateProfile = async (req, res) => {
//     try {
//         const userId = req.user.userId || req.user._id;
        
//         // Collect all possible fields
//         const { name, about, country, interests, city, experience, contact } = req.body;
//         if (!role) {
//             return res.status(400).json({ message: "Role (tourist or local) is required" });
//         }
//         // Prepare data object
//         let updateData = {
//             name, about, country, interests, city, experience, contact
//         };
//         if (role === "tourist") {
//             updateData.verification_status = "not_required";
//         } else if (role === "local") {
//             // If they are a local, they must be verified by admin
//             updateData.verification_status = "pending";
//         }
//         // Handle Image Upload (if user selected a new file)
//         if (req.file) {
//             const avatarLocalPath = req.file.path;
//             const idDocLocalPath = req.files?.id_document?.[0]?.path;
//             const avatarCloud = await uploadonCloudinary(avatarLocalPath);
//             if (avatarCloud) {
//                 updateData.avatar = avatarCloud.url;
//             }

//         }

//         // Find and Update (or Create if not exists -> upsert: true)
//         const profile = await Profile.findOneAndUpdate(
//             { user: userId },
//             { $set: updateData },
//             { new: true, upsert: true } // Magic line: Creates if missing, Updates if exists
//         );

//         res.status(200).json({ message: "Profile updated!", profile });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Error updating profile" });
//     }
// };
// 2. UPDATE/CREATE PROFILE
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // ❌ BUG 1 FIXED: Added 'role' to the destructuring
        let { role, name, about, country, interests, city, experience, contact } = req.body;
        
        // Fallback to role from token if not in body
        if (!role && req.user && req.user.role) {
            role = req.user.role;
        }

        if (!role) {
            return res.status(400).json({ message: "Role is required" });
        }

        // Standardize role names for the Profile model enum: ["tourist", "local", "Shopper"]
        let modelRole = role;
        if (role.toLowerCase() === "tourist") modelRole = "tourist";
        else if (role.toLowerCase() === "local") modelRole = "local";
        else if (role.toLowerCase() === "shopper") modelRole = "Shopper";

        // Prepare data object
        let updateData = {
            role: modelRole, name, about, country, interests, city, experience, contact
        };

        if (role === "tourist") {
            updateData.verification_status = "not_required";
        } else if (role === "local") {
            updateData.verification_status = "pending";
        }

        // ❌ BUG 2 FIXED: Changed req.file to req.files and moved it outside the if-statement
        const avatarLocalPath = req.files?.avatar?.[0]?.path;
        const idDocLocalPath = req.files?.id_document?.[0]?.path;

        // Handle Avatar Upload
        if (avatarLocalPath) {
            const avatarCloud = await uploadonCloudinary(avatarLocalPath);
            if (avatarCloud) {
                updateData.avatar = avatarCloud.secure_url; // secure_url is better practice than url
            }
        }

        // ❌ BUG 3 FIXED: Actually upload the ID document and save it to updateData
        if (idDocLocalPath && role === "local") {
            const idCloud = await uploadonCloudinary(idDocLocalPath);
            if (idCloud) {
                updateData.id_document = idCloud.secure_url;
            }
        }

        // Find and Update (or Create if not exists -> upsert: true)
        const profile = await Profile.findOneAndUpdate(
            { user: userId },
            { $set: updateData },
            { new: true, upsert: true } // Magic line: Creates if missing, Updates if exists
        );

        // Optional: Make the success message match what just happened
        const successMessage = role === "local" 
            ? "Profile updated! Awaiting Admin verification." 
            : "Profile updated!";

        res.status(200).json({ message: successMessage, profile });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating profile" });
    }
};
export { getProfile, updateProfile };