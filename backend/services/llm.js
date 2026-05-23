// backend/services/llm.js
// Groq — llama-3.3-70b-versatile — 6 analysis functions + Q&A chatbot.

const Groq = require('groq-sdk');
const { embedOne } = require('./embeddings');
const { search }   = require('./vectorStore');

// Client is created lazily so module load never throws when the key is missing
// at require-time (e.g. before dotenv has run in tests / scripts).
let _client = null;
function getClient() {
    if (!_client) _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return _client;
}

const MODEL          = 'llama-3.3-70b-versatile';
const MAX_TOKENS     = 2000;
const TEMPERATURE    = 0.1;
const RETRY_DELAY_MS = 30_000;

function hasApiKey() {
    return !!process.env.GROQ_API_KEY;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseJSON(raw) {
    if (!raw) throw new Error('LLM returned empty/null content');

    // 1. Extract from ```json ... ``` block anywhere in the response
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (blockMatch ? blockMatch[1] : raw).trim();

    // 2. Try direct parse
    try { return JSON.parse(candidate); } catch (_) {}

    // 3. Find first '{' and last '}' and try to parse that slice
    const start = candidate.indexOf('{');
    const end   = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(candidate.slice(start, end + 1)); } catch (e) {
            throw new Error(`LLM response malformed JSON: ${e.message}\nRaw (first 300): ${raw.substring(0, 300)}`);
        }
    }

    throw new Error(`No JSON object found in LLM response. Raw (first 300): ${raw.substring(0, 300)}`);
}

// Sends one prompt to Groq. Retries once after 30 s on a 429 rate-limit error.
async function call(prompt, options = {}) {
    // Warn if the prompt is unusually large — never truncate silently.
    const charCount = prompt.length;
    if (charCount > 60_000) {
        console.warn(`⚠️  Prompt is ${charCount} chars — may approach context limit.`);
    }

    for (let attempt = 0; attempt <= 1; attempt++) {
        try {
            const response = await getClient().chat.completions.create({
                model:       MODEL,
                messages:    [{ role: 'user', content: prompt }],
                max_tokens:  options.max_tokens  ?? MAX_TOKENS,
                temperature: options.temperature ?? TEMPERATURE
            });
            const content = response.choices[0]?.message?.content;
            if (!content) {
                const reason = response.choices[0]?.finish_reason || 'unknown';
                throw new Error(`LLM returned empty content (finish_reason: ${reason})`);
            }
            return content;
        } catch (err) {
            const is429 = err.status === 429
                || String(err.message).includes('429')
                || String(err.message).toLowerCase().includes('rate limit')
                || String(err.message).toLowerCase().includes('rate_limit');

            if (is429 && attempt === 0) {
                console.warn(`⚠️  Groq 429 rate limit — waiting 30 s then retrying once...`);
                await sleep(RETRY_DELAY_MS);
                continue;
            }
            throw err;
        }
    }
}

function buildSummaryContext(summary) {
    if (!summary) return '';
    const parties = (summary.parties || [])
        .map(p => `${p.name} (${p.role})`)
        .join('، ');
    return `سياق العقد (محدد مسبقاً):
النوع: ${summary.contract_type || 'غير محدد'}
الأطراف: ${parties || 'غير محدد'}
الغرض: ${summary.purpose || 'غير محدد'}

`;
}

// ── Law source filter map ─────────────────────────────────────────────────────
const LAW_SOURCES = {
    sport:      ['sports_law_171_2025'],
    commercial: ['commercial_law_159_1981', 'commercial_law_95_1992']
};

// ── RAG retrieval — runs once, feeds all 6 prompts ────────────────────────────

async function retrieveLaws(contractText, contractType = null) {
    try {
        const vec        = await embedOne(contractText.substring(0, 1000));
        const lawSources = contractType ? (LAW_SOURCES[contractType] || null) : null;
        const hits       = await search(vec, 10, lawSources);
        console.log(`🔎 RAG: ChromaDB returned ${hits.length} hit(s)`);
        if (hits.length) {
            hits.forEach((h, i) =>
                console.log(`   [${i + 1}] ${h.law_name_ar || h.law_name || '?'} — Article ${h.article_number} (score: ${h.score?.toFixed(3)})`)
            );
        } else {
            console.warn('⚠️  RAG: 0 hits — collection may be empty, run: node scripts/index-laws-chroma.js');
        }
        if (!hits.length) return 'لا توجد مواد قانونية مسترجعة';
        return hits.map((h, i) =>
            `[${i + 1}] ${h.law_name_ar || ''} — المادة ${h.article_number}\n${(h.content || '').substring(0, 400)}`
        ).join('\n\n');
    } catch (e) {
        console.warn('⚠️  RAG retrieval failed:', e.message);
        return 'لا توجد مواد قانونية مسترجعة';
    }
}

// ── Feature 1: Contract Summary ───────────────────────────────────────────────

async function analyzeContractSummary(fullText, laws) {
    const prompt = `أنت محامٍ مصري أول متخصص في تحليل العقود.
<task>استخرج ملخصاً شاملاً من هذا العقد</task>
<contract>${fullText}</contract>
<relevant_laws>${laws}</relevant_laws>

أعد JSON فقط بدون أي نص خارجه أو backticks:
{
  "contract_type": "",
  "purpose": "",
  "parties": [{"name":"","role":"","type":""}],
  "duration": {"start":"","end":"","total":""},
  "financial_terms": {"total_value":"","currency":"","payment_schedule":""},
  "key_obligations": {"party_one":[],"party_two":[]},
  "governing_law": "",
  "jurisdiction": "",
  "summary": "4-6 جمل عربية تشرح العقد كاملاً"
}`;
    return parseJSON(await call(prompt));
}

// ── Feature 2: Risk Scoring ───────────────────────────────────────────────────
// temperature:0 for determinism. Full anti-hallucination rubric injected verbatim.

async function analyzeRiskScoring(fullText, laws, summary) {
    // Top 5 retrieved law articles injected for in-context citation
    const top5Laws = (laws || '').split('\n\n').slice(0, 5).join('\n\n');

    const prompt = `${buildSummaryContext(summary)}You are a senior Egyptian contract lawyer specializing in risk analysis under Egyptian law.

<task>
Analyze every clause in the contract below and score its legal risk strictly following all rules in this prompt.
All output fields (clause_title, what_it_means, why_its_risky, what_to_do, law_reference) must be written in Arabic.
</task>

<contract>
${fullText}
</contract>

<retrieved_egyptian_law_articles>
${top5Laws}
</retrieved_egyptian_law_articles>

════════════════════════════════════════════════════════
STANDARD CLAUSE LIBRARY — these clause types are STANDARD
and NORMAL in Egyptian contracts and MUST be classified
as LOW unless they contain a direct specific violation:

- Standard payment schedules with clear dates
- Security deposit of 1-3 months rent (standard in Egypt)
- Tenant maintenance responsibility for minor repairs
- Landlord right to inspect with prior notice
- Contract renewal clauses requiring mutual agreement
- Jurisdiction clauses specifying Cairo courts
- Standard termination with 30-60 days notice
- Prohibition of subletting without written permission

These are ALWAYS LOW — do not flag them as Moderate or higher:
- Property/unit identification and description clauses
- Party identification clauses (names, ID numbers, addresses)
- Contract date clauses
- Standard 1-3 month security deposit clauses
- Payment of advance rent of 1-2 months
- Standard maintenance obligation clauses
- Standard prohibition of subletting clauses
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
CONFIDENCE GATE — STRICT RULE: Before assigning High or
Critical to any clause, you must answer these 3 questions
internally:
1. Which EXACT Egyptian law article does this clause violate?
   (not just relate to — actually VIOLATE)
2. What SPECIFIC harm will happen to the user if this clause
   is triggered exactly as written?
3. Is this harm SIGNIFICANTLY worse than what standard
   Egyptian contracts allow?

If you cannot answer all 3 questions with specific answers,
you MUST classify the clause as LOW or MODERATE.
Do not assign High or Critical based on vague concern.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
SEVERITY RUBRIC — follow exactly:

CRITICAL — assign ONLY when the clause:
- Directly violates a mandatory provision in one of the
  retrieved Egyptian law articles, making the contract void
  or voidable
- Exposes one party to criminal liability under Egyptian law
- Contains a complete waiver of fundamental legal rights that
  Egyptian law does not permit waiving
- Imposes unlimited uncapped financial penalties with no legal
  basis

HIGH — assign ONLY when the clause:
- Contradicts one of the retrieved Egyptian law articles
  without making the contract void
- Completely omits a legally required provision
- Gives one party absolute unilateral power with zero legal
  recourse for the other party
- Contains a penalty exceeding Egyptian law limits

MODERATE — assign when the clause:
- Is ambiguous or vague in a way exploitable in court
- Is one-sided but does not directly violate Egyptian law
- Lacks specificity required by Egyptian Commercial Law 17/1999
- Deviates from common Egyptian practice but is not illegal

LOW — assign when the clause:
- Follows standard Egyptian contract practice
- Is clear, specific, and balanced
- Aligns with the retrieved law articles provided
- Has only minor wording improvements possible
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
LIKELIHOOD RUBRIC:

Very Likely — this clause will almost certainly be triggered
              in normal contract execution
Likely      — this clause could easily be triggered
Possible    — this clause might be triggered under certain
              conditions
Unlikely    — this clause is rarely triggered in practice
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
EXAMPLES OF CORRECT CLASSIFICATION — calibrate using these:

Example 1 — LOW (do not over-flag this):
Clause: "يلتزم المستأجر بسداد الإيجار في اليوم الأول من كل شهر"
Classification: LOW
Reason: Standard payment obligation, no penalty mentioned,
        completely normal in Egyptian contracts.

Example 2 — MODERATE:
Clause: "يحق للمؤجر فسخ العقد في أي وقت دون إشعار مسبق"
Classification: MODERATE
Reason: One-sided termination right, vague, but not explicitly
        illegal under Egyptian Civil Code.

Example 3 — HIGH:
Clause: "يتنازل المستأجر عن حقه في اللجوء إلى القضاء نهائياً"
Classification: HIGH
Reason: Waiving right to judicial recourse contradicts
        Article 26 of Egyptian Constitution.

Example 4 — CRITICAL:
Clause: "يحق للمؤجر الاستيلاء على ممتلكات المستأجر عند التأخر
         في السداد دون حكم قضائي"
Classification: CRITICAL
Reason: Self-help eviction without court order directly violates
        Egyptian Civil Code Article 572.

Use these to calibrate. Do not assign HIGH to anything
resembling Example 1.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
REQUIRED: Every contract analysis MUST contain at least one
LOW risk clause. If you find no LOW risk clauses you are
over-flagging. Re-evaluate all clauses and reclassify the
least problematic ones as LOW.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
ANTI-UNIFORMITY RULE: You must NOT assign the same severity
and likelihood to more than 2 clauses in a row. Each clause
must be evaluated completely independently.

Before scoring each clause ask yourself:
- Is this clause different from the previous one I scored?
- Does this clause contain a specific problematic element
  or is it just a standard contract clause?
- Standard identification clauses (property description,
  parties names, dates) must always be LOW
- Standard payment clauses with clear amounts and dates
  must be LOW unless repayment conditions are missing
- Only escalate if there is a SPECIFIC missing protection
  or a SPECIFIC legal violation

If you notice you have assigned the same (severity, likelihood)
pair to 3 or more clauses, STOP and re-evaluate — you are
pattern-matching instead of reading each clause individually.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
REASONING PROCESS — for each clause you must follow these
steps IN ORDER before writing your output:

Step 1: Read ONLY this specific clause. What does it
        literally say? Write it in your own words in
        one sentence.

Step 2: Identify the clause TYPE, then answer the
        matching questions below before continuing:

  If this is a TERMINATION clause, ask yourself:
  - Does the clause require prior written notice before
    termination? If not, that is a risk.
  - Do both parties have equal termination rights, or
    can only one party terminate freely?
  - Is there a grace period for the other party to
    respond or remedy the situation?
  - What happens to payments already made if the
    contract is terminated early?

  If this is a DISPUTE RESOLUTION clause, ask yourself:
  - Which specific arbitration body or court is named?
    If none is named, that is a risk.
  - Does this clause prevent the member from going to
    regular courts entirely?
  - Is the arbitration location practical for both
    parties, or only for one?
  - Who bears the arbitration costs — is this specified?

  If this is a RENEWAL clause, ask yourself:
  - How many days notice is required for renewal or
    non-renewal? If not stated, that is a risk.
  - Can prices or terms change at renewal without
    the other party's explicit consent?
  - Is the renewal period the same as the original,
    or can it change unilaterally?
  - Does silence count as acceptance of renewal?

  If this is a PAYMENT clause, ask yourself:
  - Are the payment dates and amounts clearly specified?
  - What is the penalty for late payment — is it capped?
  - Is there a dispute mechanism if the amount is
    contested?

  If this is a CONFIDENTIALITY or NON-COMPETE clause,
  ask yourself:
  - Is the duration of the restriction clearly stated?
  - Is the geographic or professional scope defined
    narrowly enough to be enforceable?
  - What is the actual penalty for breach?

Step 3: What is the ONE thing that could specifically
        go wrong with this clause AS WRITTEN based on
        your answers above? Be specific to this clause.

Step 4: Have you already mentioned this same risk for
        a previous clause? If yes, find a different
        angle for this clause. Every clause must have
        a UNIQUE risk explanation.

Step 5: Does this clause directly mention a specific
        money amount? If yes you may reference it.
        If no, do NOT mention any money amount at all
        even if you saw amounts in other clauses.

Step 6: Now write your output using the rubric.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
FORBIDDEN — never use these phrases anywhere in your output:
- "يمكن أن يتعرض لخسائر مالية"
- "يمكن أن يتعرض لخسائر مادية"
- "قد يتعرض لخسائر"
- "يؤثر على حقوق الطرفين"
- "قد يؤثر على قيمة الإيجار"
- "financial losses"
- "material losses"

If you find yourself writing any of these you have not
analyzed specifically enough. Stop and think again.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
UNIQUENESS RULE: Read all your previous clause analyses
before writing the next one. The why_its_risky field must
be completely different for every clause. If two clauses
have similar risks, explain the specific difference
between them. Copy-pasting the same explanation with
different words is not acceptable.
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
AMOUNT RULE: Only reference a specific money amount in a
clause explanation if that exact amount is written in that
specific clause. Do not carry amounts over from other clauses.
════════════════════════════════════════════════════════

Additional rules:
- law_reference must cite ONLY an article that appears verbatim in <retrieved_egyptian_law_articles> above — copy the law name and article number exactly as written there
- NEVER cite القانون المدني 131/1948 or any other law that does not appear in <retrieved_egyptian_law_articles> — not even if you know it from your training
- If no retrieved article fits perfectly, pick the closest one from the list and explain the connection; do NOT invent or recall articles from outside the list
- what_it_means: zero legal jargon — explain in plain Arabic as if to someone who never read a contract; do NOT use square brackets [ ] anywhere in your output — write naturally without brackets
- why_its_risky: a real specific scenario with real consequences and real numbers if present in THAT SPECIFIC clause only
- what_to_do: specific text suggestions — not vague advice
- Do not use square brackets [ ] in any output field — write naturally without brackets
- Report only genuine risks — maximum 8 clauses

Return ONLY valid JSON, no text outside it, no backticks:
{
  "clauses": [
    {
      "clause_title": "عنوان عربي قصير للبند لا يتجاوز 8 كلمات",
      "severity": "Critical | High | Moderate | Low",
      "severity_score": 4,
      "likelihood": "Very Likely | Likely | Possible | Unlikely",
      "likelihood_score": 4,
      "what_it_means": "2-3 جمل عربية بسيطة تشرح ما يقوله هذا البند كأنك تشرح لشخص لم يقرأ عقداً من قبل",
      "why_its_risky": "1-2 جملتان عربيتان تشرحان الضرر المحدد مع ذكر المبالغ أو الحقوق المفقودة إن وُجدت",
      "what_to_do": "2-3 خطوات عملية محددة باللغة العربية مع اقتراح نص التعديل",
      "law_reference": "اسم القانون ورقم المادة حرفياً كما ورد في retrieved_egyptian_law_articles"
    }
  ]
}`;

    return parseJSON(await call(prompt, { temperature: 0 }));
}

// ── Feature 3: Legal References ───────────────────────────────────────────────

async function analyzeLegalReferences(fullText, laws, summary) {
    const prompt = `${buildSummaryContext(summary)}أنت محامٍ مصري متخصص في القانون التجاري والرياضي.

<task>لكل بند رئيسي في العقد، اذكر المادة القانونية المصرية الأكثر صلة به من المواد المسترجعة أدناه.</task>

<contract>${fullText}</contract>

<relevant_laws>
${laws}
</relevant_laws>

تعليمات صارمة:
1. يجب أن تستشهد بمادة قانونية من <relevant_laws> لكل بند — لا تترك حقلي law_name أو article_number فارغَين أبداً.
2. اقتبس اسم القانون ورقم المادة حرفياً كما ورد في <relevant_laws> — لا تغيّر أي حرف.
3. إذا انطبقت أكثر من مادة على بند واحد، أدرج سجلاً منفصلاً لكل مادة.
4. إذا كانت المواد المسترجعة لا تنطبق تماماً على بند ما، اذكر أقرب مادة من القائمة أعلاه مع توضيح وجه الصلة في حقل relevance.
5. لا تكتب "لا يوجد مرجع قانوني محدد" — هذه الإجابة غير مقبولة. اختر دائماً الأقرب من المواد المتاحة.
6. محظور تماماً: لا تستشهد بأي مادة من القانون المدني 131/1948 أو أي قانون آخر غير موجود في <relevant_laws> — حتى لو كنت تعرفها من تدريبك.

أعد JSON فقط بدون أي نص خارجه أو backticks:
{
  "references": [
    {
      "clause_text": "نص البند الفعلي من العقد",
      "law_name": "اسم القانون كما ورد في relevant_laws",
      "article_number": "رقم المادة كما ورد في relevant_laws",
      "article_summary": "ملخص نص المادة القانونية",
      "relevance": "شرح كيف تنطبق هذه المادة على هذا البند تحديداً"
    }
  ]
}`;
    return parseJSON(await call(prompt));
}

// ── Feature 4: Named Entities ─────────────────────────────────────────────────

async function analyzeNamedEntities(fullText, summary) {
    const prompt = `${buildSummaryContext(summary)}أنت محلل قانوني متخصص في استخراج البيانات.
<task>استخرج جميع الكيانات المذكورة في العقد</task>
<contract>${fullText}</contract>

أعد JSON فقط بدون أي نص خارجه أو backticks:
{
  "parties": [
    {"name":"","role":"الطرف الأول/الثاني","type":"شركة/فرد/نادٍ/جهة حكومية"}
  ],
  "dates": [{"date":"","context":""}],
  "locations": [{"location":"","context":""}],
  "monetary_amounts": [{"amount":"","currency":"","context":""}],
  "reference_numbers": [{"number":"","type":""}]
}

القواعد: استخرج حرفياً من العقد فقط. لا تخمّن أو تخترع. اكتب "غير محدد" إذا لم يُوجد.`;
    return parseJSON(await call(prompt));
}

// ── Feature 5: Clause Detection ───────────────────────────────────────────────

async function analyzeClauseDetection(fullText, summary) {
    const prompt = `${buildSummaryContext(summary)}أنت محامٍ مصري متخصص في تحليل بنود العقود.
<task>قسّم العقد إلى بنوده الرئيسية وصنّفها</task>
<contract>${fullText}</contract>

أعد JSON فقط بدون أي نص خارجه أو backticks:
{
  "clauses": [
    {
      "clause_number": "1",
      "clause_type": "نوع البند",
      "clause_text": "نص البند",
      "plain_explanation": "شرح مبسط للشخص العادي"
    }
  ],
  "total_clauses": 0
}

أنواع البنود المسموح بها: الأطراف، المدة، المالية، الالتزامات، الإنهاء، الغرامات، التحكيم، السرية، القوة القاهرة، الاختصاص القضائي، رأس المال، توزيع الأرباح، أخرى`;
    return parseJSON(await call(prompt));
}

// ── Feature 6: Legal Terms ────────────────────────────────────────────────────

async function analyzeLegalTerms(fullText, summary) {
    const prompt = `${buildSummaryContext(summary)}أنت محامٍ مصري متخصص في تبسيط المصطلحات القانونية.
<task>اشرح المصطلحات القانونية الصعبة في هذا العقد</task>
<contract>${fullText}</contract>

أعد JSON فقط بدون أي نص خارجه أو backticks:
{
  "terms": [
    {
      "term": "المصطلح",
      "simple_definition": "تعريف بسيط بالعربية",
      "example_from_contract": "مثال من العقد نفسه"
    }
  ]
}

القواعد: أدرج فقط المصطلحات التي لن يفهمها غير المتخصص. الحد الأدنى 5، الحد الأقصى 15 مصطلحاً.`;
    return parseJSON(await call(prompt));
}

// ── Q&A chatbot ───────────────────────────────────────────────────────────────

async function answerWithRAG(question, context) {
    let lawContext = 'غير متوفر';
    try {
        const queryVec   = await embedOne(question);
        const lawSources = context.contractType ? (LAW_SOURCES[context.contractType] || null) : null;
        const hits       = await search(queryVec, 5, lawSources);
        if (hits.length) {
            lawContext = hits.map((h, i) =>
                `[${i + 1}] ${h.law_name_ar || ''} — المادة ${h.article_number}\n${(h.content || '').substring(0, 350)}`
            ).join('\n\n');
        }
    } catch (e) {
        console.warn('⚠️  RAG retrieval failed:', e.message);
    }

    const qaCtx    = context.qaContext || {};
    const summary  = context.summary?.overview || qaCtx.contractSummary || 'غير متوفر';
    const topRisks = (qaCtx.topRisks || []).slice(0, 5)
        .map(r => `• ${r.description}: ${(r.text || '').substring(0, 100)}`)
        .join('\n') || 'غير متوفر';

    const prompt = `أنت مستشار قانوني متخصص في القانون المصري. أجب على سؤال المستخدم بناءً على العقد والمواد القانونية المرفقة.

ملخص العقد:
${summary}

أبرز بنود العقد:
${topRisks}

مواد قانونية مسترجعة ذات صلة:
${lawContext}

سؤال المستخدم: ${question}

أجب بإيجاز ووضوح باللغة العربية مستنداً إلى المعلومات أعلاه. إذا كانت المعلومات غير كافية للإجابة، صرّح بذلك.`;

    return call(prompt);
}

module.exports = {
    hasApiKey,
    retrieveLaws,
    analyzeContractSummary,
    analyzeRiskScoring,
    analyzeLegalReferences,
    analyzeNamedEntities,
    analyzeClauseDetection,
    analyzeLegalTerms,
    answerWithRAG
};
