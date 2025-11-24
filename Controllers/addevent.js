
import {Event} from "../models/Event.js"
import {uploadonCloudinary} from "../utils/cloudnary.js"

const addevent=(async(req,res)=>{
    try {
        const userId = req.user.userId || req.user._id;
        const {event_name,description,date,location,time}=req.body;
        const avatarlocalPath=req.file?.path;
    if(!avatarlocalPath){
       return res.status(400).json("image not fetch");
    }
    console.log("image fethed")
    const image=await uploadonCloudinary(avatarlocalPath);

    if(!image){
        return res.status(400).json("Image file is required");
    }
    const newEvent=new Event({
        event_name,
        avatar:image.url,
        description,
        date,
        location,
        time,
        createdBy: userId
    })
    const savedevent=await newEvent.save()
    res.status(201).json(savedevent)
    res.status(201).json({status:true,message:"event created sucessfully"})
}catch(error){
    console.error(error)
    return res.status(500).json({error:"event creation failed"})
}
})

const updateevent = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch existing event first
    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      return res.status(404).json("event not found");
    }

    // Merge new values (only if provided)
    const updatedData = {
      event_name: req.body.event_name || existingEvent.event_name,
      description: req.body.description || existingEvent.description,
      date: req.body.date || existingEvent.date,
      location: req.body.location || existingEvent.location,
      time: req.body.time || existingEvent.time,
      avatar: req.body.avatar || existingEvent.avatar
    };

    const updatedEvent = await Event.findByIdAndUpdate(id, updatedData, { new: true });
    res.status(200).json({ message: "event updated successfully", updatedEvent });

  } catch (error) {
    console.error(error);
    res.status(500).json("event updation failed");
  }
};
const deleteevent=async(req,res)=>{
    const {id}=req.params;
    try {
        const devent=await Event.findByIdAndDelete(id);
        if(!devent){
            return res.status(400).json("event not found")
        }
    } catch (error) {
        res.status(400).json("event deletion failed")
    }
}
// 1. FOR TOURISTS (Dashboard) - Shows Everything
const getAllEvents = async (req, res) => {
    try {
        // .find() without arguments returns EVERYTHING
        // .populate('createdBy', 'username') is optional if you want to show who posted it
        const events = await Event.find().populate('createdBy', 'username'); 
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json("Error fetching events");
    }
};

// 2. FOR LOCALS (My Dashboard) - Shows Only Theirs
const getMyEvents = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // FILTER: Only find events where createdBy == userId
        const myEvents = await Event.find({ createdBy: userId }); 
        
        res.status(200).json(myEvents);
    } catch (error) {
        res.status(500).json("Error fetching your events");
    }
};


export{addevent,updateevent,deleteevent,getAllEvents, getMyEvents};