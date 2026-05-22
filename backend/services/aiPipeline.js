// backend/services/aiPipeline.js — Pipeline v4.1 (Groq llama-3.3-70b-versatile)
// Features run sequentially with a 15 s gap to stay within Groq free-tier limits.

const { performOCR: performOCRService } = require('./ocr');
const { isLikelyContract } = require('./contractValidator');
const {
    hasApiKey,
    retrieveLaws,
    analyzeContractSummary,
    analyzeRiskScoring,
    analyzeLegalReferences,
    analyzeNamedEntities,
    analyzeClauseDetection,
    analyzeLegalTerms,
    answerWithRAG
} = require('./llm');

const ALL_FEATURES = ['summary', 'risks', 'legalReferences', 'entities', 'clauses', 'legalTerms'];

// 15 s between consecutive LLM calls — keeps us inside Groq free-tier rate limits.
const FEATURE_DELAY_MS = 15_000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

class PreprocessingStage {
    async performOCR(imageBuffer, mimeType = 'image/png') {
        console.log('🔍 OCR: extracting text...');
        const text = await performOCRService(imageBuffer, mimeType);
        console.log(`✅ OCR: ${text.length} chars`);
        return text;
    }

    cleanAndFormat(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[^؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿a-zA-Z0-9\s\.\،\,\-\:\;\(\)\[\]\/\٪\%]/g, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }
}

class LawGicAIPipeline {
    constructor() {
        this.preprocessing = new PreprocessingStage();
    }

    async processContract(file, options = {}) {
        const features = options.features || ALL_FEATURES;

        console.log('\n' + '='.repeat(60));
        console.log('🚀 LawGic AI Pipeline v4.1 — Groq llama-3.3-70b-versatile');
        console.log(`   Features: ${features.join(', ')}`);
        console.log('='.repeat(60) + '\n');

        if (!hasApiKey()) throw new Error('GROQ_API_KEY is not set');

        // STAGE 1: TEXT EXTRACTION
        let fullText = file.extractedText || '';
        if (file.requiresOCR && file.imageBuffer) {
            fullText = await this.preprocessing.performOCR(file.imageBuffer, file.mimeType);
        }
        fullText = this.preprocessing.cleanAndFormat(fullText);
        console.log(`📄 Contract text: ${fullText.length} chars (full text — no truncation)`);

        // CONTRACT VALIDATION — reject before calling Groq if this is not a legal contract
        if (!isLikelyContract(fullText)) {
            const err = new Error('لم يتم التعرف على هذا الملف كعقد قانوني. يرجى رفع ملف يحتوي على بنود قانونية.');
            err.status = 422;
            throw err;
        }
        console.log('✅ Contract validation passed');

        // STAGE 2: RAG — retrieve relevant laws once for all features
        console.log('🔎 Retrieving relevant law articles...');
        const laws = await retrieveLaws(fullText);
        console.log('✅ Laws retrieved');

        // STAGE 3: Summary first — becomes shared context for all remaining features
        console.log('🤖 Step 1/6 — summary...');
        let summaryData = null;
        try {
            summaryData = await analyzeContractSummary(fullText, laws);
            console.log('   ✅ summary');
        } catch (err) {
            console.error(`   ❌ summary failed: ${err.message}`);
        }

        // STAGE 4: Remaining 5 features run one at a time with a 15 s delay between each.
        // The delay sits BEFORE each call so there is always a gap after the previous LLM call
        // (whether that was summary or the prior feature).
        const featureRunners = [
            ['risks',           () => analyzeRiskScoring(fullText, laws, summaryData)],
            ['legalReferences', () => analyzeLegalReferences(fullText, laws, summaryData)],
            ['entities',        () => analyzeNamedEntities(fullText, summaryData)],
            ['clauses',         () => analyzeClauseDetection(fullText, summaryData)],
            ['legalTerms',      () => analyzeLegalTerms(fullText, summaryData)]
        ];

        const data = {};
        let step = 2;
        for (const [feature, runner] of featureRunners) {
            if (!features.includes(feature)) continue;

            console.log(`   ⏳ Waiting ${FEATURE_DELAY_MS / 1000}s before next call (rate-limit guard)...`);
            await sleep(FEATURE_DELAY_MS);

            console.log(`🤖 Step ${step++}/6 — ${feature}...`);
            try {
                data[feature] = await runner();
                console.log(`   ✅ ${feature}`);
            } catch (err) {
                console.warn(`   ⚠️  ${feature} failed: ${err.message}`);
                // Return a structured error so the other features still render correctly.
                data[feature] = { _error: true, message: err.message };
            }
        }

        if (features.includes('summary')) data.summary = summaryData;

        console.log('✅ All features complete\n' + '='.repeat(60) + '\n');
        return this._formatOutput(data, fullText);
    }

    _formatOutput(data, fullText) {
        const summary = data.summary && !data.summary._error ? data.summary : null;
        const risks   = data.risks   && !data.risks._error   ? data.risks   : null;

        // Adapter fields so answerWithRAG keeps working without changes
        if (summary) summary.overview = summary.summary;
        if (risks)   risks.ranked = (risks.clauses || []).map(c => ({
            description:    c.what_it_means,
            text:           c.clause_title,
            recommendation: c.what_to_do
        }));

        return {
            metadata: {
                processedAt:     new Date().toISOString(),
                pipelineVersion: '4.1-Groq-llama-3.3-70b-versatile',
                textLength:      fullText.length
            },
            summary:         summary,
            risks:           risks,
            legalReferences: (data.legalReferences && !data.legalReferences._error) ? data.legalReferences : null,
            entities:        (data.entities        && !data.entities._error)        ? data.entities        : null,
            clauses:         (data.clauses         && !data.clauses._error)         ? data.clauses         : null,
            legalTerms:      (data.legalTerms      && !data.legalTerms._error)      ? data.legalTerms      : null,
            qaContext: {
                contractSummary: summary?.summary || '',
                topRisks: (risks?.ranked || []).slice(0, 5)
            }
        };
    }

    async answerQuestion(question, context) {
        if (!hasApiKey()) {
            return { question, answer: 'GROQ_API_KEY غير مضبوط.', confidence: 0 };
        }
        try {
            const answer = await answerWithRAG(question, context);
            return { question, answer, confidence: 0.95, source: 'groq+rag' };
        } catch (err) {
            return { question, answer: `تعذّر الإجابة: ${err.message}`, confidence: 0 };
        }
    }
}

module.exports = { LawGicAIPipeline, PreprocessingStage };
