/**
 * Provider Factory
 * 
 * Implements: Open/Closed Principle (SOLID)
 * 
 * To add a new provider:
 * 1. Create new provider class extending BaseProvider
 * 2. Add configuration in config/index.js
 * 3. Register provider in this factory
 * 
 * @module providers
 */

const config = require('../config');
const OpenAIProvider = require('./OpenAIProvider');
const GeminiProvider = require('./GeminiProvider');
const GrokProvider = require('./GrokProvider');

/**
 * Provider registry - maps provider names to their classes
 * @type {Object<string, typeof import('./BaseProvider')>}
 */
const providerRegistry = {
    openai: OpenAIProvider,
    gemini: GeminiProvider,
    grok: GrokProvider
};

/**
 * Provider instances cache (singleton per provider)
 * @type {Object<string, import('./BaseProvider')>}
 */
const providerInstances = {};

/**
 * Get provider instance by name
 * Uses singleton pattern - creates instance once and reuses
 * 
 * @param {string} [providerName='openai'] - Provider identifier
 * @returns {import('./BaseProvider')} Provider instance
 * @throws {Error} If provider is unknown or not configured
 */
function getProvider(providerName = 'openai') {
    const name = providerName.toLowerCase();

    // Return cached instance if exists
    if (providerInstances[name]) {
        return providerInstances[name];
    }

    // Get provider class from registry
    const ProviderClass = providerRegistry[name];
    if (!ProviderClass) {
        const available = getAvailableProviders().join(', ');
        throw new Error(`Unknown provider: ${providerName}. Available: ${available}`);
    }

    // Get provider config
    const providerConfig = config.providers[name];
    if (!providerConfig) {
        throw new Error(`Configuration not found for provider: ${providerName}`);
    }

    // Check if API key is configured
    if (!providerConfig.apiKey) {
        const envVar = `${name.toUpperCase()}_API_KEY`;
        throw new Error(`API key not configured for ${providerName}. Set ${envVar} environment variable.`);
    }

    // Create and cache instance
    providerInstances[name] = new ProviderClass(providerConfig);
    return providerInstances[name];
}

/**
 * Get list of available (registered) providers
 * @returns {string[]}
 */
function getAvailableProviders() {
    return Object.keys(providerRegistry);
}

/**
 * Get list of configured providers (with API keys)
 * @returns {string[]}
 */
function getConfiguredProviders() {
    return getAvailableProviders().filter(name => {
        const providerConfig = config.providers[name];
        return providerConfig && providerConfig.apiKey;
    });
}

/**
 * Check if provider supports a capability
 * @param {string} providerName
 * @param {string} capability
 * @returns {boolean}
 */
function providerSupports(providerName, capability) {
    try {
        const provider = getProvider(providerName);
        return provider.supports(capability);
    } catch {
        return false;
    }
}

/**
 * Get configured models with display info (hierarchical)
 * @returns {Array<{id: string, name: string, models: Array, defaultModel: string}>}
 */
function getConfiguredModels() {
    return getConfiguredProviders().map(providerId => {
        const providerConfig = config.providers[providerId];
        return {
            id: providerId,
            name: providerConfig.name,
            models: providerConfig.availableModels || [],
            defaultModel: providerConfig.defaultModel
        };
    });
}

module.exports = {
    getProvider,
    getAvailableProviders,
    getConfiguredProviders,
    getConfiguredModels,
    providerSupports
};
