import express from "express"
const router=express.Router();
import {upload} from "../middleware/multer.js"
import {addevent,getevent,updateevent,deleteevent} from "../Controllers/addevent.js"

router.post("/addevent",upload.single("avatar"),addevent);
router.get("/",getevent);
router.put("/:id",updateevent);
router.delete("/:id",deleteevent);

export default router;