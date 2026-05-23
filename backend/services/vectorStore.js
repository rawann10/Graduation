// backend/services/vectorStore.js
// Vector store — ChromaDB-compatible API backed by SQLite (chromaStore.js).
// Drop-in replacement for the former Qdrant implementation.
// No Docker, no external server — runs fully embedded inside Node.js.
'use strict';

const { getOrCreateCollection, getCollection } = require('./chromaStore');

const COLLECTION = 'lawgic_laws';

let _collection = null;

/**
 * Ensure the lawgic_laws collection exists. Idempotent.
 */
async function ensureCollection() {
    await getOrCreateCollection({ name: COLLECTION });
}

/**
 * Upsert law article vectors.
 * Accepts the same shape as the former Qdrant implementation:
 *   { id: number, vector: number[], payload: object }[]
 */
async function upsertLaws(items) {
    const col = await getOrCreateCollection({ name: COLLECTION });
    await col.add({
        ids:        items.map(it => String(it.id)),
        embeddings: items.map(it => it.vector),
        metadatas:  items.map(it => it.payload)
    });
    console.log(`📤 Upserted ${items.length} articles into "${COLLECTION}"`);
}

/**
 * Semantic search over law articles.
 * @param {number[]} queryVector — normalised query embedding
 * @param {number}   topK
 * @param {string[]|null} lawSources — restrict results to these law_source values
 * @returns {Promise<Array<object & {score: number}>>}
 */
async function search(queryVector, topK = 5, lawSources = null) {
    try {
        const col    = await getCollection({ name: COLLECTION });
        const where  = lawSources ? { law_source: lawSources } : null;
        const result = await col.query({ queryEmbeddings: [queryVector], nResults: topK, where });

        const metas     = result.metadatas[0]  || [];
        const distances = result.distances[0]  || [];

        return metas.map((meta, i) => ({ ...meta, score: 1 - distances[i] }));
    } catch (e) {
        if (e.message.includes('does not exist')) {
            console.warn('⚠️  ChromaDB collection not found — run: npm run index-laws');
            return [];
        }
        throw e;
    }
}

module.exports = { ensureCollection, upsertLaws, search, COLLECTION };
