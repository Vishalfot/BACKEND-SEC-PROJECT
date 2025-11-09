import { Product } from "../models/Product.js";

import {uploadonCloudinary} from "../utils/cloudnary.js"

const addproduct=(async(req,res)=>{
    try {
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
        avatar:product_image.url
    })
    const savedproduct=await newProduct.save()
    res.status(201).json(savedproduct)
}catch(error){
    console.error(error)
    return res.status(500).json({error:"product listing failed"})
}
})
const getproduct=(async(req,res)=>{
    try{
        const products=await Product.find();
        res.status(200).json(products)
    }catch(error){
        res.status(400).json("poduct not able to fetch")
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
        res.status(200).json(uevent)
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
    } catch (error) {
        res.status(400).json("product deletion failed")
    }
}

export{addproduct,getproduct,updateproduct,deleteproduct}