// backend/scripts/test-ocr.js
// Tests Google Document AI OCR on a PDF file.
// Usage: node scripts/test-ocr.js [path/to/file.pdf]
// Defaults to the sample Arabic contract in backend/data/
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { performOCR } = require('../services/ocr');

const DEFAULT_PDF = path.resolve(
    __dirname,
    '../data/نموذج عقد مسئولية محدودة 159 نهائي.pdf'
);

const filePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PDF;

async function main() {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`\n📄 File: ${path.basename(filePath)}`);
    console.log(`   Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB\n`);

    const buffer   = fs.readFileSync(filePath);
    const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 'image/png';

    const start = Date.now();
    const text  = await performOCR(buffer, mimeType);
    const ms    = Date.now() - start;

    console.log(`\n⏱  Took ${ms} ms`);
    console.log(`📝 Extracted ${text.length} characters\n`);
    console.log('─'.repeat(60));
    console.log(text.substring(0, 1500));
    if (text.length > 1500) console.log(`\n… (${text.length - 1500} more characters)`);
    console.log('─'.repeat(60));
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
