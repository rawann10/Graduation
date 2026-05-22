// backend/scripts/smoke-embeddings.js
// Quick validation: embed a query, search ChromaDB, print top-3 law articles.
// Run AFTER `npm run index-laws`.
// Usage: node scripts/smoke-embeddings.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { embedOne }         = require('../services/embeddings');
const { ensureCollection, search } = require('../services/vectorStore');

const QUERY = process.argv[2] || 'فسخ العقد دون إشعار مسبق';

async function main() {
    console.log(`\n🔍 Query: "${QUERY}"\n`);

    console.log('Step 1 — generating embedding...');
    const vec = await embedOne(QUERY);
    console.log(`   dim=${vec.length}, L2-norm=${Math.sqrt(vec.reduce((s,v)=>s+v*v,0)).toFixed(6)}`);
    console.log(`   first 5 values: [${vec.slice(0,5).map(v=>v.toFixed(5)).join(', ')}]`);

    console.log('\nStep 2 — searching ChromaDB...');
    await ensureCollection();
    const results = await search(vec, 3);

    if (!results.length) {
        console.log('\n⚠️  No results — run `node scripts/index-laws-chroma.js` first, then retry.');
        return;
    }

    console.log(`\nTop ${results.length} matching law articles:\n`);
    results.forEach((r, i) => {
        console.log(`[${i+1}] score=${r.score?.toFixed(4)} | Article ${r.article_number}`);
        console.log(`     Law (AR): ${r.law_name_ar}`);
        console.log(`     Law (EN): ${r.law_name_en}`);
        console.log(`     Text (first 120 chars): ${(r.content || '').substring(0,120)}…\n`);
    });
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
