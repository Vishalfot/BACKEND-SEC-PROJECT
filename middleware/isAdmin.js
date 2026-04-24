// middleware/isAdmin.js
import User from "../models/User.js"; // Adjust path if needed

const isAdmin = async (req, res, next) => {
    try {
        const userId = req.user.userId || req.user._id;
        const user = await User.findById(userId);

        // Assuming your User model has a role field. 
        // If not, you need to add `role: { type: String, enum: ['user', 'admin'], default: 'user' }` to User.js
        if (!user || user.role !== "admin") {
            return res.status(403).json({ message: "Access Denied. Admin resources only." });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ message: "Admin verification failed." });
    }
};

export default isAdmin;