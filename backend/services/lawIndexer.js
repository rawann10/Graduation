// backend/services/lawIndexer.js
// Indexes all three Egyptian law files into ChromaDB (SQLite-backed):
//   · Sports Law   (SPORTSS (1).json)
//   · Law 159/1981 (law_159_cleaned (1).json)
//   · Law 95/1992  (law_95_cleaned (1).json)
// Run via:  npm run index-laws
// Idempotent — stable numeric IDs per law (sports=1xx, law159=2xx, law95=3xx offsets).
const fs   = require('fs');
const path = require('path');
const { embed }                    = require('./embeddings');
const { ensureCollection, upsertLaws } = require('./vectorStore');

// Resolve a path relative to backend/ regardless of where the process is started.
function resolvePath(envVar, defaultRelative) {
    const raw = process.env[envVar] || defaultRelative;
    // If already absolute, use as-is; otherwise resolve from backend root.
    return path.isAbsolute(raw)
        ? raw
        : path.resolve(__dirname, '..', raw.replace(/^\.\//, ''));
}

const LAW_CONFIGS = [
    {
        key:       'sports',
        envVar:    'SPORTS_LAW_PATH',
        default:   './data/SPORTSS_fixed.json',
        idOffset:  100000,   // IDs: 100001 – 100999
        lawSource: 'sports_law_171_2025'
    },
    {
        key:       'law159',
        envVar:    'COMMERCIAL_LAW_159_PATH',
        default:   './data/law_159_final.json',
        idOffset:  200000,   // IDs: 200001 – 200999
        lawSource: 'commercial_law_159_1981'
    },
    {
        key:       'law95',
        envVar:    'COMMERCIAL_LAW_95_PATH',
        default:   './data/law_95_cleaned (1).json',
        idOffset:  300000,   // IDs: 300001 – 300999
        lawSource: 'commercial_law_95_1992'
    }
];

// Build the text we embed for each article.  We concatenate title + content
// so the vector captures both the heading and the actual legal text.
function articleEmbedText(article) {
    return [article.title, article.content].filter(Boolean).join('\n');
}

// Normalise the raw JSON from any of the three file formats into a flat list
// of { id, payload } objects, ready for embedding.
function extractArticles(dataset, idOffset) {
    const meta = dataset.metadata || {};
    const info = dataset.law_info  || {};

    const lawNameAr = info.name_ar || meta.law_name_ar || '';
    const lawNameEn = info.name_en || meta.law_name_en || '';

    // Both SPORTSS and labor files use "articles"; old format used "related_laws".
    const raw = Array.isArray(dataset.articles)
        ? dataset.articles
        : (Array.isArray(dataset.related_laws) ? dataset.related_laws : []);

    return raw
        .map((a, i) => {
            const content = String(a.content || a.law_text_ar || '').trim();
            if (!content) return null;

            const articleNumber = String(
                a.unique_id ?? a.article_number ?? a.number ?? a.id ?? i + 1
            );
            const title = a.title || a.law_title_ar || `المادة ${articleNumber}`;

            return {
                id: idOffset + i + 1,   // stable, unique within this law
                payload: {
                    law_name_ar:    lawNameAr,
                    law_name_en:    lawNameEn,
                    article_number: articleNumber,
                    title,
                    content,
                    relevance:      a.relevance || ''
                },
                embedText: articleEmbedText({ title, content })
            };
        })
        .filter(Boolean);
}

async function indexLaws() {
    await ensureCollection();

    let totalIndexed = 0;

    for (const cfg of LAW_CONFIGS) {
        const filePath = resolvePath(cfg.envVar, cfg.default);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Skipping ${cfg.key} — file not found: ${filePath}`);
            continue;
        }

        console.log(`\n📚 [${cfg.key}] Loading: ${path.basename(filePath)}`);
        const dataset  = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const articles = extractArticles(dataset, cfg.idOffset);
        console.log(`   Found ${articles.length} articles.`);

        if (!articles.length) {
            console.warn(`   No articles extracted — skipping.`);
            continue;
        }

        console.log(`   Embedding via BAAI/bge-m3...`);
        const texts   = articles.map(a => a.embedText);
        const vectors = await embed(texts);

        const points = articles.map((a, i) => ({
            id:      a.id,
            vector:  vectors[i],
            payload: { ...a.payload, law_source: cfg.lawSource }
        }));

        await upsertLaws(points);
        console.log(`   ✅ Indexed ${points.length} articles (IDs ${points[0].id}–${points[points.length - 1].id}).`);
        totalIndexed += points.length;
    }

    console.log(`\n✅ Done — ${totalIndexed} total articles indexed across all law files.`);
    return totalIndexed;
}

module.exports = { indexLaws };
