/**
 * Provider Factory
 * 
 * Implements: Open/Closed Principle (SOLID)
 * 
 * To add a new provider:
 * 1. Create new provider class extending BaseProvider
 * 2. Add configuration in config/index.js
 * 3. Register provider in this factory
 */

const config = require('../config');
const OpenAIProvider = require('./OpenAIProvider');
// Future imports:
// const GeminiProvider = require('./GeminiProvider');
// const GrokProvider = require('./GrokProvider');
// const DeepSeekProvider = require('./DeepSeekProvider');

// Provider registry - maps provider names to their classes
const providerRegistry = {
    openai: OpenAIProvider,
    // gemini: GeminiProvider,
    // grok: GrokProvider,
    // deepseek: DeepSeekProvider
};

// Provider instances cache (singleton per provider)
const providerInstances = {};

/**
 * Get provider instance by name
 * Uses singleton pattern - creates instance once and reuses
 * 
 * @param {string} providerName - Provider identifier (openai, gemini, grok, deepseek)
 * @returns {BaseProvider} - Provider instance
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
        throw new Error(`Unknown provider: ${providerName}. Available: ${getAvailableProviders().join(', ')}`);
    }
    
    // Get provider config
    const providerConfig = config.providers[name];
    if (!providerConfig) {
        throw new Error(`Configuration not found for provider: ${providerName}`);
    }
    
    // Check if API key is configured
    if (!providerConfig.apiKey) {
        throw new Error(`API key not configured for ${providerName}. Set ${name.toUpperCase()}_API_KEY environment variable.`);
    }
    
    // Create and cache instance
    providerInstances[name] = new ProviderClass(providerConfig);
    
    return providerInstances[name];
}

/**
 * Get list of available (registered) providers
 */
function getAvailableProviders() {
    return Object.keys(providerRegistry);
}

/**
 * Get list of configured providers (with API keys)
 */
function getConfiguredProviders() {
    return getAvailableProviders().filter(name => {
        const providerConfig = config.providers[name];
        return providerConfig && providerConfig.apiKey;
    });
}

/**
 * Check if provider supports a capability
 */
function providerSupports(providerName, capability) {
    try {
        const provider = getProvider(providerName);
        return provider.supports(capability);
    } catch {
        return false;
    }
}

module.exports = {
    getProvider,
    getAvailableProviders,
    getConfiguredProviders,
    providerSupports
};

