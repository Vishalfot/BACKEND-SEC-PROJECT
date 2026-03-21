import mongoose from "mongoose";

const UserSchema=new mongoose.Schema({
    username:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:["Tourist","Local","Shopper"],
        default:"Tourist"
    }
})

const Usermodel=mongoose.model("User",UserSchema)
export default Usermodel;