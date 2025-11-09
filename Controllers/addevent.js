
import {Event} from "../models/Event.js"
import {uploadonCloudinary} from "../utils/cloudnary.js"

const addevent=(async(req,res)=>{
    try {
        const {event_name,description,date,location,time,category}=req.body;
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
        category
    })
    const savedevent=await newEvent.save()
    res.status(201).json(savedevent)
}catch(error){
    console.error(error)
    return res.status(500).json({error:"event creation failed"})
}
})
const getevent=(async(req,res)=>{
    try{
        const events=await Event.find();
        res.status(200).json(events)
    }catch(error){
        res.status(400).json("event not able to fetch")
    }
})
const updateevent=(async(req,res)=>{
    const {id}=req.params;
    const{event_name,description,date,location,time,category,avatar}=req.body
    try {
        const uevent=await Event.findByIdAndUpdate(
            id,
            {event_name,description,date,location,time,category,avatar},
            {new:true}
        )
        if(!uevent){
            return res.status(400).json("event not found")
        }
        res.status(200).json(uevent)
    } catch (error) {
        res.status(400).json("event updation failed")
    }
})

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

export{addevent,getevent,updateevent,deleteevent}