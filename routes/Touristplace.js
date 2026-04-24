import express from "express"
const router=express.Router()
import { upload } from "../middleware/multer.js"
import authentication from "../middleware/authentication.js"
import { 
    addtouristplace, 
    getAllTouristplaces, 
    getMyTouristplaces, 
    updatetouristplace, 
    deletetouristplace 
} from "../Controllers/addtouristplace.js";

router.post("/addtouristplace", authentication, upload.single("avatar"), addtouristplace);
router.get("/all", getAllTouristplaces);
router.get("/myplaces", authentication, getMyTouristplaces);
router.put("/update/:id", authentication, updatetouristplace);
router.delete("/delete/:id", authentication, deletetouristplace);

export default router;