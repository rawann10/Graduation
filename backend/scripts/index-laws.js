// backend/scripts/index-laws.js
// CLI: node scripts/index-laws.js   (or: npm run index-laws)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { indexLaws } = require('../services/lawIndexer');

indexLaws()
    .then(n => { console.log(`\n✅ Indexing complete. ${n} articles in ChromaDB.`); process.exit(0); })
    .catch(err => { console.error('\n❌ Indexing failed:', err.message); process.exit(1); });
