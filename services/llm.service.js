/**
 * services/llm.service.js
 *
 * Gemini API integration for Mode 2 day composition.
 * Prompt construction and cache key are delegated to mode2.service.js.
 * This file is now responsible ONLY for:
 *   - Caching (keyed by pre-built cache key string)
 *   - Calling the Gemini API with a pre-built prompt string
 *   - Returning { days: string[][], rationales: string[] }
 *   - Falling back to algorithmic grouping on quota / error
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// No in-memory cache — always call Gemini fresh so different categories/dates produce different results.

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHMIC FALLBACK
// Groups places by area first, distributes evenly across days.
// Also generates template rationales so the response shape is always consistent.
// ─────────────────────────────────────────────────────────────────────────────
function algorithmicDayCompose(places, numDays) {
    const sorted = [...places].sort((a, b) => {
        const sa = (a.scores?.cultural_score || 0) + (a.scores?.popularity_score || 0);
        const sb = (b.scores?.cultural_score || 0) + (b.scores?.popularity_score || 0);
        return sb - sa;
    });

    const areaMap = {};
    sorted.forEach(p => {
        const area = p.area || 'Other';
        if (!areaMap[area]) areaMap[area] = [];
        areaMap[area].push(String(p._id));
    });

    const days = Array.from({ length: numDays }, () => []);
    let dayIdx = 0;
    for (const [, ids] of Object.entries(areaMap)) {
        for (const id of ids) {
            const target = days.findIndex(d => d.length < 5);
            if (target >= 0) days[target].push(id);
            dayIdx = (dayIdx + 1) % numDays;
        }
    }

    const filledDays = days.filter(d => d.length > 0);

    // Build rationales using the same area-aggregation as generateFallbackRationale
    const rationales = filledDays.map(ids => {
        const dayPlaces = ids.map(id => sorted.find(p => String(p._id) === id)).filter(Boolean);
        if (dayPlaces.length === 0) return 'A curated Delhi day.';
        const areaCounts = {};
        dayPlaces.forEach(p => {
            const a = p.area || 'Delhi';
            areaCounts[a] = (areaCounts[a] || 0) + 1;
        });
        const area = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0][0];
        const anchor = dayPlaces.reduce((best, p) =>
            (p.scores?.cultural_score || 0) > (best.scores?.cultural_score || 0) ? p : best,
            dayPlaces[0]
        );
        return `${area} exploration anchored by ${anchor.name}.`;
    });

    return { days: filledDays, rationales };
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM COMPOSER
// Accepts a pre-built { promptStr, places, numDays }
// Returns: { days: string[][], rationales: string[] }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {string}   opts.promptStr  - pre-built prompt from buildLLMPrompt()
 * @param {Object[]} opts.places     - candidate pool (for fallback)
 * @param {number}   opts.numDays
 * @returns {Promise<{ days: string[][], rationales: string[] }>}
 */
export const composeDaysWithGemini = async ({ promptStr, places, numDays }) => {
    // ── Guard: no API key → fallback immediately ─────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
        console.warn('[LLM] No GEMINI_API_KEY — using algorithmic fallback');
        return algorithmicDayCompose(places, numDays);
    }

    try {
        const response = await genAI.models.generateContent({
            model:    'gemini-2.0-flash-lite',
            contents: promptStr,
            config:   { temperature: 0.2 }
        });

        let text = response.text.trim()
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`No JSON found in LLM response: ${text.slice(0, 120)}`);

        const data = JSON.parse(match[0]);
        if (!data.days || !Array.isArray(data.days)) throw new Error('LLM returned no "days" array');

        // Normalise rationales — ensure array length matches days
        const rationales = Array.isArray(data.rationales) ? data.rationales : [];
        while (rationales.length < data.days.length) rationales.push('');

        console.log('[LLM] Day composition complete.');
        return { days: data.days, rationales };

    } catch (err) {
        const isQuota = err?.message?.includes('429') ||
            err?.message?.includes('quota') ||
            err?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuota) {
            console.warn('[LLM] Quota exceeded — using algorithmic fallback');
        } else {
            console.error('[LLM] Error:', err.message, '— using algorithmic fallback');
        }
        return algorithmicDayCompose(places, numDays);
    }
};
