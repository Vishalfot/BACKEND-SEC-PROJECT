import { Weddingplace } from "../models/weddings.js";
import {uploadonCloudinary} from "../utils/cloudnary.js"

const addwedding=(async(req,res)=>{
    try {
        const userId = req.user.userId || req.user._id;
        const {wedding_venue,description,location,time,long,latitude,date}=req.body;
        const avatarlocalPath=req.file?.path;
    if(!avatarlocalPath){
       return res.status(400).json("wedding place image not fetched");
    }
    
    const weddingplace_image=await uploadonCloudinary(avatarlocalPath);

    if(!weddingplace_image){
        return res.status(400).json("wedding place Image file is required");
    }
    const newWeddingplace=new Weddingplace({
        wedding_venue,description,location,time,long,latitude,date,
        avatar:weddingplace_image.url,createdBy: userId
    })
    const savedweddingplace=await newWeddingplace.save()
    res.status(201).json(savedweddingplace)
}catch(error){
    console.error(error)
    return res.status(500).json({error:"wedding place addition failed"})
}
})
const updateweddingdetails=(async(req,res)=>{
    const {id}=req.params;
    const{wedding_venue,description,location,time,long,latitude,date,avatar}=req.body
    try {
        const uweddingplace=await Weddingplace.findByIdAndUpdate(
            id,
            {wedding_venue,description,location,time,long,latitude,date,avatar},
            {new:true}
        )
        if(!uweddingplace){
            return res.status(400).json("wedding place not found")
        }
        res.status(200).json(uweddingplace)
    } catch (error) {
        res.status(400).json("wedding places updation failed")
    }
})

const deleteweddingdetails=async(req,res)=>{
    const {id}=req.params;
    try {
        const dweddingplace=await Weddingplace.findByIdAndDelete(id);
        if(!dweddingplace){
            return res.status(400).json("wedding place not found")
        }
    } catch (error) {
        res.status(400).json(" deletion failed")
    }
}
// 1. FOR TOURISTS (Dashboard) - Shows Everything
const getAllWeddings = async (req, res) => {
    try {
        // .find() without arguments returns EVERYTHING
        // .populate('createdBy', 'username') is optional if you want to show who posted it
        const events = await Weddingplace.find().populate('createdBy', 'username'); 
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json("Error fetching events");
    }
};

// 2. FOR LOCALS (My Dashboard) - Shows Only Theirs
const getMyWeddings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // FILTER: Only find events where createdBy == userId
        const myEvents = await Weddingplace.find({ createdBy: userId }); 
        
        res.status(200).json(myEvents);
    } catch (error) {
        res.status(500).json("Error fetching your events");
    }
};



export{addwedding,getAllWeddings, getMyWeddings,updateweddingdetails,deleteweddingdetails}