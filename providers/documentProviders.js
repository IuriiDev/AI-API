const config = require('../config');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');
const OpenAIDocumentProvider = require('./OpenAIDocumentProvider');
const XAIDocumentProvider = require('./XAIDocumentProvider');

const providerConstructors = {
    openai: OpenAIDocumentProvider,
    grok: XAIDocumentProvider
};
const providerInstances = new Map();

function getDocumentProvider(providerName) {
    const normalizedName = providerName.toLowerCase();
    const Provider = providerConstructors[normalizedName];
    const providerConfig = config.providers[normalizedName];

    if (!Provider || !providerConfig?.documentInput?.gatewayEnabled) {
        throw new APIError(
            `Provider ${providerName} is not enabled for document analysis.`,
            400,
            ErrorCodes.UNSUPPORTED_CAPABILITY
        );
    }
    if (!providerInstances.has(normalizedName)) {
        providerInstances.set(
            normalizedName,
            new Provider(providerConfig, config.documentAnalysis)
        );
    }
    return providerInstances.get(normalizedName);
}

function getEnabledDocumentProviders() {
    return Object.keys(providerConstructors).filter(
        providerName => config.providers[providerName]?.documentInput?.gatewayEnabled
    );
}

module.exports = { getDocumentProvider, getEnabledDocumentProviders };
