import express from "express"
const router=express.Router()
import { upload } from "../middleware/multer.js"
import authentication from "../middleware/authentication.cjs";
import { addwedding,updateweddingdetails,deleteweddingdetails, getAllWeddings, getMyWeddings} from "../Controllers/wedding.js";

router.post("/addwedding",authentication,upload.single("avatar"),addwedding);
router.get("/all", getAllWeddings);
router.get("/myweddings",authentication, getMyWeddings);
router.put("/updatewedding/:id",updateweddingdetails);
router.delete("/deletewedding/:id",deleteweddingdetails);

export default router;