const path = require('path');
const multer = require('multer');

const config = require('../config');
const { APIError, ErrorCodes } = require('./errorHandler');

const supportedExtensions = new Set(['.pdf', '.doc', '.docx']);
const supportedMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.cvAnalysis.maximumFileSizeBytes,
        files: 2,
        fields: 1,
        parts: 3
    },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const isSupported = supportedExtensions.has(extension)
            && supportedMimeTypes.has(file.mimetype);

        if (!isSupported) {
            callback(new APIError(
                'Only PDF, DOC, and DOCX documents are supported.',
                400,
                ErrorCodes.INVALID_FILE
            ));
            return;
        }
        callback(null, true);
    }
}).fields([
    { name: 'cv', maxCount: 1 },
    { name: 'cover_letter', maxCount: 1 }
]);

function handleCVAnalysisUpload(req, res, next) {
    upload(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError) {
            const isFileSizeError = error.code === 'LIMIT_FILE_SIZE';
            next(new APIError(
                isFileSizeError
                    ? 'Each document must be 5 MB or smaller.'
                    : 'The document upload is invalid.',
                400,
                isFileSizeError ? ErrorCodes.FILE_TOO_LARGE : ErrorCodes.INVALID_FILE
            ));
            return;
        }
        next(error);
    });
}

module.exports = { handleCVAnalysisUpload };
