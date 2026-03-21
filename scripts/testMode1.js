/**
 * scripts/testMode1.js
 *
 * Unit tests for mode1.service.js pure functions.
 * No DB, no OSRM — uses fixture data only.
 *
 * Run with:
 *   node scripts/testMode1.js
 */

import {
    detectZone,
    getTimeSlot,
    isOpenToday,
    scorePlace,
    haversineKm,
    greedyBuild,
    twoOptTrip,
    buildTimeline
} from '../services/mode1.service.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, condition, extras = '') {
    if (condition) { console.log(`  ✅  ${label}`); passed++; }
    else           { console.error(`  ❌  ${label}${extras ? ' — ' + extras : ''}`); failed++; }
}
function section(title) { console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`); }

// ─── Load GeoJSON ─────────────────────────────────────────────────────────────
const geojson = JSON.parse(readFileSync(join(__dirname, '../data/delhi_area_boundaries.geojson'), 'utf8'));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makePlace = (o) => ({
    _id:  o._id || 'test',
    name: o.name || 'Test Place',
    area: o.area || 'South Delhi',
    location: { coordinates: o.coords || [77.2090, 28.5291] },
    scores: { cultural_score: o.cultural || 0.7, popularity_score: o.pop || 0.7 },
    visit_info: {
        avg_duration_min: o.dur || 60,
        best_time_of_day: o.times  || [],
        open_days:        o.open   || []
    },
    tags: o.tags || [],
    amenities: { food_nearby: o.food || false, shopping_nearby: o.shop || false },
    special_features: { is_anchor_place: o.anchor || false, anchor_event_details: o.anchorDetail || null }
});

// ─── detectZone ───────────────────────────────────────────────────────────────
section('detectZone');

// Qutub Minar area: ~77.185, 28.524 → South Delhi polygon covers 77.16–77.32, 28.48–28.6050
const qutubCoords = [77.185, 28.524];
const zone = detectZone(qutubCoords[0], qutubCoords[1], geojson);
assert('Qutub Minar area → South Delhi', zone === 'South Delhi', `got: ${zone}`);

// Red Fort ~77.241, 28.656 → Old Delhi polygon
const redFortCoords = [77.241, 28.656];
const zone2 = detectZone(redFortCoords[0], redFortCoords[1], geojson);
assert('Red Fort area → Old Delhi', zone2 === 'Old Delhi', `got: ${zone2}`);

// Middle of nowhere outside Delhi
const zone3 = detectZone(76.0, 27.0, geojson);
assert('Outside all polygons → null', zone3 === null, `got: ${zone3}`);

// Connaught Place ~77.219, 28.632 → New Delhi or Central Delhi
const cpZone = detectZone(77.219, 28.632, geojson);
assert('Connaught Place area → New Delhi or Central Delhi',
    cpZone === 'New Delhi' || cpZone === 'Central Delhi', `got: ${cpZone}`);

// ─── getTimeSlot ──────────────────────────────────────────────────────────────
section('getTimeSlot');
assert('Hour 7  → morning',   getTimeSlot(7)  === 'morning');
assert('Hour 11 → morning',   getTimeSlot(11) === 'morning');
assert('Hour 12 → afternoon', getTimeSlot(12) === 'afternoon');
assert('Hour 16 → afternoon', getTimeSlot(16) === 'afternoon');
assert('Hour 17 → evening',   getTimeSlot(17) === 'evening');
assert('Hour 21 → evening',   getTimeSlot(21) === 'evening');

// ─── isOpenToday ─────────────────────────────────────────────────────────────
section('isOpenToday');

const mondayClosed = makePlace({ open: ['tue','wed','thu','fri','sat','sun'] });
const alwaysOpen   = makePlace({ open: ['all_days'] });
const weekdaysOnly = makePlace({ open: ['weekdays'] });
const noRestrict   = makePlace({ open: [] });
const monPlace     = makePlace({ open: ['mon', 'tue'] });

assert('Closed Monday → false on mon',   !isOpenToday(mondayClosed, 'mon'));
assert('Closed Monday → true on tue',     isOpenToday(mondayClosed, 'tue'));
assert('all_days → always true',          isOpenToday(alwaysOpen, 'mon'));
assert('weekdays → true on mon',          isOpenToday(weekdaysOnly, 'mon'));
assert('weekdays → false on sat',        !isOpenToday(weekdaysOnly, 'sat'));
assert('No open_days → always true',      isOpenToday(noRestrict, 'mon'));
assert('mon place → true on mon',         isOpenToday(monPlace, 'mon'));
assert('mon place → false on wed',       !isOpenToday(monPlace, 'wed'));

// ─── scorePlace ───────────────────────────────────────────────────────────────
section('scorePlace');

const origin = [77.2090, 28.5500];
const nearPlace  = makePlace({ coords: [77.211, 28.551], cultural: 0.8, pop: 0.8 });
const farPlace   = makePlace({ coords: [77.300, 28.620], cultural: 0.8, pop: 0.8 });
const morningPlace = makePlace({ coords: [77.211, 28.551], cultural: 0.9, times: ['morning'] });

const scoreNear    = scorePlace(nearPlace, [], 200, 'morning', origin);
const scoreFar     = scorePlace(farPlace, [], 12000, 'morning', origin);
const scoreMornAM  = scorePlace(morningPlace, [], 200, 'morning', origin);
const scoreMornPM  = scorePlace(morningPlace, [], 200, 'afternoon', origin);

assert('Near place scores higher than far place', scoreNear > scoreFar, `near:${scoreNear.toFixed(3)} far:${scoreFar.toFixed(3)}`);
assert('Morning place at morning > morning place at afternoon', scoreMornAM > scoreMornPM, `am:${scoreMornAM.toFixed(3)} pm:${scoreMornPM.toFixed(3)}`);

// Tag match boost
const tagPlace = makePlace({ tags: ['heritage', 'photography'], cultural: 0.6 });
const tagMatch = scorePlace(tagPlace, ['heritage', 'food'], 300, 'morning', origin);
const noMatch  = scorePlace(tagPlace, ['food', 'shopping'], 300, 'morning', origin);
assert('Tag match boosts score over no match', tagMatch > noMatch, `match:${tagMatch.toFixed(3)} nomatch:${noMatch.toFixed(3)}`);

// Return penalty
const veryFarPlace = makePlace({ coords: [77.40, 28.70] }); // ~14km
const scorePenalty  = scorePlace(veryFarPlace, [], 15000, 'morning', origin);
const closePlace    = makePlace({ coords: [77.212, 28.552] });
const scoreClose    = scorePlace(closePlace, [], 300, 'morning', origin);
assert('Return penalty reduces far place score', scorePenalty < scoreClose);

// ─── haversineKm ──────────────────────────────────────────────────────────────
section('haversineKm');
// Qutub Minar to Red Fort ~17km in straight line
const dist = haversineKm([77.185, 28.524], [77.241, 28.656]);
assert('Qutub Minar to Red Fort is ~10–18km', dist > 8 && dist < 20, `got ${dist.toFixed(2)}km`);
assert('Same point → 0km', haversineKm([77.0, 28.5], [77.0, 28.5]) < 0.001);

// ─── greedyBuild ──────────────────────────────────────────────────────────────
section('greedyBuild');

const places10 = Array.from({ length: 10 }, (_, i) => ({
    ...makePlace({
        _id: `p${i}`,
        coords: [77.21 + i * 0.005, 28.53 + i * 0.003],
        dur: 60
    }),
    score: Math.random() * 0.8 + 0.2
}));

const trip = greedyBuild(places10, [77.210, 28.530], null, 240);

assert('Greedy returns ≤ 5 places', trip.length <= 5, `got ${trip.length}`);
assert('Greedy returns ≥ 1 place', trip.length >= 1);

// With tight budget (65 min for one 60-min place)
const tightTrip = greedyBuild(places10, [77.210, 28.530], null, 65);
assert('Tight budget stops early', tightTrip.length <= 2, `got ${tightTrip.length}`);

// Anchor place goes first
const withAnchor = [
    { ...makePlace({ _id: 'normal1', dur: 60 }), score: 0.8 },
    { ...makePlace({ _id: 'anchor',  dur: 60, anchor: true }), score: 0.3 },
    { ...makePlace({ _id: 'normal2', dur: 60 }), score: 0.7 }
];
const anchorTrip = greedyBuild(withAnchor, [77.210, 28.530], null, 300);
assert('Anchor place is first in greedy trip',
    anchorTrip[0]?.special_features?.is_anchor_place === true,
    `first: ${anchorTrip[0]?._id}`);

// ─── twoOptTrip ───────────────────────────────────────────────────────────────
section('twoOptTrip');

const tripPlaces4 = [
    makePlace({ _id: 'a', coords: [77.20, 28.55] }),
    makePlace({ _id: 'b', coords: [77.30, 28.65] }),
    makePlace({ _id: 'c', coords: [77.21, 28.56] }),
    makePlace({ _id: 'd', coords: [77.31, 28.66] })
];
// Matrix: indices 0–3
const m = [
    [0,    1000, 100,  1100],
    [1000, 0,    900,  100 ],
    [100,  900,  0,    1000],
    [1100, 100,  1000, 0   ]
];
const optimised4 = twoOptTrip(tripPlaces4, m);
assert('2-opt keeps all 4 places', optimised4.length === 4);
assert('2-opt keeps start fixed', optimised4[0]._id === tripPlaces4[0]._id);

const costBefore = [0,1,2,3].reduce((t,v,i,a) => i>0 ? t+m[a[i-1]][v] : 0, 0);
const optIdx     = optimised4.map(p => tripPlaces4.indexOf(p));
const costAfter  = optIdx.reduce((t,v,i,a) => i>0 ? t+m[a[i-1]][v] : 0, 0);
assert('2-opt cost ≤ original route cost', costAfter <= costBefore, `before:${costBefore} after:${costAfter}`);

// ─── buildTimeline ────────────────────────────────────────────────────────────
section('buildTimeline');

const twoPlace = [
    makePlace({ _id: 'x', dur: 60 }),
    makePlace({ _id: 'y', dur: 90 })
];
const tm = [[0, 1800], [1800, 0]]; // 30 min walking between each
const timeline = buildTimeline(twoPlace, tm, 9);

assert('First place arrival at 09:00', timeline[0].arrival_time === '09:00', timeline[0].arrival_time);
assert('Second place arrival = 09:00 + 60min + 30min = 10:30', timeline[1].arrival_time === '10:30', timeline[1].arrival_time);
assert('walking_time_to_next on first stop = 30', timeline[0].walking_time_to_next === 30, `got ${timeline[0].walking_time_to_next}`);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Mode 1 Unit Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
