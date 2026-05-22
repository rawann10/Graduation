// backend/scripts/index-laws-chroma.js
// Indexes all three Egyptian law files into ChromaDB (SQLite-backed).
// Run once: node scripts/index-laws-chroma.js
// Idempotent — skips re-indexing when the collection is already fully populated.
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { embed }                 = require('../services/embeddings');
const { getOrCreateCollection } = require('../services/chromaStore');

const COLLECTION = 'lawgic_laws';
const BATCH_SIZE = 25;    // embed 25 articles per HuggingFace API call

// ── Law file config — mirrors lawIndexer.js ───────────────────────────────────
const LAW_CONFIGS = [
    {
        key:       'sports',
        envVar:    'SPORTS_LAW_PATH',
        default:   './data/SPORTSS_fixed.json',
        idOffset:  100000,
        lawSource: 'sports_law_171_2025'
    },
    {
        key:       'law159',
        envVar:    'COMMERCIAL_LAW_159_PATH',
        default:   './data/law_159_final.json',
        idOffset:  200000,
        lawSource: 'commercial_law_159_1981'
    },
    {
        key:       'law95',
        envVar:    'COMMERCIAL_LAW_95_PATH',
        default:   './data/law_95_cleaned (1).json',
        idOffset:  300000,
        lawSource: 'commercial_law_95_1992'
    }
];

function resolvePath(envVar, defaultRelative) {
    const raw = process.env[envVar] || defaultRelative;
    return path.isAbsolute(raw)
        ? raw
        : path.resolve(__dirname, '..', raw.replace(/^\.\//, ''));
}

function extractArticles(dataset, idOffset, lawSource) {
    const meta = dataset.metadata || {};
    const info = dataset.law_info  || {};

    const lawNameAr = info.name_ar || meta.law_name_ar || '';
    const lawNameEn = info.name_en || meta.law_name_en || '';

    const raw = Array.isArray(dataset.articles)
        ? dataset.articles
        : (Array.isArray(dataset.related_laws) ? dataset.related_laws : []);

    return raw
        .map((a, i) => {
            const content = String(a.content || a.law_text_ar || '').trim();
            if (!content) return null;

            const articleNumber = String(a.unique_id ?? a.article_number ?? a.number ?? a.id ?? i + 1);
            const title = a.title || a.law_title_ar || `المادة ${articleNumber}`;

            return {
                id:        String(idOffset + i + 1),
                embedText: [title, content].filter(Boolean).join('\n'),
                metadata: {
                    law_name_ar:    lawNameAr,
                    law_name_en:    lawNameEn,
                    article_number: articleNumber,
                    title,
                    content,
                    relevance:      a.relevance || '',
                    law_source:     lawSource
                }
            };
        })
        .filter(Boolean);
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('⚖️  LawGic — ChromaDB Law Indexer (embedded SQLite)');
    console.log('='.repeat(60));

    const col = await getOrCreateCollection({ name: COLLECTION });

    // ── Count total expected articles before deciding to skip ─────────────────
    let expectedTotal = 0;
    const allParsed   = [];

    for (const cfg of LAW_CONFIGS) {
        const filePath = resolvePath(cfg.envVar, cfg.default);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found — skipping: ${filePath}`);
            continue;
        }
        const dataset  = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const articles = extractArticles(dataset, cfg.idOffset, cfg.lawSource);
        expectedTotal += articles.length;
        allParsed.push({ cfg, articles });
        console.log(`📚 [${cfg.key}] Found ${articles.length} articles in ${path.basename(filePath)}`);
    }

    const existing = await col.count();

    if (existing >= expectedTotal && expectedTotal > 0) {
        console.log(`\n✅ Collection already populated — ${existing} articles in ChromaDB.`);
        console.log('   Skipping re-indexing. Delete chroma_data/ to force a rebuild.');
        console.log('='.repeat(60) + '\n');
        return existing;
    }

    if (existing > 0) {
        console.log(`\n⚠️  Collection has ${existing}/${expectedTotal} articles — re-indexing all files.`);
    } else {
        console.log(`\n🔄 Collection is empty — starting full indexing (${expectedTotal} articles total)...`);
    }

    // ── Index each law file in batches of BATCH_SIZE ──────────────────────────
    let totalIndexed = 0;

    for (const { cfg, articles } of allParsed) {
        if (!articles.length) continue;

        console.log(`\n📖 [${cfg.key}] Indexing ${articles.length} articles in batches of ${BATCH_SIZE}...`);

        const ids        = [];
        const embeddings = [];
        const metadatas  = [];

        for (let start = 0; start < articles.length; start += BATCH_SIZE) {
            const batch = articles.slice(start, start + BATCH_SIZE);
            const texts = batch.map(a => a.embedText);

            let vectors;
            try {
                vectors = await embed(texts);
            } catch (err) {
                console.error(`   ❌ Embedding failed for articles ${start + 1}–${start + batch.length}: ${err.message}`);
                console.error('      Skipping this batch and continuing...');
                continue;
            }

            for (let j = 0; j < batch.length; j++) {
                ids.push(batch[j].id);
                embeddings.push(vectors[j]);
                metadatas.push(batch[j].metadata);
            }

            const done = Math.min(start + BATCH_SIZE, articles.length);
            console.log(`   ✅ Embedded ${done}/${articles.length} articles`);
        }

        if (ids.length === 0) {
            console.warn(`   ⚠️  No articles embedded for [${cfg.key}] — all batches failed.`);
            continue;
        }

        await col.add({ ids, embeddings, metadatas });
        console.log(`   📤 Saved ${ids.length} articles to ChromaDB (${cfg.key})`);
        totalIndexed += ids.length;
    }

    const finalCount = await col.count();

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Indexing complete — ${totalIndexed} new articles added`);
    console.log(`📊 Total articles in ChromaDB: ${finalCount}`);
    console.log('='.repeat(60) + '\n');

    return finalCount;
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n❌ Indexing failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    });
