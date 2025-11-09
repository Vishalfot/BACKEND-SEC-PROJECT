import mongoose from "mongoose";
const ProductSchema=new mongoose.Schema({
    product_name:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    avatar:{
        type:String,
        required:true
    }
})
const Product=mongoose.model("Product",ProductSchema);
export {Product}