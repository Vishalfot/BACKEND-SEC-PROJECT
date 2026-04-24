import express from "express"
const router=express.Router()
import { upload } from "../middleware/multer.js"
import authentication from "../middleware/authentication.js";
import { addwedding,updateweddingdetails,deleteweddingdetails, getAllWeddings, getMyWeddings} from "../Controllers/wedding.js";

router.post("/addwedding",authentication,upload.fields([{name:"avatar",maxCount:1},{ name: "license", maxCount: 1 }]),addwedding);
router.get("/all", getAllWeddings);
router.get("/myweddings",authentication, getMyWeddings);
router.put("/updatewedding/:id", authentication, updateweddingdetails);
router.delete("/deletewedding/:id", authentication, deleteweddingdetails);

export default router;