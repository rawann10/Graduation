// backend/services/embeddings.js
// Sentence embeddings via BAAI/bge-m3 on Hugging Face Inference Router.
// All model config comes from .env (HUGGINGFACE_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIM).

const MODEL = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3';
const DIM   = parseInt(process.env.EMBEDDING_DIM || '1024', 10);

function getApiKey() {
    if (!process.env.HUGGINGFACE_API_KEY) throw new Error('HUGGINGFACE_API_KEY is not set');
    return process.env.HUGGINGFACE_API_KEY;
}

// Mean-pool token-level embeddings → single sentence vector.
function meanPool(tokenEmbeddings) {
    const d = tokenEmbeddings[0].length;
    const out = new Array(d).fill(0);
    for (const tok of tokenEmbeddings) for (let i = 0; i < d; i++) out[i] += tok[i];
    return out.map(v => v / tokenEmbeddings.length);
}

// L2-normalize a vector.
function normalize(vec) {
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm === 0 ? vec : vec.map(v => v / norm);
}

// Coerce the HF API response (1-D, 2-D, or 3-D) into a 2-D matrix
// with one row per input sentence.
function toMatrix(result, numInputs) {
    if (!Array.isArray(result)) throw new Error('Unexpected embedding response type: ' + typeof result);

    // 1-D → single sentence embedding
    if (!Array.isArray(result[0])) return [result];

    // 2-D: either [numInputs × dim] or [seqLen × dim] for a single input
    if (!Array.isArray(result[0][0])) {
        if (result.length === numInputs) return result;   // sentence-level batch
        return [meanPool(result)];                         // token-level single
    }

    // 3-D → [numInputs × seqLen × dim] — mean-pool each
    return result.map(tokens => meanPool(tokens));
}

// Call the HF Inference Router directly (avoids SDK endpoint issues).
async function callHfRouter(inputs) {
    const apiKey = getApiKey();
    const url = `https://router.huggingface.co/hf-inference/models/${MODEL}/pipeline/feature-extraction`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HF API error ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
}

/**
 * Embed one or more texts.
 * @param {string | string[]} texts
 * @returns {Promise<number[][]>} normalised sentence vectors, one per input
 */
async function embed(texts) {
    const inputs = Array.isArray(texts) ? texts : [texts];
    const raw = await callHfRouter(inputs.length === 1 ? inputs[0] : inputs);
    const matrix = toMatrix(raw, inputs.length);
    return matrix.map(normalize);
}

/**
 * Embed a single string and return its vector.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedOne(text) {
    const [vec] = await embed([text]);
    return vec;
}

module.exports = { embed, embedOne, DIM, MODEL };
