/**
 * models/Cluster.js
 * Hand-curated clusters imported from delhi_v5.xlsx → "Clusters" sheet.
 * Never auto-generated. Re-import with: node scripts/importClusters.js
 */
import mongoose from 'mongoose';

const ClusterSchema = new mongoose.Schema({
  _id:  { type: String },   // e.g. "old_delhi_cluster_1"
  name: { type: String, required: true },
  area: { type: String },

  center: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },

  place_ids:            { type: [String], default: [] },
  anchor_place_ids:     { type: [String], default: [] },
  main_anchor_place_id: { type: String,  default: null },

  total_visit_time_min: { type: Number, default: 0 },
  best_time_slot:       { type: String, enum: ['MORNING','AFTERNOON','EVENING'], default: 'MORNING' },

  food_available:     { type: Boolean, default: false },
  shopping_available: { type: Boolean, default: false },
  walkable_score:     { type: Number, min: 1, max: 10, default: 5 },

  // Pre-computed in importClusters.js — used for BaseClusterRank
  avg_cultural_score:   { type: Number, default: 0 },
  avg_popularity_score: { type: Number, default: 0 },
  anchor_score:         { type: Number, default: 0 },   // 1.0 if has anchor, else 0
  accessibility_score:  { type: Number, default: 0 },   // derived from avg metro_distance
  base_rank_score:      { type: Number, default: 0 },   // final pre-computed score

}, { _id: false, timestamps: true });

export default mongoose.model('Cluster', ClusterSchema, 'clusters');
