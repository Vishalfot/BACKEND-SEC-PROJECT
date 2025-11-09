import mongoose from "mongoose";
const TouristplaceSchema=new mongoose.Schema({
    tourist_place_name:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    opening_time:{
        type:String,
    },
    closing_time:{
        type:String
    },
    location:{
        type:String,
        required:true
    },
    avatar:{
        type:String,
        required:true
    }
})
const Touristplace=mongoose.model("Touristplace",TouristplaceSchema);
export {Touristplace}