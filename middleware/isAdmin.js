import User from "../models/User.js";

const isAdmin = async (req, res, next) => {
    try {
        // req.user comes from your previous isAuth middleware
        const userId = req.user.userId || req.user._id;

        // Use .select('role') to only fetch the necessary field from DB
        const user = await User.findById(userId).select("role");

        if (!user || user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access Denied. Admin resources only."
            });
        }

        next();
    } catch (error) {
        console.error("Admin verification failed:", error);
        res.status(500).json({ success: false, message: "Admin verification failed: " + error.message });
    }
};

export default isAdmin;