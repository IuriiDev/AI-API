const path = require('path');
const multer = require('multer');
const config = require('../config');
const { APIError, ErrorCodes } = require('./errorHandler');

const supportedExtensions = new Set([
    '.pdf', '.txt', '.md', '.json', '.html', '.xml', '.csv', '.tsv',
    '.rtf', '.doc', '.docx', '.odt', '.ppt', '.pptx', '.xls', '.xlsx'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.documentAnalysis.maximumFileSizeBytes,
        files: config.documentAnalysis.maximumDocumentCount,
<<<<<<< HEAD
        fields: 8
=======
        fields: 5
>>>>>>> 10c6d1393560111d9127ea10b639cf2e6071d8c9
    },
    fileFilter: (_request, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!supportedExtensions.has(extension)) {
            callback(new APIError(
                `Unsupported document type: ${extension || 'unknown'}.`,
                400,
                ErrorCodes.INVALID_FILE
            ));
            return;
        }
        callback(null, true);
    }
}).array('documents', config.documentAnalysis.maximumDocumentCount);

function handleDocumentAnalysisUpload(request, response, next) {
    upload(request, response, (error) => {
        if (!error) {
            next();
            return;
        }
        if (!(error instanceof multer.MulterError)) {
            next(error);
            return;
        }

        const messages = {
            LIMIT_FILE_SIZE: `Each document must be ${formatMegabytes(
                config.documentAnalysis.maximumFileSizeBytes
            )} MB or smaller.`,
            LIMIT_FILE_COUNT: `A maximum of ${
                config.documentAnalysis.maximumDocumentCount
            } documents is allowed.`,
            LIMIT_UNEXPECTED_FILE: 'Use the documents multipart field for every attachment.'
        };
        next(new APIError(
            messages[error.code] || 'The document upload is invalid.',
            400,
            error.code === 'LIMIT_FILE_SIZE'
                ? ErrorCodes.FILE_TOO_LARGE
                : ErrorCodes.INVALID_FILE
        ));
    });
}

function formatMegabytes(bytes) {
    return Math.floor(bytes / (1024 * 1024));
}

module.exports = { handleDocumentAnalysisUpload };
