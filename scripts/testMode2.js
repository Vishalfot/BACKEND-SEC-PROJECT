/**
 * scripts/testMode2.js
 *
 * Unit tests for mode2.service.js pure functions.
 * No DB, no OSRM, no LLM — uses fixture data only.
 *
 * Run with:
 *   node scripts/testMode2.js
 */

import {
    diversityFilter,
    buildAreaTravelContext,
    buildLLMPrompt,
    validateAndRepair,
    intensityBalanceCheck,
    computeCentroid,
    generateFallbackRationale,
    injectFoodShopping,
    buildCacheKey
} from '../services/mode2.service.js';

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, condition, extras = '') {
    if (condition) { console.log(`  ✅  ${label}`); passed++; }
    else           { console.error(`  ❌  ${label}${extras ? ' — ' + extras : ''}`); failed++; }
}
function section(title) { console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`); }

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makePlace = (o) => ({
    _id:       o._id  || Math.random().toString(36).slice(2),
    name:      o.name || 'Test Place',
    area:      o.area || 'South Delhi',
    category:  o.cat  || 'heritage',
    location:  { coordinates: o.coords || [77.21, 28.53] },
    scores:    { cultural_score: o.cultural || 0.7, popularity_score: o.pop || 0.7 },
    visit_info: {
        avg_duration_min: o.dur || 60,
        best_time_of_day: o.times || [],
        open_days:        o.open  || []
    },
    tags:      o.tags || [],
    amenities: { food_nearby: o.food || false, shopping_nearby: o.shop || false },
    special_features: { is_anchor_place: o.anchor || false }
});

// ─── diversityFilter ──────────────────────────────────────────────────────────
section('diversityFilter');

// 25 places from same area → max 40% of 20 = 8 from that area
const manyFromSameArea = [
    ...Array.from({ length: 25 }, (_, i) => makePlace({ _id: `sd${i}`, area: 'South Delhi', cat: 'heritage' })),
    ...Array.from({ length: 5 },  (_, i) => makePlace({ _id: `nd${i}`, area: 'New Delhi',   cat: 'museum'   }))
];
const filtered1 = diversityFilter(manyFromSameArea, 20);
const sdCount   = filtered1.filter(p => p.area === 'South Delhi').length;
assert('Max 40% from South Delhi → ≤ 8 places', sdCount <= 8, `got ${sdCount}`);
assert('Total ≤ 20', filtered1.length <= 20, `got ${filtered1.length}`);

// 20 heritage, 10 museum → max 50% of 20 = 10 heritage
const manyHeritage = [
    ...Array.from({ length: 10 }, (_, i) => makePlace({ _id: `h${i}`, cat: 'heritage', area: `Area${i}`  })),
    ...Array.from({ length: 10 }, (_, i) => makePlace({ _id: `m${i}`, cat: 'museum',   area: `Area${i+10}` }))
];
const filtered2 = diversityFilter(manyHeritage, 20);
const heritageCount = filtered2.filter(p => p.category === 'heritage').length;
assert('Max 50% heritage → ≤ 10 heritage places', heritageCount <= 10, `got ${heritageCount}`);

// Small pool — nothing dropped
const small = Array.from({ length: 5 }, (_, i) => makePlace({ _id: `s${i}`, area: `A${i}` }));
const filteredSmall = diversityFilter(small, 20);
assert('Small pool passes through unchanged', filteredSmall.length === 5, `got ${filteredSmall.length}`);

// emptiness
assert('Empty pool returns empty', diversityFilter([], 20).length === 0);

// ─── buildAreaTravelContext ───────────────────────────────────────────────────
section('buildAreaTravelContext');

const areas3  = ['Old Delhi', 'South Delhi', 'New Delhi'];
const matrix3 = [
    [0,    2700, 900 ],
    [2700, 0,    1800],
    [900,  1800, 0   ]
];
const ctx = buildAreaTravelContext(areas3, matrix3);
assert('Context includes area pair', ctx.includes('Old Delhi') && ctx.includes('South Delhi'), ctx.slice(0,80));
assert('Context includes minutes', ctx.includes('min'), ctx.slice(0,80));
assert('Empty areas → empty string', buildAreaTravelContext([], null) === '');
assert('Single area → empty string', buildAreaTravelContext(['Only'], [[0]]) === '');

// ─── buildLLMPrompt ───────────────────────────────────────────────────────────
section('buildLLMPrompt');

const samplePlaces = [makePlace({ _id: 'p1', name: 'Qutub Minar', area: 'South Delhi', cultural: 0.9 })];
const prompt1 = buildLLMPrompt(samplePlaces, 2, '', null);
assert('Prompt contains numDays', prompt1.includes('2-day'), prompt1.slice(0,100));
assert('Prompt contains place id', prompt1.includes('p1'));
assert('Prompt requests rationales', prompt1.includes('rationale'));
assert('Prompt contains JSON schema', prompt1.includes('"days"') && prompt1.includes('"rationales"'));

const promptWithAccom = buildLLMPrompt(samplePlaces, 2, '', 'South Delhi');
assert('Prompt with accommodation mentions it', promptWithAccom.includes('South Delhi'));

// ─── intensityBalanceCheck ────────────────────────────────────────────────────
section('intensityBalanceCheck');

const threeHigh = [
    makePlace({ _id: 'h1', cultural: 0.90 }),
    makePlace({ _id: 'h2', cultural: 0.88 }),
    makePlace({ _id: 'h3', cultural: 0.86 })
];
const twoHigh = [
    makePlace({ _id: 'h4', cultural: 0.90 }),
    makePlace({ _id: 'h5', cultural: 0.87 }),
    makePlace({ _id: 'l1', cultural: 0.60 })
];
const zeroHigh = [
    makePlace({ _id: 'l2', cultural: 0.50 }),
    makePlace({ _id: 'l3', cultural: 0.60 })
];

const { ok: ok3, overflow: ov3 } = intensityBalanceCheck(threeHigh);
assert('3 high-intensity → not ok', !ok3);
assert('3 high-intensity → 1 in overflow', ov3.length === 1, `got ${ov3.length}`);

const { ok: ok2 } = intensityBalanceCheck(twoHigh);
assert('2 high-intensity → ok', ok2);

const { ok: ok0 } = intensityBalanceCheck(zeroHigh);
assert('0 high-intensity → ok', ok0);

// ─── validateAndRepair ────────────────────────────────────────────────────────
section('validateAndRepair');

// Place closed on Monday should be removed from Day 1 when startDate is a Monday
const mondayClosed = makePlace({ _id: 'mc', open: ['tue','wed','thu','fri','sat','sun'] });
const alwaysOpen   = makePlace({ _id: 'ao', open: ['all_days'] });
const rawDays1 = [[String(mondayClosed._id), String(alwaysOpen._id)]];

// 2026-03-23 is a Monday
const { days: repaired1, repairedDayIndices: rdi1 } = validateAndRepair(
    rawDays1, [mondayClosed, alwaysOpen], '2026-03-23', 1
);
const repaired1Ids = repaired1[0]?.map(p => String(p._id)) || [];
assert('Monday-closed place removed from Day 1', !repaired1Ids.includes(String(mondayClosed._id)));
assert('Always-open place stays in Day 1', repaired1Ids.includes(String(alwaysOpen._id)));
assert('Day 1 marked as repaired', rdi1.has(0));

// Budget overflow — 4 places × 120min + 3 × 30min buffers = 570 min > 420
const bigPlaces = Array.from({ length: 4 }, (_, i) =>
    makePlace({ _id: `big${i}`, dur: 120, cultural: 0.5 + i * 0.1 })
);
const rawBig = [bigPlaces.map(p => String(p._id))];
const { days: repaired2, repairedDayIndices: rdi2 } = validateAndRepair(rawBig, bigPlaces, null, 1);
assert('Budget overflow → day trimmed to fit 420 min', repaired2[0].length < 4, `got ${repaired2[0].length} places`);
assert('Budget overflow day marked as repaired', rdi2.has(0));

// ─── computeCentroid ─────────────────────────────────────────────────────────
section('computeCentroid');

const centPlaces = [
    makePlace({ coords: [77.10, 28.50] }),
    makePlace({ coords: [77.30, 28.70] })
];
const [cLng, cLat] = computeCentroid(centPlaces);
assert('Centroid lng = average', Math.abs(cLng - 77.20) < 0.001, `got ${cLng}`);
assert('Centroid lat = average', Math.abs(cLat - 28.60) < 0.001, `got ${cLat}`);
assert('Empty places → Delhi default', computeCentroid([])[0] === 77.2090);

// ─── generateFallbackRationale ────────────────────────────────────────────────
section('generateFallbackRationale');

const fallbackPlaces = [
    makePlace({ _id: 'f1', name: 'Jama Masjid', area: 'Old Delhi', cultural: 0.95 }),
    makePlace({ _id: 'f2', name: 'Red Fort',    area: 'Old Delhi', cultural: 0.90 }),
    makePlace({ _id: 'f3', name: 'Chandni Chowk', area: 'Old Delhi', cultural: 0.75 })
];
const rationale = generateFallbackRationale(fallbackPlaces);
assert('Rationale contains dominant area',   rationale.includes('Old Delhi'), rationale);
assert('Rationale contains highest place',   rationale.includes('Jama Masjid'), rationale);
assert('Rationale ends with period',         rationale.endsWith('.'), rationale);
assert('Empty places → generic string',      generateFallbackRationale([]).length > 0);

// ─── injectFoodShopping ───────────────────────────────────────────────────────
section('injectFoodShopping');

// Build a 3-stop day starting at 9am, each 120min
// Stop 0: 09:00 arrival, ends 11:00 — no crossing 1pm
// Stop 1: let's say arrival 11:00 ends 13:00 — crosses 1pm → lunch card if food_nearby
// Stop 2: arrival 15:00–17:00 → shopping card if shopping_nearby
const timedPlaces3 = [
    { name: 'Stop A', arrival_time: '09:00', visit_duration_min: 120, amenities: { food_nearby: false, shopping_nearby: false } },
    { name: 'Stop B', arrival_time: '11:00', visit_duration_min: 120, amenities: { food_nearby: true,  shopping_nearby: false } },
    { name: 'Stop C', arrival_time: '16:00', visit_duration_min: 60,  amenities: { food_nearby: false, shopping_nearby: true  } }
];

const injected = injectFoodShopping(timedPlaces3, true, true);
const lunchCards    = injected.filter(p => p._cardType === 'lunch');
const shoppingCards = injected.filter(p => p._cardType === 'shopping');

assert('Lunch card injected after Stop B', lunchCards.length === 1, `got ${lunchCards.length}`);
assert('Shopping card injected after Stop C', shoppingCards.length === 1, `got ${shoppingCards.length}`);
assert('Total items = 3 stops + 2 cards = 5', injected.length === 5, `got ${injected.length}`);

// Without food enabled
const noFood = injectFoodShopping(timedPlaces3, false, true);
assert('No lunch card when includeFood=false', noFood.filter(p=>p._cardType==='lunch').length === 0);

// ─── buildCacheKey ────────────────────────────────────────────────────────────
section('buildCacheKey');

const key1 = buildCacheKey({ interests: ['heritage', 'museum'], startDate: '2026-03-23', numDays: 3, accommodationArea: 'South Delhi', excludedIds: ['id1', 'id2'] });
const key2 = buildCacheKey({ interests: ['museum', 'heritage'], startDate: '2026-03-23', numDays: 3, accommodationArea: 'South Delhi', excludedIds: ['id2', 'id1'] });
const key3 = buildCacheKey({ interests: ['heritage'], startDate: '2026-03-23', numDays: 3, accommodationArea: null, excludedIds: [] });

assert('Same params different order → same key', key1 === key2, `k1: ${key1.slice(0,40)} k2: ${key2.slice(0,40)}`);
assert('Different accommodationArea → different key', key1 !== key3);
assert('Key is a string', typeof key1 === 'string');

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Mode 2 Unit Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
