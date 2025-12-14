/**
 * Request Validation Middleware
 * 
 * Validates incoming requests before they reach controllers
 */

const { APIError } = require('./errorHandler');

/**
 * Validate image analysis request
 */
function validateImageAnalysisRequest(req, res, next) {
    const { image, prompt } = req.body;

    if (!image) {
        throw new APIError('Invalid request: image is required', 400);
    }

    if (!prompt || typeof prompt !== 'string') {
        throw new APIError('Invalid request: prompt string is required', 400);
    }

    if (prompt.trim().length === 0) {
        throw new APIError('Invalid request: prompt cannot be empty', 400);
    }

    next();
}

/**
 * Validate image generation request
 */
function validateImageGenerationRequest(req, res, next) {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        throw new APIError('Invalid request: prompt string is required', 400);
    }

    if (prompt.trim().length === 0) {
        throw new APIError('Invalid request: prompt cannot be empty', 400);
    }

    next();
}

/**
 * Validate provider parameter (if provided)
 */
function validateProvider(req, res, next) {
    const { getAvailableProviders } = require('../providers');
    const provider = req.body.provider || req.query.provider;

    if (provider) {
        const available = getAvailableProviders();
        if (!available.includes(provider.toLowerCase())) {
            throw new APIError(
                `Invalid provider: ${provider}. Available: ${available.join(', ')}`,
                400
            );
        }
    }

    next();
}

module.exports = {
    validateImageAnalysisRequest,
    validateImageGenerationRequest,
    validateProvider
};
