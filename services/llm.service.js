import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// In-memory cache: key -> { result, timestamp }
const llmCache = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Simple string hash for cache keys
 */
function hashKey(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return String(hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHMIC FALLBACK
// Used when LLM is unavailable / rate-limited.
// Groups places by area first, then distributes evenly across days.
// ─────────────────────────────────────────────────────────────────────────────
function algorithmicDayCompose(places, numDays) {
    // Sort by composite score descending
    const sorted = [...places].sort((a, b) => {
        const sa = (a.scores?.cultural_score || 0) + (a.scores?.popularity_score || 0);
        const sb = (b.scores?.cultural_score || 0) + (b.scores?.popularity_score || 0);
        return sb - sa;
    });

    // Group by area
    const areaMap = {};
    sorted.forEach(p => {
        const area = p.area || 'Other';
        if (!areaMap[area]) areaMap[area] = [];
        areaMap[area].push(String(p._id));
    });

    // Distribute area groups round-robin into days
    const days = Array.from({ length: numDays }, () => []);
    let dayIdx = 0;
    for (const [, ids] of Object.entries(areaMap)) {
        for (const id of ids) {
            if (days[dayIdx].length < 6) { // max 6 per day
                days[dayIdx].push(id);
            } else {
                // find next day with room
                const next = days.findIndex(d => d.length < 6);
                if (next >= 0) days[next].push(id);
            }
            dayIdx = (dayIdx + 1) % numDays;
        }
    }
    return days.filter(d => d.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM COMPOSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uses Gemini to group places into days logically.
 * Falls back to algorithmic grouping on quota/network errors.
 *
 * @param {Array}  places      - Top candidate places to organise
 * @param {number} numDays     - Number of days for the itinerary
 * @param {Object} cacheParams - Cache key parameters
 * @returns {Promise<Array<Array<string>>>}
 */
export const composeDaysWithGemini = async (places, numDays, cacheParams = {}) => {
    // ── Cache check ─────────────────────────────────────────────────────────
    const cacheKey = hashKey({ ...cacheParams, numDays, placeCount: places.length });
    if (llmCache.has(cacheKey)) {
        const { result, timestamp } = llmCache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
            console.log('[LLM Cache] HIT — returning cached day composition');
            return result;
        }
        llmCache.delete(cacheKey);
    }

    // ── Guard: no API key → fallback immediately ─────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
        console.warn('[LLM] No GEMINI_API_KEY — using algorithmic fallback');
        return algorithmicDayCompose(places, numDays);
    }

    // ── ULTRA-SLIM prompt (minimise tokens) ─────────────────────────────────
    // Only send the 4 fields Gemini actually needs for grouping.
    // Cap at 15 places so prompt stays tiny on the free tier.
    const topPlaces = places.slice(0, 15);
    const promptData = topPlaces.map(p => ({
        id: String(p._id),
        name: p.name,
        area: p.area,
        duration: p.visit_info?.avg_duration_min || 60
    }));

    const prompt =
`Group these Delhi places into ${numDays} day(s) for a tourist itinerary.
Rules: same area = same day, total duration per day ≤ 360 min.
Return ONLY raw JSON (no markdown): {"days":[["id1","id2"],["id3"]]}

Places:
${JSON.stringify(promptData)}`;

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash-lite', // Cheaper model → less quota usage
            contents: prompt,
            config: { temperature: 0.2 }
        });

        let text = response.text.trim()
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`No JSON found in LLM response: ${text.slice(0, 100)}`);

        const data = JSON.parse(match[0]);
        if (!data.days || !Array.isArray(data.days)) throw new Error('LLM returned no "days" array');

        // Cache result
        llmCache.set(cacheKey, { result: data.days, timestamp: Date.now() });
        console.log('[LLM] Day composition complete and cached');
        return data.days;

    } catch (err) {
        const isQuota = err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuota) {
            console.warn('[LLM] Quota exceeded — using algorithmic fallback');
        } else {
            console.error('[LLM] Error:', err.message, '— using algorithmic fallback');
        }
        // Fallback: still return a usable itinerary
        return algorithmicDayCompose(places, numDays);
    }
};
