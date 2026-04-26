import express from "express";
const router = express.Router();
import authentication from "../middleware/authentication.js";
import { getMyNotifications, markAsRead } from "../Controllers/notification.js";

router.get("/", authentication, getMyNotifications);
router.patch("/read/:id", authentication, markAsRead);

export default router;