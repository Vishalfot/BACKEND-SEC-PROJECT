import express from "express"
const router=express.Router();
import {upload} from "../middleware/multer.js"
import authentication from "../middleware/authentication.js";
import {addevent,getAllEvents, getMyEvents,updateevent,deleteevent} from "../Controllers/addevent.js"

router.post("/addevent",authentication,upload.fields([{name:"avatar",maxCount:1},{name: "license", maxCount: 1 }]),addevent);
router.put("/updateevent/:id", authentication, updateevent);
router.delete("/deleteevent/:id", authentication, deleteevent);
router.get("/all", getAllEvents);
router.get("/myevents", authentication, getMyEvents);
export default router;