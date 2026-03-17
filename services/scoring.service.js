// // services/scoring.service.js

// export function calculateInterestMatch(placeTags = [], userInterests = []) {
//   if (!userInterests.length) return 0;

//   const matchCount = placeTags.filter(tag =>
//     userInterests.some(interest =>
//       tag.toLowerCase().includes(interest.toLowerCase())
//     )
//   ).length;

//   return Math.min(matchCount / userInterests.length, 1);
// }

// export function checkTimeCompatibility(place, currentTime) {
//   const bestTimes = place.visit_info?.best_time_of_day || [];

//   let timeOfDay;
//   if (currentTime.hour >= 6 && currentTime.hour < 12) timeOfDay = "morning";
//   else if (currentTime.hour < 17) timeOfDay = "afternoon";
//   else if (currentTime.hour < 21) timeOfDay = "evening";
//   else timeOfDay = "night";

//   if (bestTimes.includes(timeOfDay) || bestTimes.includes("all_day"))
//     return 1.0;

//   return 0.3;
// }

// export function calculateAuthenticity(place) {
//   const cultural = place.scores?.cultural_score || 0;
//   const popularity = place.scores?.popularity_score || 0;

//   return (cultural + (1 - popularity)) / 2;
// }

// export async function scorePlace({
//   item,
//   userPreferences,
//   previousItem,
//   currentTime,
//   travelData
// }) {
//   let score = 0;

//   // 1️⃣ Interest match (0-40)
//   const interestMatch = calculateInterestMatch(
//     item.tags,
//     userPreferences.interests
//   );
//   score += interestMatch * 40;

//   // 2️⃣ Cultural score (0-20)
//   score += (item.scores?.cultural_score || 0) * 20;

//   // 3️⃣ Authenticity (0-10)
//   score += calculateAuthenticity(item) * 10;

//   // 4️⃣ Time compatibility (0-15)
//   score += checkTimeCompatibility(item, currentTime) * 15;

//   // 5️⃣ Area clustering boost
//   if (previousItem && previousItem.area === item.area) {
//     score += 10;
//   }

//   // 6️⃣ Distance influence
//   if (travelData) {
//     const distanceScore = 1 / (1 + travelData.distance_km);
//     score += distanceScore * 10;
//   }

//   // 7️⃣ Event boost
//   if (item.type === "event") {
//     score += 15;
//   }

//   return score;
// }

// export function calculateInterestMatch(placeTags = [], userInterests = []) {
//   if (!userInterests?.length) return 0;

//   const matchCount = placeTags.filter(tag =>
//     userInterests.some(interest =>
//       tag.toLowerCase().includes(interest.toLowerCase())
//     )
//   ).length;

//   return Math.min(matchCount / userInterests.length, 1);
// }
export function calculateInterestMatch(item, userInterests = []) {
  if (!userInterests?.length) return 0;

  const interests = userInterests.map(i => i.toLowerCase());

  // Collect ALL possible tags from place
  const placeTags = [
    ...(item.tags || []),
    ...(item.categories || []),
    item.category,
    item.type,
    item.name
  ]
    .filter(Boolean)
    .map(t => t.toLowerCase());

  let matchScore = 0;

  interests.forEach(interest => {
    const matched = placeTags.some(tag =>
      tag.includes(interest) || interest.includes(tag)
    );

    if (matched) {
      matchScore += 1;
    }
  });

  // Instead of dividing strictly, reward multi-match
  const normalized = matchScore / interests.length;

  return Math.min(normalized * 1.2, 1); 
}
export function checkTimeCompatibility(place, currentTime) {
  const bestTimes = place.visit_info?.best_time_of_day || [];

  let timeOfDay;
  if (currentTime.hour >= 6 && currentTime.hour < 12) timeOfDay = "morning";
  else if (currentTime.hour < 17) timeOfDay = "afternoon";
  else if (currentTime.hour < 21) timeOfDay = "evening";
  else timeOfDay = "night";

  if (bestTimes.includes(timeOfDay) || bestTimes.includes("all_day"))
    return 1.0;

  return 0.3;
}

export function calculateAuthenticity(place) {
  const cultural = place.scores?.cultural_score || 0;
  const popularity = place.scores?.popularity_score || 0;

  return (cultural + (1 - popularity)) / 2;
}

export async function scorePlace({
  item,
  userPreferences,
  previousItem,
  currentTime,
  travelData
}) {
  let score = 0;

  // ❌ STRICT EVENT TIME VALIDATION
  if (item.type === "event") {
    const eventHour = parseInt(item.start_time.split(":")[0]);
    if (Math.abs(currentTime.hour - eventHour) > 2) {
      return -100; // Prevent wrong-time selection
    }
  }

  // 1️⃣ Interest Match (0–40)
  // const interestMatch = calculateInterestMatch(
  //   item.tags,
  //   userPreferences.interests
  // );
  const interestMatch = calculateInterestMatch(
  item,
  userPreferences.interests
);
  score += interestMatch * 40;

  // 2️⃣ Cultural Score (0–20)
  score += (item.scores?.cultural_score || 0) * 20;

  // 3️⃣ Authenticity (0–10)
  score += calculateAuthenticity(item) * 10;

  // 4️⃣ Time Compatibility (0–15)
  score += checkTimeCompatibility(item, currentTime) * 15;

  // 5️⃣ Area Clustering Boost
  if (previousItem && previousItem.area === item.area) {
    score += 10;
  }

  // 6️⃣ Distance Influence
  if (travelData) {
    const distanceScore = 1 / (1 + travelData.distance_km);
    score += distanceScore * 10;
  }

  // 7️⃣ Event Boost
  if (item.type === "event") score += 15;

  // 8️⃣ Anchor Place Boost
  if (item.special_features?.is_anchor_place) {
    score += 10;
  }

  return score;
}
