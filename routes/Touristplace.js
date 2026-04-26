import express from "express";
const router = express.Router();
import { upload } from "../middleware/multer.js";
import authentication from "../middleware/authentication.js";
import {
    addtouristplace,
    getAllTouristplaces,
    getMyTouristplaces,
    updatetouristplace,
    deletetouristplace
} from "../Controllers/addtouristplace.js";

// ── CREATE ──
// Matches: POST /api/touristplaces/add
// Locals suggest a "Hidden Gem" with one primary photo
router.post("/add", authentication, upload.single("avatar"), addtouristplace);

// ── READ (Public) ──
// Matches: GET /api/touristplaces/all
// Tourists search for verified hidden gems
router.get("/all", getAllTouristplaces);

// ── READ (Private) ──
// Matches: GET /api/touristplaces/myplaces
// Locals see the status of gems they have submitted
router.get("/myplaces", authentication, getMyTouristplaces);

// ── UPDATE ──
// Matches: PATCH /api/touristplaces/update/:id
router.patch("/update/:id", authentication, updatetouristplace);

// ── DELETE ──
// Matches: DELETE /api/touristplaces/delete/:id
router.delete("/delete/:id", authentication, deletetouristplace);

export default router;