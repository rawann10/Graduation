// backend/services/chromaStore.js
// Embedded persistent vector store — SQLite backend, ChromaDB-compatible API.
//
// The chromadb npm package (JS) is an HTTP client that requires a separate
// Chroma server, so it cannot run truly embedded. This module provides the
// same Collection API using better-sqlite3 (already a project dependency) so
// no Docker and no external server are needed.
//
// Data is stored in: CHROMA_DATA_PATH (default ./chroma_data/chroma.db)

'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Path helper ──────────────────────────────────────────────────────────────
// Always resolve relative to the backend/ root (one level up from services/).
function getDataPath() {
    const raw = process.env.CHROMA_DATA_PATH || './chroma_data';
    if (path.isAbsolute(raw)) return raw;
    return path.resolve(__dirname, '..', raw.replace(/^\.\//, ''));
}

// ── Lazy SQLite connection ────────────────────────────────────────────────────
let _db = null;

function db() {
    if (_db) return _db;

    const dir = getDataPath();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(path.join(dir, 'chroma.db'));
    _db.pragma('journal_mode = WAL');

    _db.exec(`
        CREATE TABLE IF NOT EXISTS collections (
            name TEXT PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS vectors (
            id         TEXT NOT NULL,
            collection TEXT NOT NULL,
            embedding  TEXT NOT NULL,
            metadata   TEXT NOT NULL DEFAULT '{}',
            PRIMARY KEY (id, collection)
        );

        CREATE INDEX IF NOT EXISTS idx_vec_collection ON vectors (collection);
    `);

    return _db;
}

// ── Cosine similarity (pure JS, runs in-process) ─────────────────────────────
function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na  += a[i] * a[i];
        nb  += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}

// ── Collection class (mirrors ChromaDB Collection API) ───────────────────────
class Collection {
    constructor(name) {
        this.name = name;
    }

    /** Returns the number of vectors in this collection. */
    async count() {
        return db()
            .prepare('SELECT COUNT(*) AS n FROM vectors WHERE collection = ?')
            .get(this.name).n;
    }

    /**
     * Insert or replace vectors.
     * @param {{ ids: string[], embeddings: number[][], metadatas?: object[] }} opts
     */
    async add({ ids, embeddings, metadatas = [] }) {
        const stmt = db().prepare(
            'INSERT OR REPLACE INTO vectors (id, collection, embedding, metadata) VALUES (?, ?, ?, ?)'
        );
        const insertAll = db().transaction(rows => {
            for (const row of rows) stmt.run(row);
        });

        insertAll(
            ids.map((id, i) => [
                id,
                this.name,
                JSON.stringify(embeddings[i]),
                JSON.stringify(metadatas[i] || {})
            ])
        );
    }

    /**
     * Nearest-neighbour search using cosine similarity.
     * @param {{ queryEmbeddings: number[][], nResults?: number }} opts
     * @returns ChromaDB-shaped result: { ids, distances, metadatas }
     */
    async query({ queryEmbeddings, nResults = 5 }) {
        const rows = db()
            .prepare('SELECT id, embedding, metadata FROM vectors WHERE collection = ?')
            .all(this.name);

        if (!rows.length) {
            return { ids: [[]], distances: [[]], metadatas: [[]] };
        }

        const qv = queryEmbeddings[0];

        const scored = rows
            .map(r => ({
                id:       r.id,
                score:    cosineSim(qv, JSON.parse(r.embedding)),
                metadata: JSON.parse(r.metadata)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, nResults);

        return {
            ids:       [scored.map(r => r.id)],
            distances: [scored.map(r => 1 - r.score)],   // ChromaDB convention: lower = closer
            metadatas: [scored.map(r => r.metadata)]
        };
    }
}

// ── Public API (mirrors ChromaDB client methods) ──────────────────────────────

/**
 * Get or create a named collection. Idempotent.
 * @param {{ name: string }} opts
 * @returns {Promise<Collection>}
 */
async function getOrCreateCollection({ name }) {
    db().prepare('INSERT OR IGNORE INTO collections (name) VALUES (?)').run(name);
    return new Collection(name);
}

/**
 * Get an existing collection. Throws if it doesn't exist.
 * @param {{ name: string }} opts
 * @returns {Promise<Collection>}
 */
async function getCollection({ name }) {
    const row = db().prepare('SELECT name FROM collections WHERE name = ?').get(name);
    if (!row) throw new Error(`ChromaDB collection "${name}" does not exist`);
    return new Collection(name);
}

module.exports = { getOrCreateCollection, getCollection };
