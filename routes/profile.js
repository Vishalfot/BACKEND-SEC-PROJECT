import express from "express";
import authentication from "../middleware/authentication.js";
import { upload } from "../middleware/multer.js";
import { getProfile, updateProfile } from "../Controllers/profile.js";

const router = express.Router();

router.get("/", authentication, getProfile);
router.post("/update", authentication, upload.fields([{name:"avatar",maxCount:1},{name: "id_document", maxCount: 1}]),updateProfile);

export default router;