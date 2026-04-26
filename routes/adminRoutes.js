import express from "express";
import authentication from "../middleware/authentication.js";
import isAdmin from "../middleware/isAdmin.js";
import {
    getPendingItems,
    getAllItems,
    verifyContent,
    getPendingProfiles,
    getAllProfiles,
    verifyProfile,
    getAdminStats,
    getAllLocals,
    getLocalPortfolio,
    sendAdminMessage
} from "../Controllers/adminController.js";

const router = express.Router();

// All routes here are protected by both Auth and Admin middleware
router.use(authentication, isAdmin);

// Dashboard Stats 
router.get("/stats", getAdminStats);

// Profile & Local Partner Management
router.get("/profiles/pending", getPendingProfiles);
router.get("/profiles/all", getAllProfiles); // Matches: GET /api/admin/profiles/all
router.get("/locals/all", getAllLocals);      // Matches: GET /api/admin/locals/all
router.patch("/profiles/verify/:profileId", verifyProfile);

// Portfolio Review
router.get("/locals/portfolio/:userId", getLocalPortfolio);

// Generic Content Verification (event, product, wedding, place, homestay)
router.get("/pending/:contentType", getPendingItems);
router.get("/:contentType/all", getAllItems); // Matches: GET /api/admin/weddings/all etc.
router.patch("/verify/:contentType/:id", verifyContent);
// Matches: POST /api/admin/send-message
router.post("/send-message", sendAdminMessage);

export default router;