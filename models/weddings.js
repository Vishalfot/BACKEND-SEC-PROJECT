import mongoose from "mongoose";
const WeddingSchema=new mongoose.Schema({
    wedding_venue:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    location:{
        type:String,
    },
    time:{
        type:String
    },
    avatar:{
        type:String,
        required:true
    },
    long:{
        type:Number,
        required:true
    },
    latitude:{
        type:Number,
        required:true
    },
    date:{
        type:String,
        required:true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
})
const Weddingplace=mongoose.model("Weddingplace",WeddingSchema);
export {Weddingplace}