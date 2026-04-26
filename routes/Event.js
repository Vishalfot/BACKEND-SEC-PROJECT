import express from "express";
const router = express.Router();
import { upload } from "../middleware/multer.js";
import authentication from "../middleware/authentication.js";
// Ensure this path matches your filename (e.g., eventController.js or addevent.js)
import { addevent, getAllEvents, getMyEvents, updateevent, deleteevent } from "../Controllers/addevent.js";

// ── CREATE ──
// Matches: POST /api/events/add
router.post(
    "/add",
    authentication,
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "license", maxCount: 1 }
    ]),
    addevent
);

// ── UPDATE ──
// Matches: PATCH /api/events/update/:id
router.patch("/update/:id", authentication, updateevent);

// ── DELETE ──
// Matches: DELETE /api/events/delete/:id
router.delete("/delete/:id", authentication, deleteevent);

// ── READ (Public) ──
// Matches: GET /api/events/all
router.get("/all", getAllEvents);

// ── READ (Private) ──
// Matches: GET /api/events/myevents
router.get("/myevents", authentication, getMyEvents);

export default router;