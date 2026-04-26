import { Notification } from "../models/Notification.js";

// Get all notifications for the logged-in user
export const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const notifications = await Notification.find({ recipient: userId })
            .sort("-createdAt")
            .limit(20);
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};

// Mark a specific notification as read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
};