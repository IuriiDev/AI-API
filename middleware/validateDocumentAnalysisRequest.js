const config = require('../config');
const { getEnabledDocumentProviders } = require('../providers/documentProviders');
const { APIError, ErrorCodes } = require('./errorHandler');

const schemaNamePattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function validateDocumentAnalysisRequest(request, _response, next) {
    try {
        const documents = request.files || [];
        if (documents.length === 0) {
            throw new APIError(
                'At least one document is required.',
                400,
                ErrorCodes.DOCUMENT_REQUIRED
            );
        }
        const totalFileSize = documents.reduce(
            (total, document) => total + document.size,
            0
        );
        if (totalFileSize > config.documentAnalysis.maximumTotalFileSizeBytes) {
            throw new APIError(
                'The combined document size exceeds the configured request limit.',
                400,
                ErrorCodes.FILE_TOO_LARGE
            );
        }

        const prompt = requiredText(request.body?.prompt, 'prompt');
        if (prompt.length > config.documentAnalysis.maximumPromptLength) {
            throw new APIError(
                `Prompt cannot exceed ${config.documentAnalysis.maximumPromptLength} characters.`,
                400,
                ErrorCodes.INPUT_TOO_LONG
            );
        }

        const provider = optionalText(request.body?.provider)?.toLowerCase()
            || config.documentAnalysis.defaultProvider;
        if (!getEnabledDocumentProviders().includes(provider)) {
            throw new APIError(
                `Provider ${provider} is not enabled for document analysis.`,
                400,
                ErrorCodes.UNSUPPORTED_CAPABILITY
            );
        }

        const schemaName = optionalText(request.body?.schema_name) || 'document_analysis';
        if (!schemaNamePattern.test(schemaName)) {
            throw new APIError(
                'Schema name must start with a letter and contain at most 64 letters, numbers, dashes, or underscores.',
                400,
                ErrorCodes.INVALID_SCHEMA
            );
        }

        request.documentAnalysisRequest = {
            documents,
            prompt,
            provider,
            model: optionalText(request.body?.model),
            schemaName,
            responseSchema: parseResponseSchema(request.body?.response_schema)
        };
        next();
    } catch (error) {
        next(error);
    }
}

function requiredText(value, fieldName) {
    const normalizedValue = optionalText(value);
    if (!normalizedValue) {
        throw new APIError(
            `${fieldName} is required and must be text.`,
            400,
            ErrorCodes.INPUT_REQUIRED
        );
    }
    return normalizedValue;
}

function optionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new APIError(
            'Multipart text fields must contain text values.',
            400,
            ErrorCodes.INVALID_INPUT
        );
    }
    return value.trim() || null;
}

function parseResponseSchema(value) {
    const schemaJSON = optionalText(value);
    if (!schemaJSON) {
        return null;
    }
    if (Buffer.byteLength(schemaJSON, 'utf8') > config.documentAnalysis.maximumSchemaLength) {
        throw new APIError(
            `Response schema cannot exceed ${config.documentAnalysis.maximumSchemaLength} bytes.`,
            400,
            ErrorCodes.INVALID_SCHEMA
        );
    }

    let schema;
    try {
        schema = JSON.parse(schemaJSON);
    } catch {
        throw new APIError(
            'Response schema must be valid JSON.',
            400,
            ErrorCodes.INVALID_SCHEMA
        );
    }
    if (!schema || Array.isArray(schema) || typeof schema !== 'object' || schema.type !== 'object') {
        throw new APIError(
            'Response schema must be a JSON Schema object with root type object.',
            400,
            ErrorCodes.INVALID_SCHEMA
        );
    }
    return schema;
}

module.exports = { validateDocumentAnalysisRequest };
