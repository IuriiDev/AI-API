/**
 * BaseProvider - Abstract base class for all AI providers
 * 
 * Implements: Interface Segregation & Dependency Inversion (SOLID)
 * 
 * All AI providers must extend this class and implement the abstract methods.
 * This ensures consistent interface across all providers.
 */

class BaseProvider {
    constructor(config) {
        if (new.target === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }
        
        this.name = config.name;
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.endpoints = config.endpoints;
        this.models = config.models;
        this.defaults = config.defaults || {};
    }

    /**
     * Get authorization headers for API requests
     * Can be overridden by providers with different auth schemes
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Build full URL for an endpoint
     */
    buildUrl(endpoint) {
        return `${this.baseUrl}${endpoint}`;
    }

    /**
     * Chat completion - must be implemented by each provider
     * @param {Object} params - { messages, model?, maxTokens? }
     * @returns {Promise<Object>} - Standardized response
     */
    async chat(params) {
        throw new Error('Method chat() must be implemented');
    }

    /**
     * Image analysis (vision) - must be implemented by each provider
     * @param {Object} params - { image, prompt, maxTokens? }
     * @returns {Promise<Object>} - Standardized response
     */
    async analyzeImage(params) {
        throw new Error('Method analyzeImage() must be implemented');
    }

    /**
     * Image generation - optional, not all providers support this
     * @param {Object} params - { prompt, size?, quality?, format?, count? }
     * @returns {Promise<Object>} - Standardized response
     */
    async generateImage(params) {
        throw new Error(`Image generation not supported by ${this.name}`);
    }

    /**
     * Check if provider supports a specific capability
     */
    supports(capability) {
        const capabilities = this.getCapabilities();
        return capabilities.includes(capability);
    }

    /**
     * Get list of supported capabilities
     * Override in child classes
     */
    getCapabilities() {
        return ['chat'];
    }
}

module.exports = BaseProvider;

