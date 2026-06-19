/**
 * Request Validation Middleware
 * 
 * Validates incoming requests before they reach controllers
 */

const config = require('../config');
const { APIError, ErrorCodes } = require('./errorHandler');

/**
 * Validate image analysis request
 */
function validateImageAnalysisRequest(req, res, next) {
    const { image, prompt } = req.body || {};

    if (!image) {
        throw new APIError('Image is required.', 400, ErrorCodes.INPUT_REQUIRED);
    }

    if (!prompt || typeof prompt !== 'string') {
        throw new APIError('Prompt text is required.', 400, ErrorCodes.INPUT_REQUIRED);
    }

    if (prompt.trim().length === 0) {
        throw new APIError('Prompt cannot be empty.', 400, ErrorCodes.INPUT_REQUIRED);
    }

    if (prompt.length > config.validation.maxInputLength) {
        throw new APIError(
            `Prompt cannot exceed ${config.validation.maxInputLength} characters.`,
            400,
            ErrorCodes.INPUT_TOO_LONG
        );
    }

    next();
}

/**
 * Validate image generation request
 */
function validateImageGenerationRequest(req, res, next) {
    const { prompt, size, quality, outputFormat, count } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
        throw new APIError('Prompt text is required.', 400, ErrorCodes.INPUT_REQUIRED);
    }

    if (prompt.trim().length === 0) {
        throw new APIError('Prompt cannot be empty.', 400, ErrorCodes.INPUT_REQUIRED);
    }

    if (prompt.length > config.validation.maxInputLength) {
        throw new APIError(
            `Prompt cannot exceed ${config.validation.maxInputLength} characters.`,
            400,
            ErrorCodes.INPUT_TOO_LONG
        );
    }

    validateAllowedValue(size, config.imageSettings.sizes, 'size');
    validateAllowedValue(quality, config.imageSettings.qualities, 'quality');
    validateAllowedValue(outputFormat, config.imageSettings.formats, 'outputFormat');
    if (count !== undefined
        && (!Number.isInteger(count) || count < 1 || count > config.imageSettings.maximumCount)) {
        throw new APIError(
            `Count must be an integer from 1 to ${config.imageSettings.maximumCount}.`,
            400,
            ErrorCodes.INVALID_INPUT
        );
    }

    next();
}

function validateAllowedValue(value, allowedValues, fieldName) {
    if (value !== undefined && !allowedValues.includes(value)) {
        throw new APIError(
            `${fieldName} must be one of: ${allowedValues.join(', ')}.`,
            400,
            ErrorCodes.INVALID_INPUT
        );
    }
}

/**
 * Validate provider parameter (if provided)
 */
function validateProvider(req, res, next) {
    const { getAvailableProviders } = require('../providers');
    const provider = req.body?.provider || req.query?.provider || 'openai';

    if (typeof provider !== 'string') {
        throw new APIError('Provider must be text.', 400, ErrorCodes.INVALID_PROVIDER);
    }
    const normalizedProvider = provider.toLowerCase();
    const available = getAvailableProviders();
    if (!available.includes(normalizedProvider)) {
        throw new APIError(
            `Invalid provider: ${provider}. Available: ${available.join(', ')}`,
            400,
            ErrorCodes.INVALID_PROVIDER
        );
    }

    const model = req.body?.model || req.query?.model;
    if (model) {
        if (typeof model !== 'string') {
            throw new APIError('Model must be text.', 400, ErrorCodes.INVALID_MODEL);
        }
        const providerConfig = config.providers[normalizedProvider];
        const availableModels = providerConfig?.availableModels?.map(item => item.id) || [];
        if (!availableModels.includes(model)) {
            throw new APIError(
                `Invalid model ${model} for provider ${provider}.`,
                400,
                ErrorCodes.INVALID_MODEL
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
