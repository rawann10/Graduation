const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// ── Startup environment validation ────────────────────────────────────────────
// Refuse to start if any critical secret is missing or too short.

const REQUIRED_ENV = [
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'GROQ_API_KEY',
    'HUGGINGFACE_API_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS'
];

const missingEnv = REQUIRED_ENV.filter(k => !process.env[k] || process.env[k].trim() === '');
if (missingEnv.length > 0) {
    console.error('\n❌  Missing required environment variables:');
    missingEnv.forEach(k => console.error(`    ${k}`));
    console.error('   Add them to backend/.env and restart.\n');
    process.exit(1);
}

if (!process.env.NODE_ENV) {
    console.warn('⚠️  NODE_ENV is not set — defaulting to development behaviour');
}

// Initialize DB schema (SQLite) — must load before routes that depend on it
require('./db/database');

// JWT_SECRET length is enforced inside getJwtSecret() (called by every auth check).
// We call it once at startup so a misconfigured secret exits immediately.
try {
    const { getJwtSecret } = require('./middleware/auth');
    getJwtSecret();
} catch (e) {
    console.error('\n❌  JWT_SECRET is too short — must be at least 32 characters\n');
    process.exit(1);
}

const app = express();

// ── Security headers ───────────────────────────────────────────────────────────
// Frontend loads Tailwind from CDN and fonts from Google — reflected in CSP.
// Inline <script> blocks exist in HTML (tailwind.config) so 'unsafe-inline' is required.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:    ["'self'"],
            scriptSrc:     ["'self'", 'https://cdn.tailwindcss.com', "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick/onsubmit inline handlers in HTML
            styleSrc:      ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
            fontSrc:       ["'self'", 'https://fonts.gstatic.com'],
            connectSrc:    ["'self'"],
            imgSrc:        ["'self'", 'data:'],
            frameSrc:      ["'none'"],
            objectSrc:     ["'none'"],
            baseUri:       ["'self'"],
            upgradeInsecureRequests: null // Disabled — site runs on HTTP in dev
        }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' }
}));

// Permissions-Policy: disable camera, microphone, geolocation (not in helmet@8)
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow same-origin requests (no Origin header) and listed origins
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('CORS policy: origin not allowed'));
    },
    credentials: true // Required for httpOnly refresh cookie
}));

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cookieParser()); // Needed to read httpOnly refresh token cookie
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// ── Routes ─────────────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const adminRoutes   = require('./routes/admin');
const debugRoutes   = require('./routes/debug');
app.use('/api/auth',    authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/debug',   debugRoutes);

// Health check
app.get('/api/health', async (req, res) => {
    let chromaOk    = false;
    let articleCount = 0;

    try {
        const { getCollection } = require('./services/chromaStore');
        const col   = await getCollection({ name: 'lawgic_laws' });
        articleCount = await col.count();
        chromaOk    = articleCount > 0;
    } catch {
        chromaOk = false;
    }

    res.json({
        status:       chromaOk ? 'OK' : 'DEGRADED',
        message:      'LawGic AI-Powered Legal Scanner',
        version:      '3.0-AI',
        vectorDB:     chromaOk ? 'connected' : 'unavailable',
        articleCount,
        llm:          'groq',
        features: [
            'OCR for scanned contracts',
            'Advanced NLP processing',
            'AI-powered summarization',
            'ChromaDB-RAG legal analysis',
            'Risk detection & scoring',
            'Q&A system'
        ],
        timestamp: new Date().toISOString()
    });
});

// Root → welcome / auth landing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Error handling ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ── ChromaDB startup check ────────────────────────────────────────────────────
async function initializeChromaDB() {
    try {
        const { getOrCreateCollection } = require('./services/chromaStore');
        const col   = await getOrCreateCollection({ name: 'lawgic_laws' });
        const count = await col.count();

        if (count === 0) {
            console.warn('⚠️  ChromaDB: empty — law articles not indexed yet.');
            console.warn('   Run:  npm run index-laws');
        } else {
            console.log(`✅ ChromaDB: connected — ${count} law articles ready`);
        }
    } catch (err) {
        console.error('❌ ChromaDB initialization failed:', err.message);
    }
}

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, async () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 LawGic AI-Powered Legal Scanner');
    console.log('='.repeat(80));
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log('='.repeat(80));
    console.log('🛡️  Security: Helmet CSP active, rate limiting active, JWT 2h expiry');

    await initializeChromaDB();

    console.log('💡 Ready for analysis...\n');
});
