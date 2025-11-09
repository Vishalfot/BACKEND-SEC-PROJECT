import { Touristplace } from "../models/Touristplace.js";
import {uploadonCloudinary} from "../utils/cloudnary.js"

const addtouristplace=(async(req,res)=>{
    try {
        const {tourist_place_name,description,opening_time,closing_time}=req.body;
        const avatarlocalPath=req.file?.path;
    if(!avatarlocalPath){
       return res.status(400).json("tourist place image not fetched");
    }
    
    const touristplace_image=await uploadonCloudinary(avatarlocalPath);

    if(!touristplace_image){
        return res.status(400).json("tourist place Image file is required");
    }
    const newTouristplace=new Touristplace({
        tourist_place_name,
        description,
        opening_time,
        closing_time,
        avatar:touristplace_image.url
    })
    const savedtouristplace=await newTouristplace.save()
    res.status(201).json(savedtouristplace)
}catch(error){
    console.error(error)
    return res.status(500).json({error:"Tourist place addition failed"})
}
})
const gettouristplace=(async(req,res)=>{
    try{
        const touristplaces=await Touristplace.find();
        res.status(200).json(touristplaces)
    }catch(error){
        res.status(400).json("tourist places not able to fetch")
    }
})
const updatetouristplace=(async(req,res)=>{
    const {id}=req.params;
    const{tourist_place_name,description,opening_time,closing_time,avatar}=req.body
    try {
        const utouristplace=await Touristplace.findByIdAndUpdate(
            id,
            {tourist_place_name,description,opening_time,closing_time,avatar},
            {new:true}
        )
        if(!utouristplace){
            return res.status(400).json("tourist place not found")
        }
        res.status(200).json(utouristplace)
    } catch (error) {
        res.status(400).json("tourist places updation failed")
    }
})

const deletetouristplace=async(req,res)=>{
    const {id}=req.params;
    try {
        const dtouristplace=await Touristplace.findByIdAndDelete(id);
        if(!dtouristplace){
            return res.status(400).json("tourist place not found")
        }
    } catch (error) {
        res.status(400).json(" deletion failed")
    }
}

export{addtouristplace,gettouristplace,updatetouristplace,deletetouristplace}