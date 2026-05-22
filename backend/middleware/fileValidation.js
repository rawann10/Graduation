// backend/middleware/fileValidation.js
// Validates uploaded files by MIME type (from multer) AND magic bytes (from file buffer).
// Run AFTER multer saves the file to disk, BEFORE any processing.

const fs = require('fs');
const FileType = require('file-type');

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp'
]);

// DOCX is a ZIP archive — file-type detects it as application/zip
const ZIP_DOCX_MIME = 'application/zip';

function cleanupFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
}

async function validateUploadedFile(req, res, next) {
    if (!req.file) return next();

    const { path: filePath, mimetype } = req.file;

    // Layer 1: check declared MIME type
    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
        cleanupFile(filePath);
        return res.status(422).json({
            error: 'نوع الملف غير مدعوم. يُسمح فقط بـ PDF وWord وJPEG وPNG وTIFF وWebP.'
        });
    }

    // Layer 2: verify magic bytes match declared type
    try {
        const buffer = fs.readFileSync(filePath);
        const detected = await FileType.fromBuffer(buffer);
        const detectedMime = detected ? detected.mime : null;

        const isDocx = mimetype.includes('wordprocessingml');
        const isPdf = mimetype === 'application/pdf';

        // DOCX: magic bytes show ZIP (PK header) — accept that
        // PDF: text-based PDFs start with '%PDF' but file-type may not always detect them
        const magicOk =
            (detectedMime && ALLOWED_MIME_TYPES.has(detectedMime)) ||
            (isDocx && detectedMime === ZIP_DOCX_MIME) ||
            (isPdf && !detectedMime); // text-based PDF fallback

        if (!magicOk) {
            cleanupFile(filePath);
            return res.status(422).json({
                error: 'محتوى الملف لا يتطابق مع امتداده. يرجى التحقق من الملف المرفوع.'
            });
        }

        next();
    } catch (err) {
        cleanupFile(filePath);
        console.error('File validation error:', err.message);
        return res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الملف.' });
    }
}

module.exports = { validateUploadedFile };
