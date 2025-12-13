/**
 * Error Handler Middleware
 * 
 * Centralized error handling with comprehensive error classification
 * Provides consistent, informative error responses to clients
 */

// ─────────────────────────────────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error codes for client-side handling
 */
const ErrorCodes = {
    TIMEOUT: 'TIMEOUT',
    RATE_LIMIT: 'RATE_LIMIT',
    AUTH_ERROR: 'AUTH_ERROR',
    PROVIDER_ERROR: 'PROVIDER_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * Custom API Error class for application-level errors
 */
class APIError extends Error {
    constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'APIError';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Async handler wrapper - eliminates try/catch in controllers
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Global error handler middleware
 * Classifies errors and returns appropriate HTTP responses
 */
function errorHandler(error, req, res, next) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);

    // 1. Timeout errors (network level)
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        return res.status(504).json({
            success: false,
            error: 'Gateway Timeout',
            code: ErrorCodes.TIMEOUT,
            message: 'The AI provider took too long to respond. Please try again with a shorter prompt or different model.'
        });
    }

    // Handle HTTP response errors from AI providers
    if (error.response) {
        const status = error.response.status;
        const providerError = error.response.data?.error || error.response.data;

        // 2. Rate limit exceeded (429)
        if (status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Rate Limit Exceeded',
                code: ErrorCodes.RATE_LIMIT,
                message: 'Too many requests. Please wait a moment and try again.',
                retryAfter: error.response.headers?.['retry-after'] || null
            });
        }

        // 3. Authentication/Authorization errors (401, 403)
        if (status === 401 || status === 403) {
            return res.status(status).json({
                success: false,
                error: 'Authentication Error',
                code: ErrorCodes.AUTH_ERROR,
                message: 'Invalid or missing API key for the requested provider.'
            });
        }

        // 4. Provider server errors (5xx)
        if (status >= 500) {
            return res.status(502).json({
                success: false,
                error: 'Provider Unavailable',
                code: ErrorCodes.PROVIDER_ERROR,
                message: 'The AI provider is currently unavailable. Please try again later.'
            });
        }

        // 5. Other provider errors (4xx)
        return res.status(status).json({
            success: false,
            error: 'AI Provider Error',
            code: ErrorCodes.PROVIDER_ERROR,
            message: providerError?.message || 'Request to AI provider failed',
            details: process.env.NODE_ENV !== 'production' ? providerError : undefined
        });
    }

    // 6. Custom API errors (thrown by application code)
    if (error instanceof APIError) {
        return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            code: error.code,
            details: error.details
        });
    }

    // 7. Validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            code: ErrorCodes.VALIDATION_ERROR,
            message: error.message
        });
    }

    // 8. Catch-all for unknown errors
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
        code: ErrorCodes.NOT_FOUND,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
}

module.exports = {
    ErrorCodes,
    APIError,
    asyncHandler,
    errorHandler,
    notFoundHandler
};
