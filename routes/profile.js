import express from "express";
import authentication from "../middleware/authentication.cjs";
import { upload } from "../middleware/multer.js";
import { getProfile, updateProfile } from "../Controllers/profile.js";

const router = express.Router();

router.get("/", authentication, getProfile);
router.post("/update", authentication, upload.single("avatar"), updateProfile);

export default router;