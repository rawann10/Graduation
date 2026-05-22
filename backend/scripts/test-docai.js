// backend/scripts/test-docai.js
// Direct Document AI test — run from backend/ with: node scripts/test-docai.js
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

// Find the PDF by glob — the actual filename has hidden Unicode bidi marks
const dataDir = path.join(__dirname, '..', 'data');
const pdfFile = fs.readdirSync(dataDir).find(f => f.includes('copy.pdf'));
if (!pdfFile) { console.error('No *copy.pdf found in data/'); process.exit(1); }
const PDF_PATH = path.join(dataDir, pdfFile);
console.log('[0] Resolved PDF path:', PDF_PATH);

async function main() {
    console.log('=== Document AI Direct Test ===\n');

    // 1. Read file
    const fileBuffer = fs.readFileSync(PDF_PATH);
    console.log(`[1] PDF file size: ${fileBuffer.length} bytes`);

    // 2. Config
    const projectId = process.env.GCP_PROJECT_ID;
    const location   = process.env.GCP_LOCATION || 'us';
    const processorId = process.env.GCP_DOCAI_PROCESSOR_ID;
    const keyFile    = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log(`[2] GCP_PROJECT_ID:          ${projectId}`);
    console.log(`[2] GCP_LOCATION:             ${location}`);
    console.log(`[2] GCP_DOCAI_PROCESSOR_ID:  ${processorId}`);
    console.log(`[2] GOOGLE_APPLICATION_CREDENTIALS: ${keyFile}`);
    console.log(`[2] key file exists: ${fs.existsSync(path.join(__dirname, '..', keyFile)) ? 'YES' : 'NO (checking relative to cwd)'}`);

    // 3. Build client
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    const apiEndpoint = location === 'us'
        ? 'documentai.googleapis.com'
        : `${location}-documentai.googleapis.com`;
    console.log(`\n[3] API endpoint: ${apiEndpoint}`);
    const client = new DocumentProcessorServiceClient({ apiEndpoint });

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log(`[3] Processor resource name: ${name}`);

    // 4. Send request
    const encodedContent = fileBuffer.toString('base64');
    console.log(`\n[4] base64 encoded size: ${encodedContent.length} chars`);
    console.log('[4] Sending request to Document AI...');

    let rawResult;
    try {
        [rawResult] = await client.processDocument({
            name,
            rawDocument: {
                content: encodedContent,
                mimeType: 'application/pdf'
            },
            processOptions: {
                ocrConfig: {
                    languageHints: ['ar', 'en']
                }
            }
        });
    } catch (err) {
        console.error('\n[ERROR] Document AI threw an exception:');
        console.error('  message:', err.message);
        console.error('  code:', err.code);
        console.error('  details:', err.details);
        if (err.metadata) console.error('  metadata:', JSON.stringify(err.metadata));
        process.exit(1);
    }

    console.log('\n[5] === RAW RESPONSE ===');
    console.log('Top-level keys:', Object.keys(rawResult).join(', '));

    const doc = rawResult.document;
    if (!doc) {
        console.error('[5] rawResult.document is null/undefined — full response:');
        console.error(JSON.stringify(rawResult, null, 2));
        process.exit(1);
    }

    console.log('\n[6] === document fields ===');
    console.log('document keys:', Object.keys(doc).join(', '));
    console.log('document.mimeType:', doc.mimeType);
    console.log('document.text length:', doc.text?.length ?? 'null/undefined');
    console.log('document.pages count:', doc.pages?.length ?? 'null/undefined');
    if (doc.error) {
        console.log('document.error:', JSON.stringify(doc.error));
    }

    // 7. Pages breakdown
    if (doc.pages?.length) {
        console.log('\n[7] === Pages breakdown ===');
        doc.pages.forEach((page, i) => {
            console.log(`  page[${i}] dimension: ${page.dimension?.width}x${page.dimension?.height}`);
            console.log(`  page[${i}] blocks: ${page.blocks?.length ?? 0}`);
            console.log(`  page[${i}] paragraphs: ${page.paragraphs?.length ?? 0}`);
            console.log(`  page[${i}] lines: ${page.lines?.length ?? 0}`);
            console.log(`  page[${i}] tokens: ${page.tokens?.length ?? 0}`);
        });
    } else {
        console.log('\n[7] No pages in response!');
    }

    // 8. Text extraction
    console.log('\n[8] === Text Extraction ===');
    console.log('document.text (first 500 chars):');
    console.log(doc.text ? doc.text.slice(0, 500) : '(EMPTY)');

    // 9. Try to extract text manually from tokens if doc.text is empty
    if (!doc.text && doc.pages?.length) {
        console.log('\n[9] doc.text is empty — attempting manual extraction from page tokens...');
        const textSegments = [];
        for (const page of doc.pages) {
            for (const token of (page.tokens || [])) {
                const seg = token.layout?.textAnchor?.textSegments?.[0];
                if (seg) {
                    textSegments.push({ startIndex: seg.startIndex, endIndex: seg.endIndex });
                }
            }
        }
        console.log(`  Found ${textSegments.length} text segments in tokens`);
        if (textSegments.length > 0) {
            console.log('  First 5 segments:', JSON.stringify(textSegments.slice(0, 5)));
        }
    }

    // 10. Dump full sharedData / textStyles if present
    if (doc.textStyles?.length) {
        console.log(`\n[10] textStyles count: ${doc.textStyles.length}`);
    }

    console.log('\n=== Test complete ===');
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
