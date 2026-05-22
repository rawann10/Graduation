// backend/utils/sanitize.js
// Server-side DOMPurify sanitizer for LLM output.
// Strips all HTML tags from string values in LLM responses before sending to clients.

const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Recursively walks any object/array and strips HTML tags from every string value.
// Non-string values (numbers, booleans, null, undefined) are returned as-is.
function sanitizeLLMOutput(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
        return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [] });
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeLLMOutput);
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizeLLMOutput(value);
        }
        return result;
    }
    return obj;
}

module.exports = { sanitizeLLMOutput };
