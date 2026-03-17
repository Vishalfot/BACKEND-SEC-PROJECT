import mongoose from "mongoose";

const PlaceSchema = new mongoose.Schema({

  _id: {
    type: String,   // Example: "qutub_minar"
    required: true
  },

  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: [
      "HERITAGE",
      "PARK",
      "CULTURAL",
      "ENTERTAINMENT",
      "SHOPPING",
      "FOOD",
      "NATURE",
      "MUSEUM",
      "WILDLIFE",
      "RELIGIOUS",
      "MODERN"
    ],
    required: true
  },
  amenities: {
  food_nearby: { type: Boolean, default: false },
  shopping_nearby: { type: Boolean, default: false },
  parking_available: { type: Boolean, default: false },
  restroom_available: { type: Boolean, default: false },
  wheelchair_accessible: { type: Boolean, default: false }
},


  area: {
    type: String,
    required: true
  },

  address: String,

  // GEO LOCATION
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  scores: {
    cultural_score: { type: Number, default: 0.5 },
    popularity_score: { type: Number, default: 0.5 },
    local_authenticity_score: { type: Number, default: 0.5 }
  },

  visit_info: {
    avg_duration_min: Number,
    best_time_of_day: [String],
    open_days: [String]
  },

  opening_hours: {
    type: Object
  },

  pricing: {
    entry_fee: {
      indian_adult: Number,
      foreigner_adult: Number
    }
  },

  special_features: {
    is_anchor_place: { type: Boolean, default: false },
    has_local_experience: { type: Boolean, default: false },
    anchor_event_details: {
    type: String,
    default: null
    }
  },
  tags: [String],

  description: {
    short: String,
    long: String
  },

  media: {
    images: [
      {
        url: String,
        public_id: String,
        is_primary: Boolean
      }
    ]
  },

  source: [String],
  verified: { type: Boolean, default: true }

}, { timestamps: true });

PlaceSchema.index({ location: "2dsphere" });

export default mongoose.model("Place", PlaceSchema);

