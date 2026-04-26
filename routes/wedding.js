import express from "express";
const router = express.Router();
import { upload } from "../middleware/multer.js";
import authentication from "../middleware/authentication.js";
import {
    addwedding,
    updateweddingdetails,
    deleteweddingdetails,
    getAllWeddings,
    getMyWeddings
} from "../Controllers/wedding.js";

// ── CREATE ──
// Matches: POST /api/weddings/add
// Note: Handlers both the image and the mandatory legal license
router.post(
    "/add",
    authentication,
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "license", maxCount: 1 }
    ]),
    addwedding
);

// ── READ (Public) ──
// Matches: GET /api/weddings/all
router.get("/all", getAllWeddings);

// ── READ (Private/Partner) ──
// Matches: GET /api/weddings/myweddings
router.get("/myweddings", authentication, getMyWeddings);

// ── UPDATE ──
// Matches: PATCH /api/weddings/update/:id
router.patch("/update/:id", authentication, updateweddingdetails);

// ── DELETE ──
// Matches: DELETE /api/weddings/delete/:id
router.delete("/delete/:id", authentication, deleteweddingdetails);

export default router;