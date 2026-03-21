/**
 * scripts/testMode3.js
 *
 * Unit tests for mode3.service.js pure functions.
 * No DB, no OSRM needed — uses fixture data only.
 *
 * Run with:
 *   node --experimental-vm-modules scripts/testMode3.js
 *   (or just: node scripts/testMode3.js  — works with Node 18+)
 */

import {
    getTravelDayNames,
    validateOpenDays,
    clusterByArea,
    pickDayStart,
    nearestNeighborPerDay,
    twoOptPerDay,
    assignTimeSlots,
    crossDayTransitionCheck
} from '../services/mode3.service.js';

// ─── Mini test runner ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, extras = '') {
    if (condition) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}${extras ? ` — ${extras}` : ''}`);
        failed++;
    }
}

function section(title) {
    console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePlace = (overrides) => ({
    _id:  overrides._id || 'place_default',
    name: overrides.name || 'Test Place',
    area: overrides.area || 'Central Delhi',
    location: { coordinates: overrides.coords || [77.2090, 28.6139] },
    scores:     { cultural_score: overrides.cultural || 0.7, popularity_score: 0.7 },
    visit_info: {
        avg_duration_min: overrides.dur || 60,
        best_time_of_day: overrides.times || [],
        open_days:        overrides.open_days || []
    },
    special_features: {
        is_anchor_place:      overrides.anchor || false,
        anchor_event_details: overrides.anchor_details || null
    }
});

// ─── getTravelDayNames ────────────────────────────────────────────────────────
section('getTravelDayNames');

const days3 = getTravelDayNames('2026-03-23', 3); // Mon, Tue, Wed
assert('Returns correct length', days3.length === 3, JSON.stringify(days3));
assert('Day 0 is mon', days3[0] === 'mon', days3[0]);
assert('Day 1 is tue', days3[1] === 'tue', days3[1]);
assert('Day 2 is wed', days3[2] === 'wed', days3[2]);

const days1sat = getTravelDayNames('2026-03-21', 1); // Saturday
assert('Single-day saturday → [sat]', days1sat[0] === 'sat', days1sat[0]);

assert('Empty startDate → []', getTravelDayNames(null, 3).length === 0);
assert('numDays 0 → []',       getTravelDayNames('2026-03-23', 0).length === 0);

// ─── validateOpenDays ────────────────────────────────────────────────────────
section('validateOpenDays');

const travelMon = ['mon'];

// Closed Monday
const qutubMinar = makePlace({
    _id: 'qutub_minar', name: 'Qutub Minar',
    open_days: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun']
});
// Always open
const redFort = makePlace({
    _id: 'red_fort', name: 'Red Fort',
    open_days: ['all_days']
});
// Weekdays only, travel is Saturday
const lotus = makePlace({
    _id: 'lotus_temple', name: 'Lotus Temple',
    open_days: ['weekdays']
});
// No open_days info → always open
const chandni = makePlace({
    _id: 'chandni_chowk', name: 'Chandni Chowk',
    open_days: []
});

const { valid: v1, conflicts: c1 } = validateOpenDays(
    [qutubMinar, redFort, chandni], travelMon
);
assert('Qutub Minar (closed Mon) is in conflicts', c1.some(c => c.name === 'Qutub Minar'));
assert('Red Fort (all_days) is valid',             v1.some(p => p.name === 'Red Fort'));
assert('Chandni Chowk (no open_days) is valid',   v1.some(p => p.name === 'Chandni Chowk'));
assert('conflict count is 1',                      c1.length === 1, `got ${c1.length}`);

// Weekdays restriction tested against Saturday trip
const { valid: v2, conflicts: c2 } = validateOpenDays([lotus], ['sat']);
assert('Lotus Temple (weekdays) conflicts on Saturday', c2.length === 1);
assert('Lotus Temple is NOT valid on Saturday',         v2.length === 0);

// Weekdays restriction tested against Monday trip
const { valid: v3 } = validateOpenDays([lotus], ['mon']);
assert('Lotus Temple (weekdays) valid on Monday',       v3.length === 1);

// ─── clusterByArea ────────────────────────────────────────────────────────────
section('clusterByArea');

// 7 Old Delhi + 2 South Delhi
const oldDelhi7 = Array.from({ length: 7 }, (_, i) =>
    makePlace({ _id: `od_${i}`, name: `OD Place ${i}`, area: 'Old Delhi', coords: [77.23 + i * 0.001, 28.65] })
);
const southDelhi2 = Array.from({ length: 2 }, (_, i) =>
    makePlace({ _id: `sd_${i}`, name: `SD Place ${i}`, area: 'South Delhi', coords: [77.21 + i * 0.001, 28.52] })
);

const buckets = clusterByArea([...oldDelhi7, ...southDelhi2]);

assert('Dense area (7 OD) is split into 2 buckets', buckets.filter(b => b.every(p => p.area === 'Old Delhi')).length === 2, `got ${buckets.length} buckets`);
assert('Each bucket has ≤ 5 places', buckets.every(b => b.length <= 5), `sizes: ${buckets.map(b=>b.length).join(',')}`);
assert('South Delhi bucket exists', buckets.some(b => b.some(p => p.area === 'South Delhi')));
assert('Total places across all buckets = 9', buckets.reduce((s, b) => s + b.length, 0) === 9);

// ─── pickDayStart ────────────────────────────────────────────────────────────
section('pickDayStart');

// P1 anchor
const anchor = makePlace({ _id: 'anchor', name: 'Anchor', anchor: true, times: ['evening'] });
const morning1 = makePlace({ _id: 'morn', name: 'Morning Only', times: ['morning'] });
const normal = makePlace({ _id: 'normal', name: 'Normal' });

assert('P1: anchor place is chosen regardless of order', pickDayStart([normal, morning1, anchor], null) === 2);

// P2 morning-only (no anchor)
assert('P2: morning-only place chosen when no anchor', pickDayStart([normal, morning1], null) === 1);

// P3 nearest to startCoords — Humayun's Tomb coords approx [77.25, 28.59]
const near = makePlace({ _id: 'near', name: 'Near Place', coords: [77.25, 28.59] });
const far  = makePlace({ _id: 'far',  name: 'Far Place',  coords: [77.10, 28.70] });
const startCoords = [77.26, 28.58]; // Just east of Humayun
assert('P3: nearest place chosen when no anchor or morning', pickDayStart([far, near], startCoords) === 1);

// ─── nearestNeighborPerDay ────────────────────────────────────────────────────
section('nearestNeighborPerDay');

// 3-place matrix: 0→1 close, 0→2 far, 1→2 close
const matrix3 = [
    [0, 100, 1000],
    [100, 0, 100],
    [1000, 100, 0]
];
const nn3 = nearestNeighborPerDay(3, matrix3, 0);
assert('NN visits all 3 places', nn3.length === 3);
assert('NN starts at index 0', nn3[0] === 0);
assert('NN goes to nearest (1) second', nn3[1] === 1);
assert('NN ends at 2', nn3[2] === 2);

// ─── twoOptPerDay ────────────────────────────────────────────────────────────
section('twoOptPerDay');

// 4-place square — optimal is 0→1→2→3 with cost 300; reversed middle 1↔2 is same cost
// Create a case where 2-opt clearly improves: 0→2→1→3 (cost 1200) vs 0→1→2→3 (cost 300)
const matrix4 = [
    [0, 100, 500, 500],
    [100, 0, 100, 500],
    [500, 100, 0, 100],
    [500, 500, 100, 0]
];
const badRoute   = [0, 2, 1, 3];     // cost = 500+100+500 = 1100
const optimised  = twoOptPerDay(badRoute, matrix4);
const costBad   = badRoute.reduce((t, v, i) => i > 0 ? t + matrix4[badRoute[i-1]][v] : 0, 0);
const costOpt   = optimised.reduce((t, v, i) => i > 0 ? t + matrix4[optimised[i-1]][v] : 0, 0);
assert('2-opt improves or maintains route cost', costOpt <= costBad, `bad=${costBad} opt=${costOpt}`);
assert('2-opt keeps start fixed at index 0', optimised[0] === 0);
assert('2-opt visits all 4 places', new Set(optimised).size === 4);

// ─── assignTimeSlots ────────────────────────────────────────────────────────
section('assignTimeSlots');

const samplePlaces = [
    makePlace({ _id: 'p1', dur: 60 }),
    makePlace({ _id: 'p2', dur: 90 })
];
const sampleMatrix = [[0, 1800], [1800, 0]]; // 30 min travel between each
const sampleRoute  = [0, 1];

const timed = assignTimeSlots(samplePlaces, sampleMatrix, sampleRoute, 9);
assert('First place arrives at 09:00', timed[0].arrival_time === '09:00', timed[0].arrival_time);
// 09:00 + 60min visit + 30min travel = 10:30
assert('Second place arrives at 10:30', timed[1].arrival_time === '10:30', timed[1].arrival_time);
assert('Travel time annotated', timed[1].travel_time_min === 30, `got ${timed[1].travel_time_min}`);

// ─── crossDayTransitionCheck ─────────────────────────────────────────────────
section('crossDayTransitionCheck');

const dayA = {
    day: 1, places: [
        makePlace({ _id: 'a1', area: 'Old Delhi' }),
        makePlace({ _id: 'a2', name: 'Jama Masjid', area: 'Old Delhi' })
    ]
};
const dayB = {
    day: 2, places: [
        makePlace({ _id: 'b1', name: 'Red Fort', area: 'Old Delhi' }),
        makePlace({ _id: 'b2', area: 'Central Delhi' })
    ]
};
const dayC = {
    day: 3, places: [
        makePlace({ _id: 'c1', area: 'South Delhi' })
    ]
};

crossDayTransitionCheck([dayA, dayB, dayC]);

assert('Day 1→2 same area → overnight_suggestion on Day 1', typeof dayA.overnight_suggestion === 'string', dayA.overnight_suggestion);
assert('Day 1 suggestion mentions Old Delhi', dayA.overnight_suggestion?.includes('Old Delhi'));
assert('Day 2→3 different area → no suggestion on Day 2', dayB.overnight_suggestion === undefined);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Mode 3 Unit Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
