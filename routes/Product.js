import express from "express"
const router=express.Router()
import { upload } from "../middleware/multer.js"
import authentication from "../middleware/authentication.cjs";
import { addproduct,updateproduct,deleteproduct, getAllProducts, getMyProducts } from "../Controllers/addproduct.js";

router.post("/addproduct",authentication,upload.single("avatar"),addproduct);
router.get("/all", getAllProducts);
router.get("/myproducts", authentication, getMyProducts);
router.put("/updateproduct/:id",updateproduct);
router.delete("/deleteproduct/:id",deleteproduct);

export default router;