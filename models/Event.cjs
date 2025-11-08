const mongoose=require("mongoose")
const EventSchema=new mongoose.Schema({
    event_name:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    date:{
        type:Date,
        required:true
    },
    time:{
        type:String,
        required:true
    },
    location:{
        type:String,
        required:true
    },
    avatar:{
        type:String,
        required:true
    },
    category:{
        type:String,
        enum:["Art","Dance","Festival","Food","Craft","Ritual"],
        default:"Art"
    }
})
const Event=mongoose.model("Event",EventSchema);
export {Event}