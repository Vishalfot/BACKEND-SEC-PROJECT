import express from "express"
const router=express.Router();
import {upload} from "../middleware/multer.js"
import {addevent} from "../Controllers/addevent.js"

router.post("/addevent",upload.single("avatar"),addevent);
router.get("/",getevent);
router.put("/:id",updateevent);
router.delete("/:id",deleteevent);
