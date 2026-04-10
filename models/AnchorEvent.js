/**
 * models/AnchorEvent.js
 * Timed events from delhi_v5.xlsx → "AnchorEvents" sheet.
 * Re-import with: node scripts/importClusters.js
 */
import mongoose from 'mongoose';

const AnchorEventSchema = new mongoose.Schema({
  _id:             { type: String },
  place_id:        { type: String, ref: 'Place', required: true },
  name:            { type: String, required: true },
  available_days:  { type: [String], default: [] },
  show_times:      { type: [String], default: [] },
  duration_min:    { type: Number, default: 60 },
  slot:            { type: String, enum: ['MORNING','AFTERNOON','EVENING','NIGHT'], default: 'EVENING' },
  season:          { type: String, default: '' },
  priority_weight: { type: Number, min: 1, max: 10, default: 5 },
  notes:           { type: String, default: '' },
}, { _id: false, timestamps: true });

export default mongoose.model('AnchorEvent', AnchorEventSchema, 'anchor_events');
