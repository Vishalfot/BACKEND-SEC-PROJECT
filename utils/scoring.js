/**
 * Calculates a composite score for Mode 1 (Nearby locations).
 * 
 * @param {Object} place - Place document from Mongo
 * @param {Array<string>} userTags - Tags selected by the user
 * @param {number} distanceMeters - Distance from user in meters
 * @returns {number} Score (higher is better)
 */
export const calculateCompositeScore = (place, userTags = [], distanceMeters) => {
    let score = 0;

    // 1. Distance score (closer = better, up to 5km radius ideally)
    // Scale: 0 meters = 100 points, 5000 meters = 0 points
    let distScore = Math.max(0, 100 - (distanceMeters / 50));
    score += distScore * 0.2; // 20% weight on distance so it doesn't dominate

    // 2. Base ratings
    const cultural = place.scores?.cultural_score || 0.5;
    const popularity = place.scores?.popularity_score || 0.5;
    score += (cultural * 100) * 0.20;   // 20% on cultural
    score += (popularity * 100) * 0.20; // 20% on popularity

    // 3. Tag matching (Interest filtering)
    if (userTags.length > 0 && place.tags && place.tags.length > 0) {
        let matches = 0;
        userTags.forEach(tag => {
            if (place.tags.includes(tag.toLowerCase())) {
                matches++;
            }
        });
        const tagMatchRatio = matches / userTags.length;
        score += (tagMatchRatio * 100) * 0.4; // 40% weight on personal interest
    } else {
        // If no tags provided, distribute the 40% to popularity
        score += (popularity * 100) * 0.4;
    }

    return score;
};
