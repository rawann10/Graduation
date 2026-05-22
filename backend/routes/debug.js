const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const extractionCache = require('../services/extractionCache');

const router = express.Router();

// GET /api/debug/ocr-test
// Shows the first 200 chars of the last uploaded contract's extracted text,
// both raw (straight from pdf-parse/mammoth/OCR) and after cleanAndFormat(),
// so you can tell whether Arabic reversal happens before or after Groq.
router.get('/ocr-test', authenticateToken, (req, res) => {
    const cache = extractionCache.lastExtraction;

    if (!cache) {
        return res.status(404).json({
            error: 'No contract analyzed yet in this server session. Upload a file first.'
        });
    }

    res.json({
        filename:    cache.filename,
        mimetype:    cache.mimetype,
        requiresOCR: cache.requiresOCR,
        timestamp:   cache.timestamp,
        raw: {
            label: 'Direct output from pdf-parse / mammoth / OCR — unchanged',
            chars: cache.raw200.length,
            text:  cache.raw200
        },
        cleaned: {
            label: 'After cleanAndFormat() — what Groq actually receives',
            chars: cache.cleaned200.length,
            text:  cache.cleaned200
        },
        diagnosis: cache.raw200 === cache.cleaned200
            ? 'raw and cleaned are identical (no characters were stripped)'
            : 'cleanAndFormat() changed the text — see both versions above'
    });
});

module.exports = router;
