import express from "express";
const router = express.Router();
import { upload } from "../middleware/multer.js";
import authentication from "../middleware/authentication.js";
import {
    submitHomestay,
    getAllHomestays,
    getMyHomestays,
    getHomestayById,
    deleteHomestay,
    updateHomestay
} from "../Controllers/Homestay.js";

// ── LOCAL HOST ROUTES (Private) ──

// Matches: GET /api/homestays/my-listings
// Allows hosts to see their pending/approved homestays
router.get("/my-listings", authentication, getMyHomestays);

// Matches: POST /api/homestays/add
// Allows locals to list their home (Avatar/Image required)
router.post("/add", authentication, upload.single("avatar"), submitHomestay);

// Matches: PUT /api/homestays/update/:id
// Resubmits for verification on update
router.put("/update/:id", authentication, updateHomestay);

// Matches: DELETE /api/homestays/delete/:id
// Securely remove a listing (Ownership check inside controller)
router.delete("/delete/:id", authentication, deleteHomestay);


// ── TOURIST ROUTES (Public) ──

// Matches: GET /api/homestays/all
// Supports: Proximity search via ?lat=X&lng=Y
router.get("/all", getAllHomestays);

// Matches: GET /api/homestays/:id
// Get full details of a specific homestay
router.get("/:id", getHomestayById);

export default router;