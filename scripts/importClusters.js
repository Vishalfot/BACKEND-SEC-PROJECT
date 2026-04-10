/**
 * scripts/importClusters.js
 *
 * Run AFTER importPlaces.js — in this order every time you update the Excel:
 *   1. node scripts/importPlaces.js
 *   2. node scripts/importClusters.js
 *
 * What it does:
 *   - Reads "Clusters" sheet  → upserts Cluster documents
 *   - Reads "AnchorEvents"    → upserts AnchorEvent documents
 *   - Computes BaseClusterRank using all formula components
 *   - Computes accessibility_score per cluster from place metro distances
 *   - Backfills cluster.id on every Place document
 */

import mongoose    from 'mongoose';
import xlsx        from 'xlsx';
import path        from 'path';
import { fileURLToPath } from 'url';
import dotenv      from 'dotenv';
dotenv.config();

import Place       from '../models/PlaceSchema.js';
import Cluster     from '../models/Cluster.js';
import AnchorEvent from '../models/AnchorEvent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const EXCEL_PATH = path.join(__dirname, '../delhi_v5.xlsx');

const splitComma = (v) =>
  v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [];
const parseBool = (v) =>
  v === true || v === 1 || ['yes','true'].includes(String(v).toLowerCase());
const safe = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};

// ─── Accessibility score: 1.0 = right at metro, 0 = >2km away ────────────────
// Uses avg metro_distance_m of all places in the cluster.
// We normalise: score = max(0, 1 - avgDistM / 2000)
function accessibilityScore(placeIds, placeMap) {
  const dists = placeIds
    .map(id => placeMap[id]?.metro?.distance_m ?? 1500)
    .filter(d => d < 50000);   // ignore outliers like Damdama Lake
  if (!dists.length) return 0.3;
  const avg = dists.reduce((s, d) => s + d, 0) / dists.length;
  return parseFloat(Math.max(0, 1 - avg / 2000).toFixed(3));
}

// ─── BaseClusterRank formula ──────────────────────────────────────────────────
// Matches the formula you specified:
//   cultural * 0.20  + popularity * 0.15 + anchor * 0.15
// + accessibility * 0.10 + crowd_comfort * 0.10
// (Interest Match × 0.30 is added live per user in mode2.service.js)
//
// NOTE: weights here sum to 0.70. The remaining 0.30 is reserved for
// InterestMatch which is added at request time. The base_rank_score
// stored here is therefore on a 0–0.70 scale, which is correct because
// FinalRank = base_rank_score * (0.60/0.70) + InterestMatch * 0.40
// We simplify by normalising base_rank_score to 0–1 range:
//   base_rank_score = (components) / 0.70  → stored as 0–1
// Then FinalRank = base_rank_score * 0.60 + interestMatch * 0.40
function computeBaseRank(cultural, popularity, anchorBonus, accessibility, crowdComfort) {
  const raw = cultural * 0.20
            + popularity * 0.15
            + anchorBonus * 0.15
            + accessibility * 0.10
            + crowdComfort * 0.10;
  // normalise to 0-1 (max possible raw = 0.70)
  return parseFloat((raw / 0.70).toFixed(4));
}

// ─────────────────────────────────────────────────────────────────────────────
async function importClusters(wb, placeMap) {
  const rows  = xlsx.utils.sheet_to_json(wb.Sheets['Clusters'] || {});
  const valid = rows.filter(r =>
    r['Cluster ID'] && !String(r['Cluster ID']).includes('Slot:')
  );

  const docs = valid.map(r => {
    const placeIds = splitComma(r['Place IDs (comma-separated)']);
    const anchorRaw = r['Main Anchor Place ID'];
    const anchorId  = anchorRaw && String(anchorRaw) !== 'NaN'
      ? String(anchorRaw).trim() : null;

    const cultural    = safe(r['Avg Cultural\nScore'],   0);
    const popularity  = safe(r['Avg Popularity\nScore'], 0);
    const anchorBonus = anchorId ? 1.0 : 0.0;
    const accessibility = accessibilityScore(placeIds, placeMap);
    // crowd_comfort = inverse of avg popularity (less popular = more comfortable)
    const crowdComfort = parseFloat((1 - popularity).toFixed(3));
    const baseRank = computeBaseRank(cultural, popularity, anchorBonus, accessibility, crowdComfort);

    return {
      _id:                  String(r['Cluster ID']).trim(),
      name:                 String(r['Cluster Name'] || '').trim(),
      area:                 deriveArea(String(r['Cluster ID'])),
      center: {
        lat: safe(r['Center Lat']),
        lng: safe(r['Center Lng']),
      },
      place_ids:            placeIds,
      anchor_place_ids:     anchorId ? [anchorId] : [],
      main_anchor_place_id: anchorId,
      total_visit_time_min: safe(r['Total Visit\nTime (min)'], 0),
      best_time_slot:       String(r['Best Time\nSlot'] || 'MORNING').trim().toUpperCase(),
      food_available:       parseBool(r['Food\nAvail.']),
      shopping_available:   parseBool(r['Shopping\nAvail.']),
      walkable_score:       safe(r['Walkable\nScore (1–10)'], 5),
      avg_cultural_score:   cultural,
      avg_popularity_score: popularity,
      anchor_score:         anchorBonus,
      accessibility_score:  accessibility,
      base_rank_score:      baseRank,
    };
  });

  await Cluster.deleteMany({});
  await Cluster.insertMany(docs);
  console.log(`✅ Imported ${docs.length} clusters`);
  return docs;
}

// ─────────────────────────────────────────────────────────────────────────────
async function importAnchorEvents(wb) {
  const rows  = xlsx.utils.sheet_to_json(wb.Sheets['AnchorEvents'] || {});
  const valid = rows.filter(r =>
    r['Event ID'] && !String(r['Event ID']).includes('Priority')
  );

  const docs = valid.map(r => ({
    _id:             String(r['Event ID']).trim(),
    place_id:        String(r['Place ID\n(FK → Places)'] || '').trim(),
    name:            String(r['Event Name'] || '').trim(),
    available_days:  splitComma(r['Available Days']),
    show_times:      splitComma(r['Show Times']),
    duration_min:    safe(r['Duration\n(min)'], 60),
    slot:            String(r['Day Slot'] || 'EVENING').split(',')[0].trim().toUpperCase(),
    season:          String(r['Season / When'] || '').trim(),
    priority_weight: safe(r['Priority\nWeight (1–10)'], 5),
    notes:           String(r['Notes / Tips'] || '').trim(),
  }));

  await AnchorEvent.deleteMany({});
  await AnchorEvent.insertMany(docs);
  console.log(`✅ Imported ${docs.length} anchor events`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function backfillClusterIds(clusters) {
  const ops = [];
  for (const c of clusters) {
    for (const pid of c.place_ids) {
      ops.push({
        updateOne: {
          filter: { _id: pid },
          update: { $set: { 'cluster.id': c._id } },
        },
      });
    }
  }
  if (ops.length) {
    await Place.bulkWrite(ops, { ordered: false });
    console.log(`✅ Backfilled cluster.id on ${ops.length} place documents`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function deriveArea(id) {
  if (id.startsWith('old_delhi'))     return 'Old Delhi';
  if (id.startsWith('central_delhi')) return 'Central Delhi';
  if (id.startsWith('south_delhi'))   return 'South Delhi';
  if (id.startsWith('north_delhi'))   return 'North Delhi';
  if (id.startsWith('east_delhi'))    return 'East Delhi';
  if (id.startsWith('west_delhi'))    return 'West Delhi';
  if (id.startsWith('gurgaon'))       return 'Gurgaon';
  if (id.startsWith('noida'))         return 'Noida';
  return 'Delhi';
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.URI);
  console.log('Connected to MongoDB\n');

  const wb = xlsx.readFile(EXCEL_PATH);

  // Pre-load places so accessibilityScore can read metro distances
  const allPlaces = await Place.find({}, '_id metro').lean();
  const placeMap  = Object.fromEntries(allPlaces.map(p => [String(p._id), p]));

  const clusters = await importClusters(wb, placeMap);
  await importAnchorEvents(wb);
  await backfillClusterIds(clusters);

  await mongoose.disconnect();
  console.log('\n🎉 Done. Run the server and test Mode 2.');
}

main().catch(err => {
  console.error('importClusters FAILED:', err);
  process.exit(1);
});
