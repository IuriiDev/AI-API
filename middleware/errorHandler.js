/**
 * Error Handler Middleware
 * 
 * Centralized error handling for consistent error responses
 */

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'APIError';
    }
}

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
 */
function errorHandler(error, req, res, next) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);

    // Handle Axios errors (from AI provider APIs)
    if (error.response) {
        const providerError = error.response.data?.error || error.response.data;
        console.error(`[${new Date().toISOString()}] Provider Error Details:`, JSON.stringify(providerError, null, 2));
        return res.status(error.response.status || 500).json({
            success: false,
            error: 'AI Provider Error',
            message: providerError?.message || 'Request to AI provider failed',
            details: providerError
        });
    }

    // Handle custom API errors
    if (error instanceof APIError) {
        return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            details: error.details
        });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.message
        });
    }

    // Handle unknown errors
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
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
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
}

module.exports = {
    APIError,
    asyncHandler,
    errorHandler,
    notFoundHandler
};

