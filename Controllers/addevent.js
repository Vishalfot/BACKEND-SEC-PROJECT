
// import Event from "../models/Event.js"
// import {uploadonCloudinary} from "../utils/cloudnary.js"

// const addevent=(async(req,res)=>{
//     try {
//         const userId = req.user.userId || req.user._id;
//         const {event_name,description,date,location,time}=req.body;
//         const avatarlocalPath=req.file?.path;
//     if(!avatarlocalPath){
//        return res.status(400).json("image not fetch");
//     }
//     console.log("image fethed")
//     const image=await uploadonCloudinary(avatarlocalPath);

//     if(!image){
//         return res.status(400).json("Image file is required");
//     }
//     // const newEvent=new Event({
//     //     event_name,
//     //     avatar:image.url,
//     //     description,
//     //     date,
//     //     location,
//     //     time,
//     //     createdBy: userId
//     // })
//     const newEvent = new Event({
//        event_name,
//        description,
//        place_ref,
//        experience_type, // from frontend
//        event_date,
//        start_time,
//        end_time,
//        location: {
//          type: "Point",
//          coordinates: [longitude, latitude]
//        },
//       avatar: image.secure_url,
//       createdBy: userId,
//       verified: false
//     });
//     const savedevent=await newEvent.save()
//     res.status(201).json(savedevent)
//     res.status(201).json({status:true,message:"event created sucessfully"})
// }catch(error){
//     console.error(error)
//     return res.status(500).json({error:"event creation failed"})
// }
// })

// const updateevent = async (req, res) => {
//   const { id } = req.params;

//   try {
//     // Fetch existing event first
//     const existingEvent = await Event.findById(id);
//     if (!existingEvent) {
//       return res.status(404).json("event not found");
//     }

//     // Merge new values (only if provided)
//     const updatedData = {
//       event_name: req.body.event_name || existingEvent.event_name,
//       description: req.body.description || existingEvent.description,
//       date: req.body.date || existingEvent.date,
//       location: req.body.location || existingEvent.location,
//       time: req.body.time || existingEvent.time,
//       avatar: req.body.avatar || existingEvent.avatar
//     };

//     const updatedEvent = await Event.findByIdAndUpdate(id, updatedData, { new: true });
//     res.status(200).json({ message: "event updated successfully", updatedEvent });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json("event updation failed");
//   }
// };
// const deleteevent=async(req,res)=>{
//     const {id}=req.params;
//     try {
//         const devent=await Event.findByIdAndDelete(id);
//         if(!devent){
//             return res.status(400).json("event not found")
//         }
//     } catch (error) {
//         res.status(400).json("event deletion failed")
//     }
// }
// // 1. FOR TOURISTS (Dashboard) - Shows Everything
// const getAllEvents = async (req, res) => {
//     try {
//         // .find() without arguments returns EVERYTHING
//         // .populate('createdBy', 'username') is optional if you want to show who posted it
//         const events = await Event.find().populate('createdBy', 'username'); 
//         res.status(200).json(events);
//     } catch (error) {
//         res.status(500).json("Error fetching events");
//     }
// };

// // 2. FOR LOCALS (My Dashboard) - Shows Only Theirs
// const getMyEvents = async (req, res) => {
//     try {
//         const userId = req.user.userId || req.user._id;
        
//         // FILTER: Only find events where createdBy == userId
//         const myEvents = await Event.find({ createdBy: userId }); 
        
//         res.status(200).json(myEvents);
//     } catch (error) {
//         res.status(500).json("Error fetching your events");
//     }
// };


// export{addevent,updateevent,deleteevent,getAllEvents, getMyEvents};

// Controllers/addevent.js - REPLACE YOUR CURRENT FILE WITH THIS
import Event from "../models/Event.js";
import { Profile } from "../models/Profile_temp.js";
import { uploadonCloudinary } from "../utils/cloudnary.js";

const addevent = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    // ✅ BUG FIXED: Moved Gatekeeper INSIDE the function where userId and res exist!
    const userProfile = await Profile.findOne({ user: userId });
    if (!userProfile || userProfile.verification_status !== "approved") {
        return res.status(403).json({ 
            error: "You cannot add events until your Local Profile is verified by an admin." 
        });
    }
    
    // EXTRACT ALL REQUIRED FIELDS
    const {
      event_name,
      description,          
      address,            
      experience_type,      
      event_date,           
      start_time,           
      end_time,             
      latitude,
      longitude,
      tags,
      price,
      capacity
    } = req.body;

    // Validate
    if (!event_name || !description || !address || !event_date || !start_time || !end_time) {
      return res.status(400).json({ 
        error: "Missing required: event_name, description, address, event_date, start_time, end_time" 
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Missing coordinates: Please pin location on map" });
    }

    // Image upload
    const avatarlocalPath = req.files?.avatar?.[0]?.path;
    const licenseLocalPath = req.files?.license?.[0]?.path;
    
    if (!avatarlocalPath || !licenseLocalPath) {
      return res.status(400).json({ error: "Both an Image and a License/Permit are required" });
    }

    const image = await uploadonCloudinary(avatarlocalPath);
    const licenseDoc = await uploadonCloudinary(licenseLocalPath);
    
    if (!image || !licenseDoc) {
      return res.status(400).json({ error: "Files upload failed" });
    }

    // Parse tags
    const tagArray = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : (tags || []);

    // Use coordinates from request directly
    const coords = [parseFloat(longitude), parseFloat(latitude)];

    // Create event
    const newEvent = new Event({
      event_name,
      description,  
      address,
      experience_type: experience_type || "local_experience",
      event_date: new Date(event_date),
      start_time,
      end_time,
      location: {
        type: "Point",
        coordinates: coords
      },
      avatar: image.secure_url,
      license_url: licenseDoc.secure_url,
      tags: tagArray,
      price: parseFloat(price) || 0,
      capacity: parseInt(capacity) || null,
      createdBy: userId,
      verified: false  
    });

    const savedEvent = await newEvent.save();
    
    res.status(201).json({
      status: true,
      message: "Event Submitted successfully. Awaiting Admin Verification",
      event: savedEvent
    });

  } catch (error) {
    console.error("Event creation error:", error);
    return res.status(500).json({ 
      error: "Event creation failed", 
      details: error.message 
    });
  }
};

const updateevent = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId || req.user._id;
  try {
    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      return res.status(404).json({ error: "Event not found" });
    }
    // ✅ Ownership check
    if (existingEvent.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You are not authorized to update this event" });
    }

    const updatedData = {
      event_name: req.body.event_name || existingEvent.event_name,
      description: req.body.description || existingEvent.description,
      event_date: req.body.event_date || existingEvent.event_date,
      start_time: req.body.start_time || existingEvent.start_time,
      end_time: req.body.end_time || existingEvent.end_time,
      experience_type: req.body.experience_type || existingEvent.experience_type,
      price: req.body.price || existingEvent.price
    };

    const updatedEvent = await Event.findByIdAndUpdate(id, updatedData, { new: true });
    res.status(200).json({ message: "Event updated", updatedEvent });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Update failed" });
  }
};

const deleteevent = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId || req.user._id;
  try {
    const existing = await Event.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Event not found" });
    }
    // ✅ Ownership check
    if (existing.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You are not authorized to delete this event" });
    }
    await Event.findByIdAndDelete(id);
    res.status(200).json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
};

// FOR TOURISTS - All verified events
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find({verified:true})
      .populate('createdBy', 'username');
      
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
};

// FOR LOCALS - Their events only
const getMyEvents = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const myEvents = await Event.find({ createdBy: userId });
      
    res.status(200).json(myEvents);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
};

export { addevent, updateevent, deleteevent, getAllEvents, getMyEvents };