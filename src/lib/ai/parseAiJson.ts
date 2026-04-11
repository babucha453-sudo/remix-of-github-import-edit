/**
 * Utility helpers for extracting JSON from AI responses.
 * AI models frequently wrap JSON in markdown fences or add preamble text.
 */

export function extractJsonFromResponseText(raw: string): unknown {
  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try to isolate array JSON first (common for list outputs)
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');

  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    cleaned = cleaned.slice(arrStart, arrEnd + 1);
  } else {
    // Fallback to object JSON
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart === -1 || objEnd === -1 || objEnd <= objStart) {
      throw new Error('No JSON boundaries found');
    }
    cleaned = cleaned.slice(objStart, objEnd + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fix common JSON issues: trailing commas / control chars
    const repaired = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\x00-\x1F\x7F]/g, '');
    return JSON.parse(repaired);
  }
}

/**
 * Best-effort recovery when an AI response is truncated mid-array.
 */
export function repairTruncatedJson(raw: string): unknown {
  try {
    return extractJsonFromResponseText(raw);
  } catch {
    // Attempt to close the JSON at the last complete object
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const lastObjEnd = cleaned.lastIndexOf('}');
    if (lastObjEnd === -1) throw new Error('No complete JSON object found');

    // If there's an opening array, close it; otherwise just parse the object.
    const arrStart = cleaned.indexOf('[');
    if (arrStart !== -1) {
      const repaired = cleaned.slice(arrStart, lastObjEnd + 1) + ']';
      return extractJsonFromResponseText(repaired);
    }

    const objStart = cleaned.indexOf('{');
    const repaired = cleaned.slice(objStart, lastObjEnd + 1);
    return extractJsonFromResponseText(repaired);
  }
}
