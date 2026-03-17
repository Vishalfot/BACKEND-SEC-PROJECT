// import mongoose from "mongoose";
// const WeddingSchema=new mongoose.Schema({
//     wedding_venue:{
//         type:String,
//         required:true,
//     },
//     description:{
//         type:String,
//         required:true
//     },
//     location:{
//         type:String,
//     },
//     time:{
//         type:String
//     },
//     avatar:{
//         type:String,
//         required:true
//     },
//     long:{
//         type:Number,
//         required:true
//     },
//     latitude:{
//         type:Number,
//         required:true
//     },
//     date:{
//         type:String,
//         required:true
//     },
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//         required: true
//     }
// })
// const Weddingplace=mongoose.model("Weddingplace",WeddingSchema);
// export {Weddingplace}

// import mongoose from "mongoose";

// const WeddingSchema = new mongoose.Schema({

//   title: {
//     type: String,
//     required: true
//   },

//   description: String,

//   place_ref: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Place",
//     required: true
//   },
//   time:{
//     type:String,
//     required:true
//   },
//   date:{
//     type:String,required:true
//   },
//   location: {
//     type: {
//       type: String,
//       enum: ["Point"],
//       default: "Point"
//     },
//     coordinates: {
//       type: [Number],
//       required: true
//     }
//   },

//   host_user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },

//   base_price: Number,

//   capacity: Number,

//   packages: [
//     {
//       title: String,
//       price: Number, 
//       description: String,
//       images: [String]
//     }
//   ],

//   amenities: [String],

//   images: [
//     {
//       url: String,
//       public_id: String
//     }
//   ],

//   availability_calendar: [
//     {
//       date: Date,
//       is_booked: Boolean
//     }
//   ],

//   verified: {
//     type: Boolean,
//     default: false
//   }

// }, { timestamps: true });

// WeddingSchema.index({ location: "2dsphere" });

// export default mongoose.model("Weddingplace", WeddingSchema);

// models/weddings.js - REPLACE YOUR CURRENT FILE WITH THIS
import mongoose from "mongoose";

const WeddingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  
  description: String,
  
  place_ref: {
    type: String,  // Matches Place._id (which is String)
    ref: "Place",
    required: true
  },
  
  // ✅ REQUIRED FIELDS (were in your original but may be missing validation)
  time: {
    type: String,
    required: true
  },
  
  date: {
    type: Date,
    required: true
  },
  
  // ✅ NEW FIELDS FOR DISTANCE CALCULATION
  latitude: {
    type: Number,
    required: true
  },
  
  longitude: {
    type: Number,
    required: true
  },
  
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],  // [longitude, latitude]
      required: true
    }
  },
  
  host_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  base_price: Number,
  capacity: Number,
  
  packages: [
    {
      title: String,
      price: Number,
      description: String,
      images: [String]
    }
  ],
  
  amenities: [String],
  
  images: [
    {
      url: String,
      public_id: String
    }
  ],
  
  availability_calendar: [
    {
      date: Date,
      is_booked: Boolean
    }
  ],
  
  verified: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

WeddingSchema.index({ location: "2dsphere" });

export default mongoose.model("Weddingplace", WeddingSchema);
