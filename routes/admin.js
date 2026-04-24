// routes/admin.js
import express from "express";
import authentication from "../middleware/authentication.js";
import isAdmin from "../middleware/isAdmin.js";
import { 
    getPendingProfiles, 
    verifyProfile, 
    getPendingEvents, 
    verifyEvent,
    getPendingProducts,
    verifyProduct,
    getPendingWeddings,
    verifyWedding,
    getPendingTouristPlaces,
    verifyTouristPlace,
    getAllAdminPlaces,
    getApprovedLocals,
    getLocalPortfolio,
    getAdminStats,
    getAllEvents,
    getAllProducts,
    getAllWeddings,
    getAllTouristPlaces,
    getAllProfiles
} from "../Controllers/admin.js";

const router = express.Router();

// Apply both middlewares to ALL routes in this file
router.use(authentication, isAdmin);

// --- Profile Verification ---
router.get("/profiles/pending", getPendingProfiles);
router.put("/profiles/verify/:profileId", verifyProfile);

// --- Event Verification ---
router.get("/events/pending", getPendingEvents);
router.put("/events/verify/:eventId", verifyEvent);

// --- Product Verification ---
router.get("/products/pending", getPendingProducts);
router.put("/products/verify/:productId", verifyProduct);

// --- Wedding Venue Verification ---
router.get("/weddings/pending", getPendingWeddings);
router.put("/weddings/verify/:weddingId", verifyWedding);

// --- Tourist Place Verification ---
router.get("/touristplaces/pending", getPendingTouristPlaces);
router.put("/touristplaces/verify/:placeId", verifyTouristPlace);

// --- Heritage Places For Map ---
router.get("/places/all", getAllAdminPlaces);

// --- Admin Analytics ---
router.get("/stats/overview", getAdminStats);

// --- All Items (for filtering) ---
router.get("/events/all", getAllEvents);
router.get("/products/all", getAllProducts);
router.get("/weddings/all", getAllWeddings);
router.get("/touristplaces/all", getAllTouristPlaces);
router.get("/profiles/all", getAllProfiles);

// --- Local Partner Portfolios ---
router.get("/locals/all", getApprovedLocals);
router.get("/locals/portfolio/:userId", getLocalPortfolio);

export default router;
