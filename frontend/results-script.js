// Results Page Script — Full bilingual (AR/EN) with ISO 31000 risk display
let analysisData = null;
let analysisOptions = null;

// Escape HTML special characters before inserting dynamic content via innerHTML
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================================================================
// SINGLE TRANSLATION DICTIONARY — every visible string on this page
// ==================================================================
const T = {
    en: {
        // Navigation
        'nav-home': 'Home',
        'nav-new': 'New Analysis',
        // Page header
        'results-title': 'Analysis Complete',
        'doc-loading': 'Loading...',
        // Contract types
        'contract-sport': 'Sports Contract',
        'contract-commercial': 'Commercial Contract',
        // Action buttons
        'qa-btn': 'Ask Questions',
        'download-btn': 'Download',
        // Risk summary bar
        'risk-bar-label': 'Overall Risk Level (ISO 31000)',
        'risk-show-all': 'Show All',
        'sev-critical': 'Critical',
        'sev-high': 'High',
        'sev-moderate': 'Moderate',
        'sev-low': 'Low',
        // Risk cards section
        'risk-section-title': 'Risky Clauses',
        'risk-empty': 'No risky clauses detected in this contract',
        'risk-clause-fallback': 'Clause',
        'risk-what-means': '📖 What does this clause mean?',
        'risk-what-risk': '⚠️ What is the risk?',
        'risk-what-do': '✅ What should you do?',
        'risk-law-ref': '⚖️ Legal Reference:',
        'risk-rag-grounded': 'Based on specific Egyptian law',
        'risk-rag-general': 'General principles',
        'risk-downgraded': '⚠ Classification auto-reviewed',
        // Likelihood labels
        'like-very-likely': 'Very Likely',
        'like-likely': 'Likely',
        'like-possible': 'Possible',
        'like-unlikely': 'Unlikely',
        // Summary card
        'summary-title': 'Contract Summary',
        // Legal references card
        'legal-ref-title': 'Legal References',
        'legal-ref-compliant': 'Compliant',
        'legal-ref-review': 'Needs Review',
        'legal-ref-match': 'Match:',
        // Entities card
        'entities-title': 'Named Entities',
        'entities-parties': '👥 Parties',
        'entities-orgs': '🏢 Organizations',
        'entities-dates': '📅 Dates',
        'entities-money': '💰 Financial Terms',
        // Clauses card
        'clauses-title': 'Detected Clauses',
        'clause-number-prefix': 'Clause',
        // Legal terms card
        'terms-title': 'Legal Terms Explained',
        // Q&A modal
        'qa-title': 'Ask Questions About Your Contract',
        'qa-subtitle': 'Try these questions:',
        'qa-input-label': 'Your Question:',
        'qa-placeholder': 'Type your question here...',
        'qa-answer': 'Answer:',
        'qa-loading': 'Thinking...',
        'qa-confidence': 'Confidence:',
        'qa-error': 'Sorry, an error occurred. Please try again.',
        // Q&A suggested question labels (displayed)
        'qa-q1': '⚠️ What are the main risks in this contract?',
        'qa-q2': '👥 Who are the parties mentioned in the contract?',
        'qa-q3': '📅 What is the duration of the contract?',
        'qa-q4': '🔚 What are the termination conditions?',
        'qa-q5': '💰 What financial amounts are mentioned?',
        'qa-q6': '📋 Give me a summary of this contract',
        'qa-q7': '⚖️ What legal references are related?',
        // Q&A question texts sent to the API
        'qa-q1-text': 'What are the main risks in this contract?',
        'qa-q2-text': 'Who are the parties mentioned in the contract?',
        'qa-q3-text': 'What is the duration of the contract?',
        'qa-q4-text': 'What are the termination conditions?',
        'qa-q5-text': 'What financial amounts are mentioned in the contract?',
        'qa-q6-text': 'Give me a summary of this contract',
        'qa-q7-text': 'What legal references are related to this contract?',
        // Misc
        'no-data': 'No analysis data found. Redirecting to home...',
    },
    ar: {
        // Navigation
        'nav-home': 'الرئيسية',
        'nav-new': 'تحليل جديد',
        // Page header
        'results-title': 'اكتمل التحليل',
        'doc-loading': 'جاري التحميل...',
        // Contract types
        'contract-sport': 'عقد رياضي',
        'contract-commercial': 'عقد تجاري',
        // Action buttons
        'qa-btn': 'اسأل أسئلة',
        'download-btn': 'تنزيل',
        // Risk summary bar
        'risk-bar-label': 'درجة المخاطرة الإجمالية (ISO 31000)',
        'risk-show-all': 'عرض الكل',
        'sev-critical': 'حرجة',
        'sev-high': 'عالٍ',
        'sev-moderate': 'متوسط',
        'sev-low': 'منخفض',
        // Risk cards section
        'risk-section-title': 'البنود الخطرة',
        'risk-empty': 'لم يتم اكتشاف بنود خطرة في هذا العقد',
        'risk-clause-fallback': 'بند',
        'risk-what-means': '📖 ماذا يعني هذا البند؟',
        'risk-what-risk': '⚠️ ما الخطر؟',
        'risk-what-do': '✅ ماذا تفعل؟',
        'risk-law-ref': '⚖️ المرجع القانوني:',
        'risk-rag-grounded': 'مستند إلى نص قانوني مصري',
        'risk-rag-general': 'مبادئ عامة',
        'risk-downgraded': '⚠ تم مراجعة التصنيف تلقائياً',
        // Likelihood labels
        'like-very-likely': 'محتمل جداً',
        'like-likely': 'محتمل',
        'like-possible': 'ممكن',
        'like-unlikely': 'غير محتمل',
        // Summary card
        'summary-title': 'ملخص العقد',
        // Legal references card
        'legal-ref-title': 'المراجع القانونية',
        'legal-ref-compliant': 'متوافق',
        'legal-ref-review': 'يحتاج مراجعة',
        'legal-ref-match': 'تطابق:',
        // Entities card
        'entities-title': 'الكيانات المذكورة',
        'entities-parties': '👥 الأطراف',
        'entities-orgs': '🏢 المؤسسات',
        'entities-dates': '📅 التواريخ',
        'entities-money': '💰 المبالغ المالية',
        // Clauses card
        'clauses-title': 'البنود المكتشفة',
        'clause-number-prefix': 'البند',
        // Legal terms card
        'terms-title': 'شرح المصطلحات القانونية',
        // Q&A modal
        'qa-title': 'اسأل أسئلة عن عقدك',
        'qa-subtitle': 'جرب هذه الأسئلة:',
        'qa-input-label': 'سؤالك:',
        'qa-placeholder': 'اكتب سؤالك هنا...',
        'qa-answer': 'الإجابة:',
        'qa-loading': 'جاري التفكير...',
        'qa-confidence': 'الثقة:',
        'qa-error': 'عذراً، حدث خطأ في الإجابة على سؤالك. يرجى المحاولة مرة أخرى.',
        // Q&A suggested question labels (displayed)
        'qa-q1': '⚠️ ما هي المخاطر الرئيسية في هذا العقد؟',
        'qa-q2': '👥 من هم الأطراف المذكورة في العقد؟',
        'qa-q3': '📅 ما مدة العقد؟',
        'qa-q4': '🔚 ما هي شروط إنهاء العقد؟',
        'qa-q5': '💰 ما هي المبالغ المالية المذكورة؟',
        'qa-q6': '📋 أعطني ملخصاً عن هذا العقد',
        'qa-q7': '⚖️ ما هي المراجع القانونية المرتبطة؟',
        // Q&A question texts sent to the API
        'qa-q1-text': 'ما هي المخاطر الرئيسية في هذا العقد؟',
        'qa-q2-text': 'من هم الأطراف المذكورة في العقد؟',
        'qa-q3-text': 'ما مدة العقد؟',
        'qa-q4-text': 'ما هي شروط إنهاء العقد؟',
        'qa-q5-text': 'ما هي المبالغ المالية المذكورة في العقد؟',
        'qa-q6-text': 'أعطني ملخصاً عن هذا العقد',
        'qa-q7-text': 'ما هي المراجع القانونية المرتبطة بهذا العقد؟',
        // Misc
        'no-data': 'لم يتم العثور على بيانات التحليل. جاري التوجيه إلى الصفحة الرئيسية...',
    }
};

/** Return the translation for key in the active language, falling back to EN. */
function t(key) {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    return (T[lang] && T[lang][key]) || (T.en && T.en[key]) || key;
}

function getLang() {
    return document.documentElement.getAttribute('data-lang') || 'en';
}

// ==================================================================
// LANGUAGE FUNCTIONS
// ==================================================================
function toggleLanguage() {
    const currentLang = getLang();
    const newLang = currentLang === 'en' ? 'ar' : 'en';
    _applyLanguage(newLang);
    localStorage.setItem('language', newLang);
}

function loadLanguage() {
    const savedLang = localStorage.getItem('language') || 'en';
    _applyLanguage(savedLang);
}

function _applyLanguage(lang) {
    const html = document.documentElement;
    html.setAttribute('data-lang', lang);
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    // Update every static [data-translate] element
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if (T[lang] && T[lang][key]) el.textContent = T[lang][key];
    });

    // Update Q&A input placeholder
    const qi = document.getElementById('questionInput');
    if (qi) qi.placeholder = T[lang]['qa-placeholder'] || '';

    // Rebuild Q&A suggested questions
    _renderQASuggestions();

    // Re-render all dynamic cards if data is already loaded
    if (analysisData) {
        _updateDocumentName();
        if (analysisData.risks) displayRiskSummaryBar();

        const container = document.getElementById('resultsContainer');
        if (container) {
            container.innerHTML = '';
            if (analysisOptions.summarization && analysisData.summary)
                container.appendChild(createSummaryCard());
            if (analysisOptions.riskDetection && analysisData.risks)
                container.appendChild(createRiskCardsSection());
            if (analysisOptions.legalReferences && analysisData.legalReferences)
                container.appendChild(createLegalReferencesCard());
            if (analysisOptions.entityRecognition && analysisData.entities)
                container.appendChild(createEntitiesCard());
            if (analysisOptions.clauseDetection && analysisData.clauses)
                container.appendChild(createClausesCard());
            if (analysisOptions.termExplanations && analysisData.legalTerms)
                container.appendChild(createLegalTermsCard());
        }
    }
}

/** Rebuild the 7 suggested Q&A buttons in the modal. */
function _renderQASuggestions() {
    const container = document.getElementById('qaSuggestions');
    if (!container) return;
    const questions = ['qa-q1','qa-q2','qa-q3','qa-q4','qa-q5','qa-q6','qa-q7'];
    container.innerHTML = questions.map((key, i) => {
        const textKey = key + '-text';
        const label   = t(key);
        const qText   = t(textKey);
        return `<button onclick='askQuestion(${JSON.stringify(qText)})'
                    class="text-left p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-sm transition-colors w-full">
                    <span class="font-medium">${label}</span>
                </button>`;
    }).join('');
}

function _updateDocumentName() {
    if (!analysisData) return;
    const contractTypeName = {
        sport:      t('contract-sport'),
        commercial: t('contract-commercial'),
        investment: t('contract-commercial')
    };
    const el = document.getElementById('documentName');
    if (el) el.textContent =
        `${analysisData.documentName} (${contractTypeName[analysisData.contractType] || analysisData.contractType})`;
}

// ==================================================================
// THEME FUNCTIONS
// ==================================================================
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        document.getElementById('themeIcon').textContent = 'dark_mode';
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeIcon').textContent = 'light_mode';
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = 'light_mode';
    }
}

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('hidden');
}

// ==================================================================
// INITIALIZE AND LOAD RESULTS
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadLanguage();
    loadAnalysisResults();
});

function loadAnalysisResults() {
    const resultData  = sessionStorage.getItem('analysisResult');
    const optionsData = sessionStorage.getItem('analysisOptions');

    if (!resultData) {
        alert(t('no-data'));
        window.location.href = 'app.html';
        return;
    }
    if (!sessionStorage.getItem('lawgic_token')) {
        window.location.href = '/';
        return;
    }

    analysisData    = JSON.parse(resultData);
    analysisOptions = optionsData ? JSON.parse(optionsData) : {
        summarization: true, riskDetection: true, legalReferences: true,
        entityRecognition: true, clauseDetection: true, termExplanations: true
    };

    console.log('📊 Analysis Options:', analysisOptions);
    console.log('📄 Analysis Data:', analysisData);

    displayResults();
}

// ==================================================================
// DISPLAY RESULTS
// ==================================================================
function displayResults() {
    _updateDocumentName();

    if (analysisData.risks) displayRiskSummaryBar();

    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';

    if (analysisOptions.summarization && analysisData.summary)
        container.appendChild(createSummaryCard());
    if (analysisOptions.riskDetection && analysisData.risks)
        container.appendChild(createRiskCardsSection());
    if (analysisOptions.legalReferences && analysisData.legalReferences)
        container.appendChild(createLegalReferencesCard());
    if (analysisOptions.entityRecognition && analysisData.entities)
        container.appendChild(createEntitiesCard());
    if (analysisOptions.clauseDetection && analysisData.clauses)
        container.appendChild(createClausesCard());
    if (analysisOptions.termExplanations && analysisData.legalTerms)
        container.appendChild(createLegalTermsCard());
}

// ==================================================================
// RISK SUMMARY BAR
// ==================================================================
let _riskFilter = 'all';

function displayRiskSummaryBar() {
    const content = document.getElementById('overallRiskScore');
    if (!content) return;

    const risks   = analysisData.risks;
    const pct     = risks.riskPercentage ?? 0;
    const overall = risks.overall || 'Low';
    const bd      = risks.breakdown || {};
    const lang    = getLang();
    const isAr    = lang === 'ar';

    const arcColor = pct >= 76 ? '#C0392B'
                   : pct >= 51 ? '#E74C3C'
                   : pct >= 26 ? '#E67E22'
                   :             '#27AE60';

    const circumference = 351.86;
    const dashArray     = `${(pct / 100) * circumference} ${circumference}`;

    const overallLabel = t(`sev-${overall.toLowerCase()}`);

    const severities = [
        { key: 'critical', tKey: 'sev-critical', color: '#C0392B', count: bd.critical || 0 },
        { key: 'high',     tKey: 'sev-high',     color: '#E74C3C', count: bd.high     || 0 },
        { key: 'moderate', tKey: 'sev-moderate',  color: '#E67E22', count: bd.moderate  || 0 },
        { key: 'low',      tKey: 'sev-low',       color: '#27AE60', count: bd.low      || 0 }
    ];

    const countersHtml = severities.map(s => `
        <button onclick="filterRiskCards('${s.key}')" id="filter-btn-${s.key}"
            class="risk-filter-btn flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all hover:opacity-80"
            style="border-color:${s.count > 0 ? s.color : '#e2e8f0'}; opacity:${s.count > 0 ? 1 : 0.45};"
            ${s.count === 0 ? 'disabled' : ''}>
            <span class="text-2xl font-extrabold" style="color:${s.color}">${s.count}</span>
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${t(s.tKey)}</span>
        </button>`).join('');

    const alignClass = isAr ? 'md:text-right' : 'md:text-left';
    const justifyClass = isAr ? 'md:justify-end' : 'md:justify-start';

    content.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm mb-2">
            <div class="flex flex-col md:flex-row items-center gap-8">
                <div class="flex-shrink-0">
                    <div class="relative w-28 h-28">
                        <svg class="w-full h-full" viewBox="0 0 128 128">
                            <circle cx="64" cy="64" r="56" fill="none" stroke="#e2e8f0" stroke-width="10"/>
                            <circle cx="64" cy="64" r="56" fill="none"
                                stroke="${arcColor}" stroke-width="10"
                                stroke-dasharray="${dashArray}"
                                stroke-linecap="round"
                                transform="rotate(-90 64 64)"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="text-2xl font-extrabold" style="color:${arcColor}">${pct}</span>
                            <span class="text-xs text-slate-400">/100</span>
                        </div>
                    </div>
                </div>
                <div class="flex-1 text-center ${alignClass}">
                    <div class="mb-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">${t('risk-bar-label')}</div>
                    <h3 class="text-2xl font-extrabold mb-4" style="color:${arcColor}">${overallLabel}</h3>
                    <div class="flex flex-wrap gap-3 justify-center ${justifyClass}">
                        ${countersHtml}
                        <button onclick="filterRiskCards('all')" id="filter-btn-all"
                            class="risk-filter-btn flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 transition-all hover:opacity-80">
                            <span class="text-2xl font-extrabold text-slate-600 dark:text-slate-300">${(risks.clauses||[]).length}</span>
                            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${t('risk-show-all')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    _highlightFilterBtn(_riskFilter);
}

function filterRiskCards(severity) {
    _riskFilter = severity;
    _highlightFilterBtn(severity);
    const section = document.getElementById('risk-cards-section');
    if (!section) return;
    section.querySelectorAll('.risk-clause-card').forEach(card => {
        const cardSev = card.dataset.severity;
        card.style.display = (severity === 'all' || cardSev === severity) ? '' : 'none';
    });
}

function _highlightFilterBtn(active) {
    document.querySelectorAll('.risk-filter-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-2');
    });
    const activeBtn = document.getElementById(`filter-btn-${active}`);
    if (activeBtn) activeBtn.classList.add('ring-2', 'ring-offset-2');
}

// ==================================================================
// CARD FUNCTIONS
// ==================================================================
function createSummaryCard() {
    const card = document.createElement('div');
    card.className = 'result-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow';
    const summary = analysisData.summary;
    card.innerHTML = `
        <div class="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-700 pb-5">
            <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                <span class="material-icons-round text-2xl">article</span>
            </div>
            <h2 class="text-xl font-bold text-navy dark:text-white">${t('summary-title')}</h2>
        </div>
        <div class="text-slate-700 dark:text-slate-200 leading-relaxed">
            <p class="text-base mb-5">${escapeHtml(summary.overviewEnglish || summary.overview)}</p>
            ${summary.keyPoints ? `
                <ul class="space-y-3">
                    ${summary.keyPoints.map(point => `
                        <li class="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                            <span class="material-icons-round text-primary mt-0.5 shrink-0">check_circle</span>
                            <span class="text-sm font-medium">${escapeHtml(point)}</span>
                        </li>`).join('')}
                </ul>` : ''}
        </div>`;
    return card;
}

// ==================================================================
// RISK CARDS SECTION
// ==================================================================
function createRiskCardsSection() {
    const wrapper = document.createElement('div');
    wrapper.className = 'lg:col-span-2';
    wrapper.id = 'risk-cards-section';

    const clauses = analysisData.risks.clauses || [];

    if (clauses.length === 0) {
        wrapper.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-10 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <div class="text-5xl mb-4">✅</div>
                <p class="text-xl font-semibold text-slate-600 dark:text-slate-300">${t('risk-empty')}</p>
            </div>`;
        return wrapper;
    }

    // Severity config — labels come from t() so they update on language switch
    const sevConfig = {
        Critical: { color: '#C0392B', tKey: 'sev-critical' },
        High:     { color: '#E74C3C', tKey: 'sev-high'     },
        Moderate: { color: '#E67E22', tKey: 'sev-moderate'  },
        Low:      { color: '#27AE60', tKey: 'sev-low'       }
    };
    const likeKeys = {
        'Very Likely': 'like-very-likely',
        'Likely':      'like-likely',
        'Possible':    'like-possible',
        'Unlikely':    'like-unlikely'
    };

    const cardsHtml = clauses.map((clause, i) => {
        const sev      = sevConfig[clause.severity] || sevConfig.Moderate;
        const sevLabel = t(sev.tKey);
        const likeLabel = t(likeKeys[clause.likelihood] || 'like-possible');

        const ragTag = clause.rag_grounded
            ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold" style="background:#e8f5e9;color:#2e7d32;">${t('risk-rag-grounded')}</span>`
            : `<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold" style="background:#f5f5f5;color:#757575;">${t('risk-rag-general')}</span>`;

        const downgradedTag = clause.downgraded
            ? `<span class="downgraded-label block mt-1">${t('risk-downgraded')}</span>`
            : '';

        const steps = (clause.what_to_do || '')
            .split(/\n|(?<=\.)\s*(?=\d+[-.)]|[أ-ي]-)/u)
            .map(s => s.trim()).filter(Boolean);
        const todoHtml = steps.length > 1
            ? `<ol class="list-decimal list-inside space-y-1">${steps.map(s => `<li class="text-sm leading-relaxed text-slate-700 dark:text-slate-200">${s}</li>`).join('')}</ol>`
            : `<p class="text-sm leading-relaxed text-slate-700 dark:text-slate-200">${clause.what_to_do || ''}</p>`;

        // Border color is set via CSS custom property so CSS can flip left↔right for RTL
        return `
        <div class="risk-clause-card bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
             data-severity="${clause.severity.toLowerCase()}"
             style="--sev-color: ${sev.color};">

            <div class="flex items-start justify-between gap-3 p-5 pb-3">
                <h3 class="text-base font-extrabold text-navy dark:text-white leading-snug flex-1" style="font-size:15px;">${clause.clause_title || `${t('risk-clause-fallback')} ${i + 1}`}</h3>
                <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="badge-${clause.severity.toLowerCase()} px-3 py-1 rounded-full text-xs font-bold">${sevLabel}</span>
                    <span class="text-xs text-slate-500 dark:text-slate-400">${likeLabel}</span>
                </div>
            </div>

            <div class="risk-section-box mx-5 mb-3" style="background:#f0f4ff;">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">${t('risk-what-means')}</div>
                <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-200">${clause.what_it_means || ''}</p>
            </div>

            <div class="risk-section-box mx-5 mb-3" style="background:#fff4f0;">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">${t('risk-what-risk')}</div>
                <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-200">${clause.why_its_risky || ''}</p>
            </div>

            <div class="risk-section-box mx-5 mb-3" style="background:#f0fff4;">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">${t('risk-what-do')}</div>
                ${todoHtml}
            </div>

            <div class="flex items-start justify-between gap-3 px-5 pb-5 pt-1">
                <div class="flex-1">
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        <span class="font-bold">${t('risk-law-ref')}</span> ${clause.law_reference || ''}
                    </p>
                    ${downgradedTag}
                </div>
                ${ragTag}
            </div>
        </div>`;
    }).join('');

    wrapper.innerHTML = `
        <div class="flex items-center gap-3 mb-4 px-1">
            <div class="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-500">
                <span class="material-icons-round text-xl">gavel</span>
            </div>
            <h2 class="text-lg font-bold text-navy dark:text-white">${t('risk-section-title')}</h2>
        </div>
        <div class="space-y-5">${cardsHtml}</div>`;

    return wrapper;
}

function createLegalReferencesCard() {
    const card = document.createElement('div');
    card.className = 'result-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow';
    const refs = analysisData.legalReferences.slice(0, 10);
    card.innerHTML = `
        <div class="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-700 pb-5">
            <div class="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-primary">
                <span class="material-icons-round text-2xl">balance</span>
            </div>
            <h2 class="text-xl font-bold text-navy dark:text-white">${t('legal-ref-title')}</h2>
        </div>
        <div class="space-y-4 max-h-[36rem] overflow-y-auto pr-2">
            ${refs.map(ref => {
                const isCompliant = ref.compliance === 'COMPLIANT';
                const badgeLabel  = isCompliant ? t('legal-ref-compliant') : t('legal-ref-review');
                const badgeClass  = isCompliant
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                return `
                <div class="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <h4 class="font-bold text-base text-navy dark:text-white leading-snug">${ref.law}</h4>
                        <span class="shrink-0 text-xs px-3 py-1 rounded-full font-semibold ${badgeClass}">${badgeLabel}</span>
                    </div>
                    ${ref.clauseDescription ? `<p class="text-sm text-primary font-semibold mb-2">📌 ${ref.clauseDescription}</p>` : ''}
                    ${ref.articleText ? `<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${ref.articleText}</p>` : ''}
                    <p class="text-xs text-slate-400 font-medium">${t('legal-ref-match')} ${ref.relevance}</p>
                </div>`;
            }).join('')}
        </div>`;
    return card;
}

function createEntitiesCard() {
    const card = document.createElement('div');
    card.className = 'result-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow';
    const entities = analysisData.entities;
    const section = (tKey, bgClass, textClass, items) => {
        if (!items || !items.length) return '';
        const chips = items.slice(0, 5).map(v =>
            `<span class="px-4 py-1.5 bg-white dark:bg-slate-900/30 ${textClass} rounded-full text-sm font-medium border">${v}</span>`
        ).join('');
        return `<div class="p-4 ${bgClass} rounded-xl">
            <h4 class="font-bold text-sm mb-3 uppercase tracking-wide">${t(tKey)}</h4>
            <div class="flex flex-wrap gap-2">${chips}</div>
        </div>`;
    };
    card.innerHTML = `
        <div class="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-700 pb-5">
            <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-500">
                <span class="material-icons-round text-2xl">business</span>
            </div>
            <h2 class="text-xl font-bold text-navy dark:text-white">${t('entities-title')}</h2>
        </div>
        <div class="space-y-5">
            ${section('entities-parties', 'bg-blue-50 dark:bg-blue-900/15',   'text-blue-700 dark:text-blue-300',   entities.persons)}
            ${section('entities-orgs',    'bg-purple-50 dark:bg-purple-900/15','text-purple-700 dark:text-purple-300',entities.organizations)}
            ${section('entities-dates',   'bg-amber-50 dark:bg-amber-900/15',  'text-amber-700 dark:text-amber-300', entities.dates)}
            ${section('entities-money',   'bg-green-50 dark:bg-green-900/15',  'text-green-700 dark:text-green-300', entities.money)}
        </div>`;
    return card;
}

function createClausesCard() {
    const card = document.createElement('div');
    card.className = 'result-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow';
    const clauses = analysisData.clauses.slice(0, 8);
    card.innerHTML = `
        <div class="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-700 pb-5">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-500">
                <span class="material-icons-round text-2xl">find_in_page</span>
            </div>
            <h2 class="text-xl font-bold text-navy dark:text-white">${t('clauses-title')}</h2>
        </div>
        <div class="space-y-4 max-h-[36rem] overflow-y-auto pr-2">
            ${clauses.map(clause => {
                const text = clause.text || '';
                return `
                <div class="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div class="flex items-center gap-2 mb-2">
                        ${clause.number ? `<span class="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-md">${t('clause-number-prefix')} ${clause.number}</span>` : ''}
                        <h4 class="font-bold text-base text-navy dark:text-white">${clause.description || ''}</h4>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">${text.substring(0, 180)}${text.length > 180 ? '…' : ''}</p>
                    ${clause.explanation ? `
                        <div class="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <span class="material-icons-round text-sm text-indigo-500 mt-0.5 shrink-0">lightbulb</span>
                            <p class="text-sm text-indigo-700 dark:text-indigo-300">${clause.explanation}</p>
                        </div>` : ''}
                </div>`;
            }).join('')}
        </div>`;
    return card;
}

function createLegalTermsCard() {
    const card = document.createElement('div');
    card.className = 'result-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow lg:col-span-2';
    const terms = analysisData.legalTerms;
    card.innerHTML = `
        <div class="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-700 pb-5">
            <div class="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
                <span class="material-icons-round text-2xl">menu_book</span>
            </div>
            <h2 class="text-xl font-bold text-navy dark:text-white">${t('terms-title')}</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            ${terms.map(term => `
                <div class="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <h4 class="text-base font-bold text-navy dark:text-white mb-2">${escapeHtml(term.term)}</h4>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">${escapeHtml(term.explanation)}</p>
                    ${term.example ? `
                        <div class="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <span class="material-icons-round text-sm text-amber-500 mt-0.5 shrink-0">format_quote</span>
                            <p class="text-sm text-amber-700 dark:text-amber-300 italic">${term.example}</p>
                        </div>` : ''}
                </div>`).join('')}
        </div>`;
    return card;
}

// ==================================================================
// Q&A FUNCTIONALITY
// ==================================================================
function openQAModal() {
    document.getElementById('qaModal').classList.remove('hidden');
    document.getElementById('questionInput').focus();
}

function closeQAModal() {
    document.getElementById('qaModal').classList.add('hidden');
    document.getElementById('qaResponse').classList.add('hidden');
}

function askQuestion(question) {
    document.getElementById('questionInput').value = question;
    askCustomQuestion();
}

async function askCustomQuestion() {
    const question = document.getElementById('questionInput').value.trim();
    if (!question) return;

    const responseDiv   = document.getElementById('qaResponse');
    const loadingDiv    = document.getElementById('qaLoading');
    const answerText    = document.getElementById('qaAnswerText');
    const confidenceEl  = document.getElementById('qaConfidence');

    responseDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden');

    try {
        const response = await fetch(getAPIURL() + '/analyze/qa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ question, context: analysisData })
        });
        if (!response.ok) throw new Error('Failed to get answer');
        const answer = await response.json();

        answerText.textContent   = answer.answer;
        confidenceEl.textContent = `${t('qa-confidence')} ${Math.round(answer.confidence * 100)}%`;
    } catch (error) {
        console.error('Q&A error:', error);
        answerText.textContent  = t('qa-error');
        confidenceEl.textContent = '';
    } finally {
        loadingDiv.classList.add('hidden');
        responseDiv.classList.remove('hidden');
    }
}

function getAPIURL() { return `${window.location.origin}/api`; }
function getAuthHeaders() {
    const token = sessionStorage.getItem('lawgic_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ==================================================================
// DOWNLOAD REPORT
// ==================================================================
function downloadReport() {
    const lang = getLang();
    let report = lang === 'ar'
        ? `تقرير التحليل القانوني — LawGic\n`
        : `LAWGIC LEGAL ANALYSIS REPORT\n`;
    report += `${'='.repeat(80)}\n\n`;
    report += `${lang === 'ar' ? 'تاريخ الإنشاء' : 'Generated'}: ${new Date().toLocaleString()}\n`;
    report += `${lang === 'ar' ? 'المستند' : 'Document'}: ${analysisData.documentName}\n`;
    report += `${lang === 'ar' ? 'نوع العقد' : 'Contract Type'}: ${analysisData.contractType}\n`;
    report += `${lang === 'ar' ? 'استخدام OCR' : 'OCR Used'}: ${analysisData.ocrUsed ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}\n`;
    report += `${'='.repeat(80)}\n\n`;

    if (analysisOptions.summarization && analysisData.summary) {
        report += `${lang === 'ar' ? 'الملخص' : 'SUMMARY'}\n${'-'.repeat(80)}\n`;
        report += `${analysisData.summary.overviewEnglish || analysisData.summary.overview}\n\n`;
        if (analysisData.summary.keyPoints) {
            analysisData.summary.keyPoints.forEach(p => { report += `  • ${p}\n`; });
        }
        report += '\n';
    }

    if (analysisOptions.riskDetection && analysisData.risks) {
        const bd = analysisData.risks.breakdown || {};
        report += `${lang === 'ar' ? 'تحليل المخاطر (ISO 31000)' : 'RISK ANALYSIS (ISO 31000)'}\n${'-'.repeat(80)}\n`;
        report += `${lang === 'ar' ? 'الإجمالي' : 'Overall'}: ${analysisData.risks.overall || 'N/A'} (${analysisData.risks.riskPercentage ?? 0}/100)\n`;
        report += `Critical: ${bd.critical||0}  High: ${bd.high||0}  Moderate: ${bd.moderate||0}  Low: ${bd.low||0}\n\n`;
        (analysisData.risks.clauses || []).slice(0, 10).forEach((c, i) => {
            report += `${i + 1}. ${c.clause_title} [${c.severity} / ${c.likelihood}]\n`;
            report += `   ${lang === 'ar' ? 'المعنى' : 'Meaning'}: ${c.what_it_means}\n`;
            report += `   ${lang === 'ar' ? 'الخطر'  : 'Risk'}:    ${c.why_its_risky}\n`;
            report += `   ${lang === 'ar' ? 'الإجراء': 'Action'}:  ${c.what_to_do}\n`;
            report += `   ${lang === 'ar' ? 'المرجع' : 'Reference'}:${c.law_reference}\n\n`;
        });
    }

    const blob = new Blob([report], { type: 'text/plain; charset=utf-8' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${analysisData.documentName.replace(/\.[^/.]+$/, '')}_analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
