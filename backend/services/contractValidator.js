// backend/services/contractValidator.js
// Checks extracted text before sending to Groq to avoid wasting tokens on non-contract files.

const ARABIC_TERMS = [
    'عقد', 'اتفاقية', 'طرف', 'بند', 'إيجار', 'مستأجر', 'مؤجر',
    'التزام', 'توقيع', 'مدة', 'أجرة', 'فسخ', 'ضمان'
];

const ENGLISH_TERMS = [
    'contract', 'agreement', 'party', 'clause', 'tenant', 'landlord',
    'obligation', 'signed', 'terms', 'conditions', 'payment', 'hereby',
    'lessee', 'lessor'
];

const MIN_TEXT_LENGTH = 150;
const MIN_KEYWORD_MATCHES = 3;

function isLikelyContract(text) {
    if (!text || text.length < MIN_TEXT_LENGTH) return false;

    const lower = text.toLowerCase();
    let matches = 0;

    for (const term of ARABIC_TERMS) {
        if (text.includes(term)) {
            matches++;
            if (matches >= MIN_KEYWORD_MATCHES) return true;
        }
    }

    for (const term of ENGLISH_TERMS) {
        if (lower.includes(term)) {
            matches++;
            if (matches >= MIN_KEYWORD_MATCHES) return true;
        }
    }

    return false;
}

module.exports = { isLikelyContract };
