import express from "express"
const router=express.Router()
import { upload } from "../middleware/multer.js"
import { addproduct,getproduct,updateproduct,deleteproduct } from "../Controllers/addproduct.js";

router.post("/addproduct",upload.single("avatar"),addproduct);
router.get("/",getproduct);
router.put("/:id",updateproduct);
router.delete("/:id",deleteproduct);

export default router;