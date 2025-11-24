import { Product } from "../models/Product.js";

import {uploadonCloudinary} from "../utils/cloudnary.js"

const addproduct=(async(req,res)=>{
    try {
        const userId = req.user.userId || req.user._id;
        const {product_name,description,price}=req.body;
        const avatarlocalPath=req.file?.path;
    if(!avatarlocalPath){
       return res.status(400).json("image not fetch");
    }
    const product_image=await uploadonCloudinary(avatarlocalPath);

    if(!product_image){
        return res.status(400).json("product Image file is required");
    }
    const newProduct=new Product({
        product_name,
        description,
        price,
        avatar:product_image.url,
        createdBy: userId
    })
    const savedproduct=await newProduct.save()
    res.status(201).json(savedproduct)
}catch(error){
    console.error(error)
    return res.status(500).json({error:"product listing failed"})
}
})

const updateproduct=(async(req,res)=>{
    const {id}=req.params;
    const{product_name,description,price,avatar}=req.body
    try {
        const uproduct=await Product.findByIdAndUpdate(
            id,
            {product_name,description,price,avatar},
            {new:true}
        )
        if(!uproduct){
            return res.status(400).json("product not found")
        }
        res.status(200).json(uproduct)
    } catch (error) {
        res.status(400).json("product updation failed")
    }
})

const deleteproduct=async(req,res)=>{
    const {id}=req.params;
    try {
        const dproduct=await Product.findByIdAndDelete(id);
        if(!dproduct){
            return res.status(400).json("product not found")
        }
        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(400).json("product deletion failed")
    }
}
// 1. FOR TOURISTS (Dashboard) - Shows Everything
const getAllProducts = async (req, res) => {
    try {
        // .find() without arguments returns EVERYTHING
        // .populate('createdBy', 'username') is optional if you want to show who posted it
        const events = await Product.find().populate('createdBy', 'username'); 
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json("Error fetching events");
    }
};

// 2. FOR LOCALS (My Dashboard) - Shows Only Theirs
const getMyProducts = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        
        // FILTER: Only find events where createdBy == userId
        const myEvents = await Product.find({ createdBy: userId }); 
        
        res.status(200).json(myEvents);
    } catch (error) {
        res.status(500).json("Error fetching your events");
    }
};


export{addproduct,getAllProducts, getMyProducts,updateproduct,deleteproduct}