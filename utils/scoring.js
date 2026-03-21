/**
 * Calculates a composite score for Mode 1 (Nearby locations).
 * Optional timeSlot and returnDistKm params add penalty layers.
 * Callers that don't pass the optional params get identical behaviour to before.
 *
 * @param {Object} place - Place document from Mongo
 * @param {Array<string>} userTags - Tags selected by the user
 * @param {number} distanceMeters - Distance from user in meters
 * @param {string} [timeSlot] - 'morning'|'afternoon'|'evening' — applies time penalty when set
 * @param {number} [returnDistKm] - straight-line km back to origin — applies return penalty when set
 * @returns {number} Score (higher is better)
 */
export const calculateCompositeScore = (place, userTags = [], distanceMeters, timeSlot, returnDistKm) => {
    let score = 0;

    // 1. Distance score — Fix 3: distance as INPUT, not hard cutoff
    // Within 3km: full 100pts; 3–6km: linear decay; beyond: floor at 30
    const distKm = (distanceMeters || 0) / 1000;
    let distScore;
    if (distKm <= 3)       distScore = 100;
    else if (distKm <= 6)  distScore = 100 - ((distKm - 3) / 3) * 50; // decay to 50
    else                   distScore = 30;
    score += distScore * 0.20;

    // 2. Base ratings
    const cultural   = place.scores?.cultural    || 0.5;
    const popularity = place.scores?.popularity  || 0.5;
    score += (cultural * 100)   * 0.20;
    score += (popularity * 100) * 0.20;

    // 3. Tag matching
    if (userTags.length > 0 && place.tags && place.tags.length > 0) {
        const matches = userTags.filter(t => place.tags.includes(t.toLowerCase())).length;
        score += (matches / userTags.length * 100) * 0.40;
    } else {
        score += (popularity * 100) * 0.40;
    }

    // 4. Fix 7: Time-of-day penalty (only when timeSlot is provided)
    if (timeSlot) {
        const bestTimes = place.best_time_of_day || [];
        if (bestTimes.length > 0 && !bestTimes.includes(timeSlot)) {
            score *= 0.65;  // soft penalty — never exclude
        }
    }

    // 5. Fix 5: Return-to-origin penalty (only when returnDistKm is provided)
    if (returnDistKm != null && returnDistKm > 4.5) {
        const excess = returnDistKm - 4.5;
        score = Math.max(0, score - excess * 2.5);
    }

    return Math.max(0, score);
};
