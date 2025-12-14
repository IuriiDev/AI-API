/**
 * Error Handler Middleware
 * 
 * Centralized error handling for consistent error responses
 * All errors include machine-readable error codes for client handling
 */

/**
 * Error code constants
 * @readonly
 * @enum {string}
 */
const ErrorCodes = {
    // Validation errors (400)
    INVALID_INPUT: 'INVALID_INPUT',
    INPUT_TOO_LONG: 'INPUT_TOO_LONG',
    INPUT_REQUIRED: 'INPUT_REQUIRED',
    INVALID_PROVIDER: 'INVALID_PROVIDER',
    INVALID_MODEL: 'INVALID_MODEL',

    // Auth errors (401, 403)
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',

    // Not found (404)
    NOT_FOUND: 'NOT_FOUND',
    JOB_NOT_FOUND: 'JOB_NOT_FOUND',
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',

    // Rate limiting (429)
    RATE_LIMITED: 'RATE_LIMITED',

    // Server errors (500)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    PROVIDER_ERROR: 'PROVIDER_ERROR',
    TIMEOUT: 'TIMEOUT'
};

/**
 * Custom API Error class with error code support
 */
class APIError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {number} statusCode - HTTP status code
     * @param {string} [code] - Machine-readable error code
     * @param {Object} [details] - Additional details
     */
    constructor(message, statusCode = 500, code = null, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code || ErrorCodes.INTERNAL_ERROR;
        this.details = details;
        this.name = 'APIError';
    }
}

/**
 * Async handler wrapper - eliminates try/catch in controllers
 * @param {Function} fn - Async controller function
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Global error handler middleware
 */
function errorHandler(error, req, res, next) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error:`, error.message);

    // Handle Axios errors (from AI provider APIs)
    if (error.response) {
        const providerError = error.response.data?.error || error.response.data;
        const status = error.response.status || 500;

        return res.status(status).json({
            success: false,
            error: 'AI Provider Error',
            code: status === 429 ? ErrorCodes.RATE_LIMITED : ErrorCodes.PROVIDER_ERROR,
            message: providerError?.message || 'Request to AI provider failed',
            details: providerError
        });
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return res.status(504).json({
            success: false,
            error: 'Gateway Timeout',
            code: ErrorCodes.TIMEOUT,
            message: 'Request to AI provider timed out'
        });
    }

    // Handle custom API errors
    if (error instanceof APIError) {
        return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            code: error.code,
            details: error.details
        });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            code: ErrorCodes.INVALID_INPUT,
            message: error.message
        });
    }

    // Handle unknown errors
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        code: ErrorCodes.INTERNAL_ERROR,
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message
    });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        code: ErrorCodes.ROUTE_NOT_FOUND,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
}

module.exports = {
    APIError,
    ErrorCodes,
    asyncHandler,
    errorHandler,
    notFoundHandler
};
