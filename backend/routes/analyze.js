const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const sharp = require('sharp');
const { LawGicAIPipeline, PreprocessingStage } = require('../services/aiPipeline');
const { authenticateToken } = require('../middleware/auth');
const { createDocument, saveAnalysisResult, getDocumentsByUser, getDocumentWithResult, deleteDocument } = require('../db/database');
const extractionCache = require('../services/extractionCache');
const { validateUploadedFile } = require('../middleware/fileValidation');
const { analysisLimiter } = require('../middleware/rateLimiter');
const { sanitizeLLMOutput } = require('../utils/sanitize');

const preprocessing = new PreprocessingStage();

const router = express.Router();

// Initialize AI Pipeline
const aiPipeline = new LawGicAIPipeline({
    hfApiKey: process.env.HUGGINGFACE_API_KEY // Optional for LLM features
});


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/png',
            'image/jpeg',
            'image/jpg'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});

/**
 * Extract text from uploaded file
 */
async function extractTextFromFile(filePath, mimetype) {
    console.log('📄 Extracting text from file type:', mimetype);
    
    const dataBuffer = fs.readFileSync(filePath);

    try {
        // PDF files
        if (mimetype === 'application/pdf') {
            const data = await pdf(dataBuffer);

            // Scanned PDF — no text at all
            if (data.text.length < 100) {
                console.warn('⚠️ PDF has minimal text, routing to OCR.');
                return { extractedText: data.text, requiresOCR: true, confidence: 'low' };
            }

            // Arabic PDFs are often visually encoded: pdf-parse returns letters
            // reversed within each word. Google Document AI understands Arabic
            // bidirectional text and accepts PDF buffers natively, so route these
            // through OCR to get correct character order.
            const arabicCharCount = (data.text.match(/[؀-ۿ]/g) || []).length;
            const arabicRatio = arabicCharCount / (data.text.replace(/\s/g, '').length || 1);
            if (arabicRatio > 0.3) {
                console.log(`📋 Arabic PDF detected (${Math.round(arabicRatio * 100)}% Arabic chars) — routing to Document AI for correct character order.`);
                return { extractedText: '', imageBuffer: dataBuffer, requiresOCR: true, confidence: 'medium', mimeType: 'application/pdf' };
            }

            return { extractedText: data.text, requiresOCR: false, confidence: 'high' };
        } 
        // Word documents
        else if (mimetype.includes('word') || mimetype.includes('document')) {
            const result = await mammoth.extractRawText({ buffer: dataBuffer });
            return {
                extractedText: result.value,
                requiresOCR: false,
                confidence: 'high'
            };
        } 
        // Text files
        else if (mimetype === 'text/plain') {
            return {
                extractedText: dataBuffer.toString('utf8'),
                requiresOCR: false,
                confidence: 'high'
            };
        }
        // Image files (scanned contracts)
        else if (mimetype.startsWith('image/')) {
            console.log('🖼️ Image detected - will use OCR');
            // Convert image to optimal format for OCR
            const processedBuffer = await sharp(dataBuffer)
                .grayscale()
                .normalize()
                .toBuffer();
                
            return {
                extractedText: '',
                imageBuffer: processedBuffer,
                requiresOCR: true,
                confidence: 'medium'
            };
        }
        
        throw new Error('Unsupported file type');
    } catch (error) {
        console.error('❌ Text extraction error:', error);
        throw new Error('Could not read file content: ' + error.message);
    }
}

// POST /api/analyze - Main analysis endpoint (requires login)
router.post('/', authenticateToken, analysisLimiter, upload.single('document'), validateUploadedFile, async (req, res) => {
    let filePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        filePath = req.file.path;
        const rawName = req.file.originalname;
        // Multer receives filenames as Latin-1; re-encode to get correct UTF-8 Arabic
        let fileName;
        try {
            fileName = Buffer.from(rawName, 'latin1').toString('utf8');
            // Sanity check: if result still looks like mojibake, fall back to raw
            if (/[\uFFFD]/.test(fileName)) fileName = rawName;
        } catch (e) {
            fileName = rawName;
        }
        const rawType = String(req.body.contractType || 'sport').toLowerCase();
        const contractType = rawType === 'investment' ? 'commercial' : rawType;
        if (contractType !== 'sport' && contractType !== 'commercial') {
            return res.status(400).json({ error: 'Unsupported contract type. Allowed: sport, commercial' });
        }
        const options = JSON.parse(req.body.options || '{}');

        console.log('\n' + '='.repeat(80));
        console.log('🎯 NEW ANALYSIS REQUEST');
        console.log('='.repeat(80));
        console.log('📄 File:', fileName);
        console.log('📊 Size:', req.file.size, 'bytes');
        console.log('📋 Type:', req.file.mimetype);
        console.log('📑 Contract Type:', contractType);
        console.log('⚙️  Options:', options);
        console.log('='.repeat(80) + '\n');

        // Create document record in DB
        let docRecord = null;
        try {
            docRecord = createDocument({ filename: fileName, userId: req.user.id, status: 'analyzing' });
        } catch (e) {
            console.warn('⚠️ Could not create document record:', e.message);
        }

        // STEP 1: Extract text
        const extractionResult = await extractTextFromFile(filePath, req.file.mimetype);
        
        if (!extractionResult.extractedText && !extractionResult.requiresOCR) {
            throw new Error('Could not extract any text from document');
        }

        // Cache raw + cleaned text for the debug endpoint
        const rawText = extractionResult.extractedText || '';
        extractionCache.lastExtraction = {
            filename:   fileName,
            mimetype:   req.file.mimetype,
            requiresOCR: extractionResult.requiresOCR,
            timestamp:  new Date().toISOString(),
            raw200:     rawText.substring(0, 200),
            cleaned200: preprocessing.cleanAndFormat(rawText).substring(0, 200)
        };

        // STEP 3: Run AI Pipeline
        const analysis = await aiPipeline.processContract(extractionResult, {
            contractType,
            ...options
        });

        // STEP 4: Format response based on user options
        // All fields are normalized here to match the frontend's expected shape.
        const response = {
            documentName: fileName,
            contractType: contractType,
            extractionConfidence: extractionResult.confidence,
            ocrUsed: extractionResult.requiresOCR,
            timestamp: new Date().toISOString()
        };

        if (options.summarization) {
            response.summary = analysis.summary;
        }

        if (options.riskDetection) {
            // ============================================================
            // RISK SCORING — ISO 31000:2018 (Risk = Likelihood × Consequence)
            // Severity and Likelihood use 4-point Likert ordinal scale (Likert, 1932)
            // Legal Weight derived from RAG retrieval — original LawGic contribution
            // ============================================================

            const rawClauses = analysis.risks?.clauses || [];

            // Empty fallback — frontend never crashes
            if (rawClauses.length === 0) {
                response.risks = { overall: 'Low', riskPercentage: 0, breakdown: { critical: 0, high: 0, moderate: 0, low: 0 }, clauses: [] };
            } else {
                const severityMap   = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
                const likelihoodMap = { 'Very Likely': 4, Likely: 3, Possible: 2, Unlikely: 1 };
                const VALID_SEV     = ['Critical', 'High', 'Moderate', 'Low'];
                const VALID_LIKE    = ['Very Likely', 'Likely', 'Possible', 'Unlikely'];
                const GENERIC_REF   = 'يستند إلى مبادئ القانون المدني المصري العامة';

                // PASS 1: Validate and default invalid LLM values + fill empty law references
                const clauses = rawClauses.map(c => ({
                    ...c,
                    severity:      VALID_SEV.includes(c.severity)   ? c.severity   : 'Moderate',
                    likelihood:    VALID_LIKE.includes(c.likelihood) ? c.likelihood : 'Possible',
                    law_reference: (c.law_reference && c.law_reference.trim()) ? c.law_reference : GENERIC_REF
                }));

                // PASS 2: Anti-hallucination downgrade
                // High/Critical without a specific cited article → downgrade one level.
                // "Real" reference = contains "المادة" and is not the generic fallback.
                clauses.forEach(clause => {
                    const hasRealLawReference =
                        clause.law_reference !== GENERIC_REF &&
                        clause.law_reference.includes('المادة');

                    if (!hasRealLawReference && clause.severity === 'Critical') {
                        clause.severity      = 'High';
                        clause.severity_score = 3;
                        clause.downgraded     = true;
                        clause.downgrade_reason = 'تم تخفيض التصنيف: لم يتم العثور على نص قانوني محدد يدعم هذا التصنيف';
                    } else if (!hasRealLawReference && clause.severity === 'High') {
                        clause.severity      = 'Moderate';
                        clause.severity_score = 2;
                        clause.downgraded     = true;
                        clause.downgrade_reason = 'تم تخفيض التصنيف: لم يتم العثور على نص قانوني محدد يدعم هذا التصنيف';
                    }
                });

                // PASS 3: ISO 31000 clause scoring
                // RAG-grounded clauses (specific article cited) get a 1.5× legal weight.
                // Max possible score per clause: 4 × 4 × 1.5 = 24
                clauses.forEach(clause => {
                    const ragFound =
                        clause.law_reference !== GENERIC_REF &&
                        clause.law_reference.includes('المادة');
                    const legalWeight = ragFound ? 1.5 : 1.0;

                    clause.rag_grounded      = ragFound;
                    clause.clause_score      = (severityMap[clause.severity] || 2) * (likelihoodMap[clause.likelihood] || 2) * legalWeight;
                    clause.clause_score_max  = 24;
                });

                // Final contract risk percentage and overall level
                const totalRisk    = clauses.reduce((sum, c) => sum + c.clause_score, 0);
                const maxPossible  = clauses.length * 24;
                const riskPercentage = Math.round((totalRisk / maxPossible) * 100);

                let overall;
                if      (riskPercentage >= 76) overall = 'Critical';
                else if (riskPercentage >= 51) overall = 'High';
                else if (riskPercentage >= 26) overall = 'Moderate';
                else                           overall = 'Low';

                const breakdown = {
                    critical: clauses.filter(c => c.severity === 'Critical').length,
                    high:     clauses.filter(c => c.severity === 'High').length,
                    moderate: clauses.filter(c => c.severity === 'Moderate').length,
                    low:      clauses.filter(c => c.severity === 'Low').length
                };

                response.risks = { overall, riskPercentage, breakdown, clauses };
            }
        }

        if (options.legalReferences) {
            // Normalize LLM field names (law_name→law, clause_text→clauseDescription, etc.)
            response.legalReferences = (analysis.legalReferences?.references || []).slice(0, 15).map(ref => ({
                law:             ref.law_name,
                articleNumber:   ref.article_number,
                clauseDescription: ref.clause_text,
                articleText:     ref.article_summary,
                relevance:       ref.relevance,
                compliance:      'NEEDS_REVIEW'
            }));
        }

        if (options.entityRecognition) {
            const ents = analysis.entities || {};
            // Normalize nested objects to flat string arrays for the frontend chips
            response.entities = {
                persons:       (ents.parties || []).filter(p => p.type === 'فرد').map(p => p.name),
                organizations: (ents.parties || []).filter(p => p.type !== 'فرد').map(p => `${p.name} (${p.role})`),
                dates:         (ents.dates || []).map(d => `${d.date} — ${d.context}`),
                money:         (ents.monetary_amounts || []).map(m => `${m.amount} ${m.currency} — ${m.context}`)
            };
        }

        if (options.clauseDetection) {
            // Normalize field names and surface plain_explanation for non-expert readers
            response.clauses = (analysis.clauses?.clauses || []).map(c => ({
                number:      c.clause_number,
                description: c.clause_type,
                text:        c.clause_text,
                explanation: c.plain_explanation
            }));
        }

        if (options.termExplanations) {
            // Normalize field names and surface example_from_contract
            response.legalTerms = (analysis.legalTerms?.terms || []).map(t => ({
                term:        t.term,
                explanation: t.simple_definition,
                example:     t.example_from_contract
            }));
        }

        // Always include Q&A context for interactive features
        response.qaContext = analysis.qaContext;
        
        // Include metadata
        response.metadata = analysis.metadata;

        // Store full analysis for Q&A
        response._fullAnalysis = analysis;

        // Save result to DB
        if (docRecord) {
            try {
                saveAnalysisResult(docRecord.id, response, contractType);
            } catch (e) {
                console.warn('⚠️ Could not save analysis result:', e.message);
            }
        }

        // Clean up file
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🗑️  Cleaned up file:', fileName);
            }
        }, 5000);

        console.log('\n' + '='.repeat(80));
        console.log('✅ ANALYSIS COMPLETED SUCCESSFULLY');
        console.log('='.repeat(80));
        console.log('📊 Statistics:');
        console.log('   - Risks found:', (analysis.risks?.clauses || []).length);
        console.log('   - Overall risk:', response.risks?.overall || 'N/A');
        console.log('   - Legal references:', (analysis.legalReferences?.references || []).length);
        console.log('   - Entities found:', Object.values(analysis.entities || {}).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0));
        console.log('   - Legal terms:', (analysis.legalTerms?.terms || []).length);
        console.log('='.repeat(80) + '\n');

        // Sanitize all LLM-sourced string fields before sending to client
        const safeResponse = sanitizeLLMOutput(response);
        res.json(safeResponse);
        
    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('❌ ANALYSIS FAILED');
        console.error('='.repeat(80));
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(80) + '\n');
        
        // Clean up file on error
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 422 = contract validator rejected the document (not a legal contract)
        const statusCode = error.status === 422 ? 422 : 500;
        res.status(statusCode).json({
            error: statusCode === 422 ? 'Document rejected' : 'Failed to analyze document',
            message: error.message,
            stage: error.stage || 'unknown'
        });
    }
});

// POST /api/analyze/qa - Q&A endpoint (requires login)
router.post('/qa', authenticateToken, express.json(), async (req, res) => {
    try {
        const { question, context } = req.body;
        
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (!context || !context.qaContext) {
            return res.status(400).json({ error: 'Analysis context is required' });
        }

        const answer = await aiPipeline.answerQuestion(question, context);
        
        res.json(answer);
    } catch (error) {
        console.error('Q&A error:', error);
        res.status(500).json({
            error: 'Failed to answer question',
            message: error.message
        });
    }
});

// GET /api/analyze/my-contracts - Get current user's contracts
router.get('/my-contracts', authenticateToken, (req, res) => {
    try {
        const docs = getDocumentsByUser(req.user.id);
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load contracts', message: error.message });
    }
});

// GET /api/analyze/my-contracts/:id - Get a specific contract with full analysis
router.get('/my-contracts/:id', authenticateToken, (req, res) => {
    try {
        const doc = getDocumentWithResult(parseInt(req.params.id), req.user.id);
        if (!doc) return res.status(404).json({ error: 'Contract not found' });
        if (doc.analysisResult) {
            try { doc.analysisResult = JSON.parse(doc.analysisResult); } catch (_) {}
        }
        res.json(doc);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load contract', message: error.message });
    }
});

// DELETE /api/analyze/my-contracts/:id - Delete one of the user's own contracts
router.delete('/my-contracts/:id', authenticateToken, (req, res) => {
    try {
        const doc = getDocumentWithResult(parseInt(req.params.id), req.user.id);
        if (!doc) return res.status(404).json({ error: 'Contract not found' });
        deleteDocument(doc.id);
        res.json({ message: 'Contract deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete contract', message: error.message });
    }
});

module.exports = router;