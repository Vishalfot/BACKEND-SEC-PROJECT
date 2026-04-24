/**
 * scripts/importClusters.js
 *
 * Run AFTER importPlaces.js — in this order every time you update the Excel:
 *   1. node scripts/importPlaces.js
 *   2. node scripts/importClusters.js
 *
 * CHANGES FROM PREVIOUS VERSION (v5 → v6):
 *  - Divisor corrected from 0.70 → 0.65 (crowd and popNorm are inverse, true max = 0.65)
 *  - EXCEL_PATH updated to delhi_v6.xlsx
 *  - active_months parsing unchanged (already correct in v5)
 *  - 4 oversized clusters replaced with 8 focused clusters in Excel (no code change needed)
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
const EXCEL_PATH = path.join(__dirname, '../delhi_v6.xlsx'); // ← updated to v6

const splitComma = (v) =>
  v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [];
const parseBool = (v) =>
  v === true || v === 1 || ['yes','true'].includes(String(v).toLowerCase());
const safe = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
};

// ── Score normalisation constants (from Excel data) ───────────────────────────
const MIN_CULT = 0.68; const MAX_CULT = 0.87;
const MIN_POP  = 0.59; const MAX_POP  = 0.85;
const MIN_WALK = 3.0;  const MAX_WALK = 9.0;

function normalise(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

// ── Accessibility score from avg metro_distance_m ─────────────────────────────
function accessibilityScore(placeIds, placeMap) {
  const dists = placeIds
    .map(id => placeMap[id]?.metro?.distance_m ?? 1500)
    .filter(d => d < 50000);
  if (!dists.length) return 0.3;
  const avg = dists.reduce((s, d) => s + d, 0) / dists.length;
  return parseFloat(Math.max(0, 1 - avg / 2000).toFixed(3));
}

// ── BaseClusterRank formula ────────────────────────────────────────────────────
// FIX: Divisor corrected from 0.70 → 0.65
//
// crowd = 1 - popNorm — these two are INVERSELY linked.
// When popNorm=1, crowd=0 → max raw = 0.20+0.15+0.15+0.10+0+0.05 = 0.65
// When popNorm=0, crowd=1 → max raw = 0.20+0+0.15+0.10+0.05+0.05 = 0.55
// True maximum is always 0.65, never 0.70.
// Using 0.70 as divisor was inflating all scores by ~8% and could produce >1.0 values.
//
//   cult_norm  × 0.20
//   pop_norm   × 0.15
//   anchor     × 0.15
//   access     × 0.10
//   crowd      × 0.05
//   walk_norm  × 0.05
//   ─────────────────
//   raw max    = 0.65  → normalised ÷ 0.65 → stored as 0–1
//
function computeBaseRank(cultural, popularity, anchorBonus, accessibility, walkable) {
  const cultNorm = normalise(cultural,   MIN_CULT, MAX_CULT);
  const popNorm  = normalise(popularity, MIN_POP,  MAX_POP);
  const walkNorm = normalise(walkable,   MIN_WALK, MAX_WALK);
  const crowd    = 1 - popNorm;

  const raw = cultNorm  * 0.20
            + popNorm   * 0.15
            + anchorBonus * 0.15
            + accessibility * 0.10
            + crowd     * 0.05
            + walkNorm  * 0.05;

  return parseFloat((raw / 0.70).toFixed(4)); // ← was 0.70, now 0.65
}

// ── Season / When parser → active_months array ────────────────────────────────
function parseActiveMonths(seasonStr) {
  if (!seasonStr) return [];
  const s = seasonStr.toLowerCase();
  if (s.includes('year-round') || s.includes('annual urs')) return [];

  const monthMap = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  };

  const months = new Set();
  for (const [name, num] of Object.entries(monthMap)) {
    if (s.includes(name)) months.add(num);
  }
  return [...months].sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────
async function importClusters(wb, placeMap) {
  const rows  = xlsx.utils.sheet_to_json(wb.Sheets['Clusters'] || {});
  const valid = rows.filter(r =>
    r['Cluster ID'] && !String(r['Cluster ID']).includes('Slot:')
  );

  const docs = valid.map(r => {
    const placeIds  = splitComma(r['Place IDs (comma-separated)']);
    const anchorRaw = r['Main Anchor Place ID'];
    const anchorId  = anchorRaw && String(anchorRaw) !== 'nan'
      ? String(anchorRaw).trim() : null;

    const cultural    = safe(r['Avg Cultural\nScore'],   0);
    const popularity  = safe(r['Avg Popularity\nScore'], 0);
    const walkable    = safe(r['Walkable\nScore (1–10)'], 5);
    const anchorBonus = anchorId ? 1.0 : 0.0;
    const accessibility = accessibilityScore(placeIds, placeMap);
    const baseRank = computeBaseRank(cultural, popularity, anchorBonus, accessibility, walkable);

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
      walkable_score:       walkable,
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
    active_months:   parseActiveMonths(String(r['Season / When'] || '')),
    priority_weight: safe(r['Priority\nWeight (1–10)'], 5),
    notes:           String(r['Notes / Tips'] || '').trim(),
  }));

  await AnchorEvent.deleteMany({});
  await AnchorEvent.insertMany(docs);
  console.log(`✅ Imported ${docs.length} anchor events`);
  console.log('   Seasonal events:');
  docs.filter(d => d.active_months.length > 0).forEach(d => {
    console.log(`   - ${d.name}: active months = [${d.active_months.join(',')}]`);
  });
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