// backend/services/ocr.js
// OCR via Google Document AI (primary) with Tesseract.js fallback.
// Config: GCP_PROJECT_ID, GCP_LOCATION, GCP_DOCAI_PROCESSOR_ID, GOOGLE_APPLICATION_CREDENTIALS

const Tesseract = require('tesseract.js');

function hasGcpConfig() {
    return !!(
        process.env.GCP_PROJECT_ID &&
        process.env.GCP_LOCATION &&
        process.env.GCP_DOCAI_PROCESSOR_ID &&
        process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
}

// mimeType can be 'image/png', 'image/jpeg', or 'application/pdf'
async function ocrWithDocumentAI(fileBuffer, mimeType = 'image/png') {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
    const location = process.env.GCP_LOCATION || 'us';
    const apiEndpoint = location === 'us'
        ? 'documentai.googleapis.com'
        : `${location}-documentai.googleapis.com`;
    const client = new DocumentProcessorServiceClient({ apiEndpoint });

    const name = [
        'projects', process.env.GCP_PROJECT_ID,
        'locations', process.env.GCP_LOCATION || 'us',
        'processors', process.env.GCP_DOCAI_PROCESSOR_ID
    ].join('/');

    const [result] = await client.processDocument({
        name,
        rawDocument: {
            content: fileBuffer.toString('base64'),
            mimeType
        },
        processOptions: {
            ocrConfig: {
                languageHints: ['ar', 'en']
            }
        }
    });

    return result.document.text || '';
}

async function ocrWithTesseract(imageBuffer) {
    // OLD MODEL: Tesseract.js — used when GCP Document AI is not configured
    const { data: { text } } = await Tesseract.recognize(
        imageBuffer,
        'ara+eng',
        { logger: m => process.stdout.write(`\rOCR: ${m.status} ${m.progress ? Math.round(m.progress * 100) + '%' : '     '}`) }
    );
    process.stdout.write('\n');
    return text;
}

// PDF fallback: extract embedded text via pdf-parse (works for text-based PDFs, not scanned)
async function extractPdfText(pdfBuffer) {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
}

// fileBuffer: Buffer; mimeType defaults to 'image/png' for backward compat
async function performOCR(fileBuffer, mimeType = 'image/png') {
    if (hasGcpConfig()) {
        console.log('🔍 OCR: Google Document AI');
        try {
            const text = await ocrWithDocumentAI(fileBuffer, mimeType);
            console.log(`✅ Google Document AI: ${text.length} chars`);
            return text;
        } catch (err) {
            console.warn('⚠️  Google Document AI failed, falling back:', err.message);
        }
    } else {
        console.log('🔍 OCR: GCP not configured — using fallback');
    }

    if (mimeType === 'application/pdf') {
        console.log('🔍 Fallback: pdf-parse (text-based PDF extraction)');
        const text = await extractPdfText(fileBuffer);
        console.log(`✅ pdf-parse: ${text.length} chars`);
        return text;
    }

    const text = await ocrWithTesseract(fileBuffer);
    console.log(`✅ Tesseract: ${text.length} chars`);
    return text;
}

module.exports = { performOCR };
