// API — same origin as this page (Express serves frontend + API)
function getAPIURL() {
    return `${window.location.origin}/api`;
}

// Escape HTML special characters before inserting dynamic content via innerHTML
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAuthHeaders() {
    const token = sessionStorage.getItem('lawgic_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const API_URL = getAPIURL();
let selectedFile = null;

console.log('🌐 Using API URL:', API_URL);

// ==================================================================
// LANGUAGE TRANSLATIONS
// ==================================================================
const translations = {
    en: {
        'nav-features': 'Features',
        'nav-how': 'How It Works',
        'nav-sample': 'View Sample',
        'hero-title': 'Analyze Legal Contracts with Specialized Egyptian AI',
        'hero-subtitle': 'Upload your Sports or Commercial contracts and get instant insights on risky clauses, legal references, and comprehensive risk scoring based on local laws.',
        'hero-cta': 'Get Started Free',
        'step1-title': '1. Select Contract Type',
        'step2-title': '2. Upload Document',
        'step3-title': '3. Select Analysis Features',
        'step3-subtitle': 'Choose which insights you want to see in results',
        'type-sport': 'Sports Contract',
        'type-sport-desc': 'Player contracts & coaching agreements',
        'type-investment': 'Commercial Contract',
        'type-investment-desc': 'Commercial transactions & corporate governance',
        'selected': 'Selected',
        'upload-title': 'Drop your contract here',
        'upload-subtitle': 'or click to browse files',
        'opt-summary': 'Contract Summary',
        'opt-summary-desc': 'Key points & obligations',
        'opt-risk': 'Risk Scoring',
        'opt-risk-desc': 'Identify risky clauses',
        'opt-legal': 'Legal References',
        'opt-legal-desc': 'Law article mapping',
        'opt-entity': 'Named Entities',
        'opt-entity-desc': 'Parties, Dates, Locations',
        'opt-clause': 'Clause Detection',
        'opt-clause-desc': 'Breakdown by clause',
        'opt-terms': 'Legal Terms',
        'opt-terms-desc': 'Simplified explanations',
        'analysis-note': 'All features are always analyzed by AI. Unchecked items won\'t appear in results but data is available for download.',
        'analyze-btn': 'Analyze Contract',
        'features-title': 'Powerful AI Features',
        'feature1-title': 'OCR Technology',
        'feature1-desc': 'Scan physical contracts with your phone',
        'feature2-title': 'Risk Scoring',
        'feature2-desc': '0-100 risk scores with ML algorithm',
        'feature3-title': 'Fast Processing',
        'feature3-desc': 'Results in 5-40 seconds',
        'feature4-title': 'Egyptian Laws',
        'feature4-desc': 'Sports and commercial laws',
        'how-title': 'How It Works',
        'how1-title': 'Select Type',
        'how1-desc': 'Choose contract category',
        'how2-title': 'Upload Document',
        'how2-desc': 'PDF, Word, Text, or Image',
        'how3-title': 'AI Analysis',
        'how3-desc': 'OCR, AI Risk Detection',
        'how4-title': 'Get Results',
        'how4-desc': 'Download & Ask Questions',
        'footer-text': '© 2025 LawGic. AI-powered contract analysis.',
        'loading-title': 'Analyzing Your Contract...',
        'loading-status': 'Processing document...'
    },
    ar: {
        'nav-features': 'المميزات',
        'nav-how': 'كيف يعمل',
        'nav-sample': 'عرض نموذج',
        'hero-title': 'حلل العقود القانونية بالذكاء الاصطناعي المصري المتخصص',
        'hero-subtitle': 'ارفع عقود الرياضة أو العقود التجارية واحصل على رؤى فورية حول البنود الخطرة والمراجع القانونية وتسجيل المخاطر الشامل بناءً على القوانين المحلية.',
        'hero-cta': 'ابدأ مجاناً',
        'step1-title': '١. اختر نوع العقد',
        'step2-title': '٢. ارفع المستند',
        'step3-title': '٣. اختر ميزات التحليل',
        'step3-subtitle': 'اختر الرؤى التي تريد رؤيتها في النتائج',
        'type-sport': 'عقد رياضي',
        'type-sport-desc': 'عقود اللاعبين واتفاقيات التدريب',
        'type-investment': 'عقد تجاري',
        'type-investment-desc': 'المعاملات التجارية وحوكمة الشركات',
        'selected': 'محدد',
        'upload-title': 'اسحب عقدك هنا',
        'upload-subtitle': 'أو انقر للتصفح',
        'opt-summary': 'ملخص العقد',
        'opt-summary-desc': 'النقاط الرئيسية والالتزامات',
        'opt-risk': 'تسجيل المخاطر',
        'opt-risk-desc': 'تحديد البنود الخطرة',
        'opt-legal': 'المراجع القانونية',
        'opt-legal-desc': 'ربط مواد القانون',
        'opt-entity': 'الكيانات المحددة',
        'opt-entity-desc': 'الأطراف، التواريخ، المواقع',
        'opt-clause': 'كشف البنود',
        'opt-clause-desc': 'تفصيل حسب البند',
        'opt-terms': 'المصطلحات القانونية',
        'opt-terms-desc': 'تفسيرات مبسطة',
        'analysis-note': 'يتم تحليل جميع الميزات دائمًا بواسطة الذكاء الاصطناعي. العناصر غير المحددة لن تظهر في النتائج ولكن البيانات متاحة للتنزيل.',
        'analyze-btn': 'تحليل العقد',
        'features-title': 'مميزات الذكاء الاصطناعي القوية',
        'feature1-title': 'تقنية OCR',
        'feature1-desc': 'مسح العقود الورقية بهاتفك',
        'feature2-title': 'تسجيل المخاطر',
        'feature2-desc': 'درجات مخاطر 0-100 بخوارزمية ML',
        'feature3-title': 'معالجة سريعة',
        'feature3-desc': 'النتائج في 5-40 ثانية',
        'feature4-title': 'القوانين المصرية',
        'feature4-desc': 'قوانين الرياضة والعمل والاستثمار',
        'how-title': 'كيف يعمل',
        'how1-title': 'اختر النوع',
        'how1-desc': 'اختر فئة العقد',
        'how2-title': 'ارفع المستند',
        'how2-desc': 'PDF أو Word أو نص أو صورة',
        'how3-title': 'التحليل بالذكاء الاصطناعي',
        'how3-desc': 'OCR، كشف المخاطر بالذكاء الاصطناعي',
        'how4-title': 'احصل على النتائج',
        'how4-desc': 'تنزيل وطرح الأسئلة',
        'footer-text': '© 2025 LawGic. تحليل العقود بالذكاء الاصطناعي.',
        'loading-title': 'جاري تحليل عقدك...',
        'loading-status': 'جاري معالجة المستند...'
    }
};

// ==================================================================
// LANGUAGE TOGGLE
// ==================================================================
function toggleLanguage() {
    const html = document.documentElement;
    const currentLang = html.getAttribute('data-lang') || 'en';
    const newLang = currentLang === 'en' ? 'ar' : 'en';
    
    html.setAttribute('data-lang', newLang);
    html.setAttribute('lang', newLang);
    localStorage.setItem('language', newLang);
    
    // Update all translatable elements
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[newLang] && translations[newLang][key]) {
            element.textContent = translations[newLang][key];
        }
    });
    
    console.log('🌐 Language changed to:', newLang);
}

// Load saved language on page load
function loadLanguage() {
    const savedLang = localStorage.getItem('language') || 'en';
    if (savedLang !== 'en') {
        document.documentElement.setAttribute('data-lang', savedLang);
        document.documentElement.setAttribute('lang', savedLang);
        
        // Apply translations
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            if (translations[savedLang] && translations[savedLang][key]) {
                element.textContent = translations[savedLang][key];
            }
        });
    }
}

// ==================================================================
// THEME TOGGLE
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

// ==================================================================
// FILE HANDLING
// ==================================================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/jpg'
    ];
    
    if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF, Word, Text, or Image document');
        return;
    }
    
    selectedFile = file;
    displayFilePreview(file);
    document.getElementById('analyzeBtn').disabled = false;
}

function displayFilePreview(file) {
    const preview = document.getElementById('filePreview');
    const uploadArea = document.getElementById('uploadArea');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    uploadArea.style.display = 'none';
    preview.classList.remove('hidden');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
}

function removeFile() {
    selectedFile = null;
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('fileInput').value = '';
    document.getElementById('analyzeBtn').disabled = true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ==================================================================
// ANALYSIS
// ==================================================================
async function analyzeContract() {
    if (!selectedFile) return;
    
    // Get selected contract type
    const contractTypeRadio = document.querySelector('input[name="contractType"]:checked');
    const contractType = contractTypeRadio ? contractTypeRadio.value : 'sport';
    
    // Get selected options
    const options = {
        summarization: document.getElementById('opt-summary').checked,
        riskDetection: document.getElementById('opt-risk').checked,
        legalReferences: document.getElementById('opt-legal').checked,
        entityRecognition: document.getElementById('opt-entity').checked,
        clauseDetection: document.getElementById('opt-clause').checked,
        termExplanations: document.getElementById('opt-terms').checked
    };
    
    showLoading();
    
    try {
        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('contractType', contractType);
        formData.append('options', JSON.stringify(options));
        
        console.log('📤 Sending request to:', `${API_URL}/analyze`);
        console.log('📑 Contract type:', contractType);
        console.log('📋 Options:', options);
        
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Analysis complete:', result);
        
        hideLoading();
        
        // Store a safe, smaller payload for results page rendering.
        // Large nested objects can exceed sessionStorage limits in some browsers.
        if (result && result._fullAnalysis) {
            delete result._fullAnalysis;
        }
        sessionStorage.setItem('analysisResult', JSON.stringify(result));
        sessionStorage.setItem('analysisOptions', JSON.stringify(options));
        window.location.href = 'results.html';
        
    } catch (error) {
        hideLoading();
        console.error('❌ Analysis error:', error);
        
        let errorMessage = 'Error analyzing document.';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = '⚠️ Cannot connect to server!\n\nMake sure backend is running:\ncd backend\nnpm start';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
        
        alert(errorMessage);
    }
}

// ==================================================================
// LOADING UI
// ==================================================================
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('hidden');
    
    const statuses = [
        'Processing document...',
        'Extracting text with OCR...',
        'Running AI analysis...',
        'Analyzing against legal database...',
        'Calculating risk scores...',
        'Detecting clauses...',
        'Extracting entities...',
        'Generating summary...',
        'Cross-referencing laws...',
        'Finalizing results...'
    ];
    
    let index = 0;
    const statusInterval = setInterval(() => {
        index = (index + 1) % statuses.length;
        const statusEl = document.getElementById('loadingStatus');
        if (statusEl) {
            statusEl.textContent = statuses[index];
        }
    }, 3000);
    
    overlay.dataset.intervalId = statusInterval;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    const intervalId = overlay.dataset.intervalId;
    if (intervalId) {
        clearInterval(parseInt(intervalId));
    }
    overlay.classList.add('hidden');
}

// ==================================================================
// SAMPLE ANALYSIS
// ==================================================================
function showSampleAnalysis() {
    const sampleResult = {
        documentName: 'Sample_Sports_Contract.pdf',
        contractType: 'sport',
        extractionConfidence: 'high',
        ocrUsed: false,
        summary: {
            overview: 'تم تحليل العقد ضد 9 مواد قانونية من قانون الرياضة',
            overviewEnglish: 'Contract analyzed against 9 articles from Sports Law 171/2025',
            contractType: 'sport',
            wordCount: 450,
            totalMatches: 9,
            keyPoints: [
                'العقد يحتوي على 450 كلمة',
                'تم العثور على 9 مطابقات مع القوانين',
                '1 قضية عالية الخطورة تتطلب مراجعة فورية',
                '3 قضايا متوسطة الخطورة يُنصح بمراجعتها'
            ],
            statistics: {
                wordCount: 450,
                clauseCount: 9,
                highRiskCount: 1,
                mediumRiskCount: 3,
                entityCount: 12
            }
        },
        risks: {
            ranked: [
                {
                    type: 'termination',
                    description: 'شرط إنهاء العقد',
                    text: 'يحق للنادي إنهاء العقد في أي وقت دون تعويض',
                    riskScore: 85,
                    priority: 'HIGH',
                    riskLevel: 'HIGH',
                    recommendation: '⚠️ خطر عالي: يُنصح بمراجعة قانونية فورية لهذا البند'
                }
            ],
            breakdown: {
                high: 1,
                moderate: 3,
                low: 5
            }
        },
        entities: {
            persons: ['نادي الزمالك', 'اللاعب محمد أحمد'],
            organizations: ['نادي الزمالك', 'اتحاد الكرة المصري'],
            locations: ['القاهرة', 'مصر'],
            dates: ['2025/01/15', '2 سنوات'],
            money: ['500,000 جنيه'],
            laws: []
        },
        legalReferences: [
            {
                law: 'Sports Law 171/2025 - Article 15',
                relevance: '68.5%',
                compliance: 'NEEDS REVIEW',
                riskLevel: 'HIGH'
            }
        ],
        clauses: [
            {
                type: 'duration',
                description: 'مدة العقد',
                text: 'مدة العقد سنتان قابلة للتجديد',
                riskLevel: 'LOW'
            }
        ],
        legalTerms: [
            { term: 'الطرف الأول', explanation: 'الجهة أو الشخص الأول الموقع على العقد' },
            { term: 'فسخ العقد', explanation: 'إنهاء العقد قبل انتهاء مدته' }
        ],
        timestamp: new Date().toISOString()
    };
    
    // Set all options as checked for sample
    const allOptions = {
        summarization: true,
        riskDetection: true,
        legalReferences: true,
        entityRecognition: true,
        clauseDetection: true,
        termExplanations: true
    };
    
    sessionStorage.setItem('analysisResult', JSON.stringify(sampleResult));
    sessionStorage.setItem('analysisOptions', JSON.stringify(allOptions));
    window.location.href = 'results.html';
}

// ==================================================================
// INITIALIZATION
// ==================================================================
function logout() {
    sessionStorage.removeItem('lawgic_token');
    sessionStorage.removeItem('lawgic_user');
    window.location.href = '/';
}

function getUserDisplayName(user) {
    if (!user) return 'User';
    if (user.fullName && String(user.fullName).trim()) return String(user.fullName).trim();
    const email = user.email || '';
    const local = email.split('@')[0];
    return local || 'User';
}

function getUserInitial(user) {
    const n = getUserDisplayName(user);
    const ch = n.trim().charAt(0);
    return ch ? ch.toUpperCase() : '?';
}

function applyUserChrome(user) {
    if (!user) return;
    const name = getUserDisplayName(user);
    const initial = getUserInitial(user);
    const email = user.email || '';

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setText('desktopUserName', name);
    setText('userEmailLabel', email);
    const emailLabel = document.getElementById('userEmailLabel');
    if (emailLabel) emailLabel.title = email;

    setText('mobileBarName', name);
    setText('mobileMenuDisplayName', name);
    setText('mobileMenuEmail', email);

    ['desktopUserAvatar', 'mobileBarAvatar', 'mobileMenuAvatar'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = initial;
    });

    const isAdmin = user.role === 'admin';
    const mobileRoleLine = document.getElementById('mobileMenuRoleLine');
    if (mobileRoleLine) mobileRoleLine.classList.toggle('hidden', !isAdmin);
    const desktopRoleBadge = document.getElementById('desktopRoleBadge');
    if (desktopRoleBadge) desktopRoleBadge.classList.toggle('hidden', !isAdmin);
    const adminNavLink = document.getElementById('adminNavLink');
    if (adminNavLink) {
        adminNavLink.classList.toggle('hidden', !isAdmin);
        adminNavLink.classList.toggle('md:inline-flex', isAdmin);
    }
    const adminMobileLink = document.getElementById('adminMobileLink');
    if (adminMobileLink) {
        adminMobileLink.classList.toggle('hidden', !isAdmin);
        adminMobileLink.classList.toggle('flex', isAdmin);
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const btn = document.getElementById('mobileMenuBtn');
    const icon = document.getElementById('mobileMenuIcon');
    if (!menu || !btn) return;
    menu.classList.toggle('hidden');
    const isOpen = !menu.classList.contains('hidden');
    btn.setAttribute('aria-expanded', String(isOpen));
    if (icon) icon.textContent = isOpen ? 'close' : 'menu';
}

function closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const btn = document.getElementById('mobileMenuBtn');
    const icon = document.getElementById('mobileMenuIcon');
    if (menu) menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (icon) icon.textContent = 'menu';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('lawgic_token')) {
        window.location.href = '/';
        return;
    }

    try {
        const cached = JSON.parse(sessionStorage.getItem('lawgic_user') || 'null');
        if (cached) applyUserChrome(cached);
    } catch (e) { /* ignore */ }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileMenu();
    });

    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('session');
        const data = await res.json();
        if (data.user) {
            sessionStorage.setItem('lawgic_user', JSON.stringify(data.user));
            applyUserChrome(data.user);
        }
        if (data.token) {
            sessionStorage.setItem('lawgic_token', data.token);
        }
        if (data.user && data.user.defaultOptions) {
            const o = data.user.defaultOptions;
            const map = [
                ['opt-summary', 'summarization'],
                ['opt-risk', 'riskDetection'],
                ['opt-legal', 'legalReferences'],
                ['opt-entity', 'entityRecognition'],
                ['opt-clause', 'clauseDetection'],
                ['opt-terms', 'termExplanations']
            ];
            map.forEach(([id, key]) => {
                const el = document.getElementById(id);
                if (el && typeof o[key] === 'boolean') el.checked = o[key];
            });
        }
    } catch (e) {
        sessionStorage.removeItem('lawgic_token');
        sessionStorage.removeItem('lawgic_user');
        window.location.href = '/';
        return;
    }

    loadTheme();
    loadLanguage();
    console.log('✅ LawGic Frontend Initialized');
});

// ─── MY CONTRACTS PANEL ────────────────────────────────────────────────────

let _currentReRunDoc = null;

function openMyContracts() {
    const overlay = document.getElementById('myContractsOverlay');
    const panel = document.getElementById('myContractsPanel');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => panel.classList.remove('translate-x-full'));
    loadMyContracts();
}

function closeMyContracts() {
    const overlay = document.getElementById('myContractsOverlay');
    const panel = document.getElementById('myContractsPanel');
    panel.classList.add('translate-x-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

async function loadMyContracts() {
    const loading = document.getElementById('contractsLoading');
    const empty = document.getElementById('contractsEmpty');
    const list = document.getElementById('contractsList');
    const count = document.getElementById('contractsCount');

    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    list.classList.add('hidden');
    list.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/analyze/my-contracts`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed');
        const contracts = await res.json();

        loading.classList.add('hidden');
        count.textContent = contracts.length;

        if (!contracts.length) {
            empty.classList.remove('hidden');
            return;
        }

        list.classList.remove('hidden');
        list.innerHTML = contracts.map(doc => {
            const date = new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const typeLabel = doc.contractType === 'sport' ? '⚽ Sports' : doc.contractType === 'commercial' ? '💼 Commercial' : '📄 Unknown';
            const statusColor = doc.status === 'analyzed' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                : doc.status === 'error' ? 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
                : 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400';
            const canView = doc.status === 'analyzed';
            const safeFilename = escapeHtml(doc.filename);
            return `
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-shadow" id="contract-card-${doc.id}">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <span class="material-icons-round text-xl">description</span>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-navy dark:text-white text-sm truncate" title="${safeFilename}">${safeFilename}</p>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-xs text-slate-500">${date}</span>
                            <span class="text-xs font-medium text-slate-500">${typeLabel}</span>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}">${doc.status}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="viewContractAnalysis(${doc.id})" ${canView ? '' : 'disabled'} 
                        class="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all
                        ${canView ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-700'}">
                        <span class="material-icons-round text-sm">visibility</span>
                        View Analysis
                    </button>
                    <button onclick="deleteMyContract(${doc.id})"
                        class="flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all dark:bg-red-900/20 dark:text-red-400">
                        <span class="material-icons-round text-sm">delete</span>
                        Delete
                    </button>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        loading.classList.add('hidden');
        list.classList.remove('hidden');
        list.innerHTML = `<div class="text-center py-8 text-red-500 text-sm">Failed to load contracts. Please try again.</div>`;
    }
}

async function deleteMyContract(docId) {
    if (!confirm('Delete this contract and its analysis? This cannot be undone.')) return;
    try {
        const res = await fetch(`${API_URL}/analyze/my-contracts/${docId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed');
        const card = document.getElementById(`contract-card-${docId}`);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            card.style.transition = 'all 0.2s ease';
            setTimeout(() => { card.remove(); loadMyContracts(); }, 220);
        }
    } catch (e) {
        alert('Could not delete contract. Please try again.');
    }
}

async function viewContractAnalysis(docId) {
    const modal = document.getElementById('viewAnalysisModal');
    const content = document.getElementById('modalContent');
    const docName = document.getElementById('modalDocName');
    const docMeta = document.getElementById('modalDocMeta');

    content.innerHTML = `<div class="flex items-center justify-center py-12"><div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${API_URL}/analyze/my-contracts/${docId}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Not found');
        const doc = await res.json();
        const analysis = doc.analysisResult;

        docName.textContent = doc.filename;
        const date = new Date(doc.uploadedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
        const typeLabel = doc.contractType === 'sport' ? '⚽ Sports' : '💼 Commercial';
        docMeta.textContent = `${typeLabel} · Analyzed ${date}`;

        _currentReRunDoc = { filename: doc.filename, contractType: doc.contractType };

        if (!analysis) {
            content.innerHTML = `<p class="text-slate-500 text-center py-8">No analysis data available.</p>`;
            return;
        }

        // Build summary section
        let html = '';

        // Summary
        if (analysis.summary) {
            const s = analysis.summary;
            html += `<div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <h4 class="font-bold text-navy dark:text-white mb-2 flex items-center gap-2">
                    <span class="material-icons-round text-primary text-base">summarize</span>Summary
                </h4>
                <p class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">${escapeHtml(s.overview || s.overviewEnglish || 'N/A')}</p>
                ${s.keyPoints && s.keyPoints.length ? `<ul class="mt-2 space-y-1">${s.keyPoints.map(p => `<li class="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5"><span class="text-primary mt-0.5">•</span>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
            </div>`;
        }

        // Risk breakdown
        if (analysis.risks) {
            const rb = analysis.risks.breakdown || {};
            html += `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <h4 class="font-bold text-navy dark:text-white mb-3 flex items-center gap-2">
                    <span class="material-icons-round text-red-500 text-base">warning</span>Risk Breakdown
                </h4>
                <div class="grid grid-cols-3 gap-3 mb-3">
                    <div class="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div class="text-xl font-bold text-red-600">${rb.high || 0}</div>
                        <div class="text-xs text-red-500 font-medium">High</div>
                    </div>
                    <div class="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <div class="text-xl font-bold text-amber-600">${rb.moderate || 0}</div>
                        <div class="text-xs text-amber-500 font-medium">Moderate</div>
                    </div>
                    <div class="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div class="text-xl font-bold text-green-600">${rb.low || 0}</div>
                        <div class="text-xs text-green-500 font-medium">Low</div>
                    </div>
                </div>
                ${(analysis.risks.topRisks || []).slice(0, 3).map(r => `
                    <div class="border-l-2 border-red-400 pl-3 py-1 mb-2">
                        <p class="font-semibold text-navy dark:text-white text-xs">${escapeHtml(r.description || r.type || '')}</p>
                        <p class="text-xs text-slate-500 mt-0.5">${escapeHtml((r.text || '').substring(0, 100))}${(r.text || '').length > 100 ? '…' : ''}</p>
                    </div>`).join('')}
            </div>`;
        }

        // Entities
        if (analysis.entities) {
            const e = analysis.entities;
            const parts = [
                e.persons?.length ? `<span class="font-medium">Persons:</span> ${e.persons.slice(0,3).map(escapeHtml).join(', ')}` : '',
                e.organizations?.length ? `<span class="font-medium">Orgs:</span> ${e.organizations.slice(0,3).map(escapeHtml).join(', ')}` : '',
                e.dates?.length ? `<span class="font-medium">Dates:</span> ${e.dates.slice(0,3).map(escapeHtml).join(', ')}` : '',
                e.money?.length ? `<span class="font-medium">Amounts:</span> ${e.money.slice(0,3).map(escapeHtml).join(', ')}` : '',
            ].filter(Boolean);
            if (parts.length) {
                html += `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <h4 class="font-bold text-navy dark:text-white mb-2 flex items-center gap-2">
                        <span class="material-icons-round text-primary text-base">people</span>Named Entities
                    </h4>
                    <div class="space-y-1">${parts.map(p => `<p class="text-xs text-slate-600 dark:text-slate-400">${p}</p>`).join('')}</div>
                </div>`;
            }
        }

        // Legal terms
        if (analysis.legalTerms && analysis.legalTerms.length) {
            html += `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <h4 class="font-bold text-navy dark:text-white mb-2 flex items-center gap-2">
                    <span class="material-icons-round text-primary text-base">book</span>Legal Terms (${analysis.legalTerms.length})
                </h4>
                <div class="flex flex-wrap gap-2">
                    ${analysis.legalTerms.slice(0, 8).map(t => `<span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg font-medium">${escapeHtml(t.term)}</span>`).join('')}
                </div>
            </div>`;
        }

        if (!html) html = `<p class="text-slate-500 text-center py-8 text-sm">Analysis data available but nothing to display.</p>`;
        content.innerHTML = html;

    } catch (e) {
        content.innerHTML = `<p class="text-red-500 text-center py-8 text-sm">Failed to load analysis. Please try again.</p>`;
    }
}

function closeViewModal() {
    document.getElementById('viewAnalysisModal').classList.add('hidden');
    _currentReRunDoc = null;
}

function reRunAnalysis() {
    closeViewModal();
    closeMyContracts();
    // Scroll to upload section
    document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth' });
    if (_currentReRunDoc?.contractType) {
        const radio = document.querySelector(`input[name="contractType"][value="${_currentReRunDoc.contractType}"]`);
        if (radio) radio.checked = true;
    }
}

// Close modal on Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeViewModal();
        closeMyContracts();
    }
});