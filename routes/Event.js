import express from "express"
const router=express.Router();
import {upload} from "../middleware/multer.js"
import authentication from "../middleware/authentication.cjs";
import {addevent,getAllEvents, getMyEvents,updateevent,deleteevent} from "../Controllers/addevent.js"

router.post("/addevent",authentication,upload.single("avatar"),addevent);
router.put("/updateevent/:id",updateevent);
router.delete("/deleteevent/:id",deleteevent);
router.get("/all", getAllEvents);
router.get("/myevents", authentication, getMyEvents);
export default router;