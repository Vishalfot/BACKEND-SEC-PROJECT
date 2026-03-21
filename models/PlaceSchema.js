import mongoose from "mongoose";

const PlaceSchema = new mongoose.Schema({

  _id: { type: String },          // e.g. "qutub_minar"

  name:     { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: [
      'HERITAGE', 'RELIGIOUS', 'SHOPPING', 'MUSEUM', 'PARK',
      'CULTURAL', 'ENTERTAINMENT', 'FOOD', 'EXHIBITION', 'SPORTS',
      'NATURE', 'EDUCATIONAL', 'WILDLIFE', 'NIGHTLIFE', 'WELLNESS',
      'ACTIVITY', 'VIEWPOINT', 'MODERN',
    ],
  },
  area: {
    type: String,
    required: true,
    enum: [
      'Old Delhi', 'Central Delhi', 'South Delhi', 'North Delhi',
      'East Delhi', 'West Delhi', 'Gurgaon', 'Noida', 'Faridabad', 'Multiple',
    ],
  },

  // GeoJSON point — enables $geoNear / $nearSphere queries
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },

  // Flat lat/lng kept for convenience in application-layer math
  latitude:  { type: Number, required: true },
  longitude: { type: Number, required: true },

  scores: {
    cultural:   { type: Number, min: 0, max: 1, default: 0.5 },
    popularity: { type: Number, min: 0, max: 1, default: 0.5 },
  },

  avg_visit_duration_min: { type: Number, default: 60 },
  best_time_of_day:       { type: [String], enum: ['morning', 'afternoon', 'evening', 'all_day', 'event_based'] },
  open_days:              { type: [String], enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  tags:                   { type: [String] },

  entry_fee: {
    indian:    { type: Number, default: 0 },
    foreigner: { type: Number, default: 0 },
  },

  amenities: {
    food_nearby:     { type: Boolean, default: false },
    shopping_nearby: { type: Boolean, default: false },
    parking:         { type: Boolean, default: false },
  },

  short_description:    { type: String, default: '' },
  image_filename:       { type: String, default: '' },
  is_anchor_place:      { type: Boolean, default: false },
  anchor_event_details: { type: String, default: '' },
  source:               { type: String, default: '' },
  official_website:     { type: String, default: '' },

  metro: {
    nearest_station: { type: String, default: '' },
    line:            { type: String, default: '' },
    distance_m:      { type: Number, default: 0 },
  },

  cluster: {
    id:          { type: String, default: null },
    anchor_id:   { type: String, default: null },
    visit_order: { type: Number, default: null },
  },

  // Sub-place support (e.g. Jama Masjid Courtyard → Jama Masjid)
  is_sub_place:    { type: Boolean, default: false },
  parent_place_id: { type: String,  default: null },

  verified: { type: Boolean, default: true }

}, { _id: false, timestamps: true });

// ── Indexes ────────────────────────────────────────────────────────────────
// 2dsphere index — required for $geoNear (Mode 1)
PlaceSchema.index({ location: '2dsphere' });

// Compound index for Mode 2 category + cost filtering
PlaceSchema.index({ category: 1, 'entry_fee.indian': 1, open_days: 1 });

// Cluster grouping queries
PlaceSchema.index({ 'cluster.id': 1, 'cluster.visit_order': 1 });

// Anchor pin queries
PlaceSchema.index({ is_anchor_place: 1, 'scores.popularity': -1 });

// Tag search
PlaceSchema.index({ tags: 1 });

// Area + category for city-wide filtering
PlaceSchema.index({ area: 1, category: 1 });

export default mongoose.model("Place", PlaceSchema, "places");
