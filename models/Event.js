// import mongoose from "mongoose";
// const EventSchema=new mongoose.Schema({
//     event_name:{
//         type:String,
//         required:true,
//     },
//     description:{
//         type:String,
//         required:true
//     },
//     date:{
//         type:String,
//         required:true
//     },
//     time:{
//         type:String,
//         required:true
//     },
//     location:{
//         type:String,
//         required:true
//     },
//     avatar:{
//         type:String,
//         required:true
//     },
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User", 
//         required: true
//     }
// })
// const Event=mongoose.model("Event",EventSchema);
// export {Event}
// import mongoose from "mongoose";

// const EventSchema = new mongoose.Schema({

//   event_name: {
//     type: String,
//     required: true
//   },

//   description: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true
//   },

//   // LINK TO PLACE
//   place_ref: {
//     type: String,
//     ref: "Place",
//     required: true
//   },

//   // GEO LOCATION (Important for Nearby Search)
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

//   event_date: {
//     type: Date,
//     required: true
//   },

//   start_time: {
//     type: String,
//     required: true
//   },

//   end_time: {
//     type: String,
//     required: true
//   },

//   avatar: String,

//   cultural_weight: {
//     type: Number,
//     default: 0.7
//   },
//   experience_type: {
//   type: String,
//   enum: ["festival", "local_experience", "workshop", "heritage_walk"],
//   required: true
// },

//   tags: [String],

//   price: {
//     type: Number,
//     default: 0
//   },

//   capacity: Number,

//   booking_required: {
//     type: Boolean,
//     default: false
//   },

//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },

//   verified: {
//     type: Boolean,
//     default: false
//   }

// }, { timestamps: true });

// EventSchema.index({ location: "2dsphere" });

// export default mongoose.model("Event", EventSchema);

// models/Event.js - REPLACE YOUR CURRENT FILE WITH THIS
import mongoose from "mongoose";

const EventSchema = new mongoose.Schema({
  event_name: {
    type: String,
    required: true
  },
  
  // ❌ YOUR CURRENT: mongoose.Schema.Types.ObjectId
  // ✅ FIXED: String
  description: {
    type: String,  // CHANGED FROM ObjectId
    required: true
  },
  
  address: {
    type: String,
    required: true
  },
  
  // GEO LOCATION
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
  
  event_date: {
    type: Date,
    required: true
  },
  
  start_time: {
    type: String,  // e.g., "18:00"
    required: true
  },
  
  end_time: {
    type: String,  // e.g., "21:00"
    required: true
  },
  
  avatar: String,
  
  cultural_weight: {
    type: Number,
    default: 0.8  // Higher than regular places for scoring
  },
  
  experience_type: {
    type: String,
    enum: ["festival", "local_experience", "workshop", "heritage_walk"],
    required: true
  },

  tags: [String],
  
  price: {
    type: Number,
    default: 0
  },
  
  capacity: Number,
  
  booking_required: {
    type: Boolean,
    default: false
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  verified: { type: Boolean, default: false }, rejected: { type: Boolean, default: false },
  license_url: {
    type: String,
    required: true
  }
}, { timestamps: true });

EventSchema.index({ location: "2dsphere" });
EventSchema.index({ event_date: 1 });

export default mongoose.model("Event", EventSchema);
