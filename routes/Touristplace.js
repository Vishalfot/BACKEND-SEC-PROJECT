import express from "express"
const router=express.Router()
import { upload } from "../middleware/multer.js"
import { addtouristplace,gettouristplace,updatetouristplace,deletetouristplace } from "../Controllers/addtouristplace.js";

router.post("/addtouristplace",upload.single("avatar"),addtouristplace);
router.get("/",gettouristplace);
router.put("/:id",updatetouristplace);
router.delete("/:id",deletetouristplace);

export default router;