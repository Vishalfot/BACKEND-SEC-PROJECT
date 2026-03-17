/**
 * Utility to slice an ordered route of places into daily arrays
 * considering travel times and visit durations.
 * 
 * @param {Array} orderedPlaces - Array of place objects in the order they must be visited
 * @param {number[][]} travelMatrix - matrix of travel durations between places (in seconds)
 * @param {number} dailyBudgetMinutes - maximum allowed minutes per day (e.g., 420 for 7 hours)
 */
export const sliceIntoDays = (orderedPlaces, travelMatrix, dailyBudgetMinutes = 420) => {
    const days = [];
    let currentDay = [];
    let currentDayTime = 0; // in minutes

    for (let i = 0; i < orderedPlaces.length; i++) {
        const place = orderedPlaces[i];
        
        // Time required to visit the place + buffer
        const visitDuration = (place.visit_info?.avg_duration_min || 60) + 30; // 30 mins buffer
        
        // Time to travel from previous place (if not the first of the day)
        let travelDuration = 0;
        if (currentDay.length > 0) {
            // Find indices in the original matrix
            const prevPlaceIndex = orderedPlaces.findIndex(p => p._id === currentDay[currentDay.length - 1]._id);
            const currentPlaceIndex = orderedPlaces.findIndex(p => p._id === place._id);
            
            // matrix holds seconds, convert to minutes
            if (prevPlaceIndex !== -1 && currentPlaceIndex !== -1) {
                travelDuration = Math.ceil((travelMatrix[prevPlaceIndex][currentPlaceIndex] || 0) / 60);
            }
        }

        const requiredTime = visitDuration + travelDuration;

        // Ensure we don't start a day with a place that requires more time than the budget
        if (currentDayTime + requiredTime > dailyBudgetMinutes && currentDay.length > 0) {
            // Start a new day
            days.push(currentDay);
            currentDay = [place];
            currentDayTime = visitDuration; // new day, no travel time for first place (or assume from hotel)
        } else {
            currentDay.push(place);
            currentDayTime += requiredTime;
        }
    }

    if (currentDay.length > 0) {
        days.push(currentDay);
    }

    return days;
};
