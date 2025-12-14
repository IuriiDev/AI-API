/**
 * BaseProvider - Abstract base class for all AI providers
 * 
 * Implements: Interface Segregation & Dependency Inversion (SOLID)
 * 
 * All AI providers must extend this class and implement the abstract methods.
 * This ensures consistent interface across all providers.
 * 
 * Provides shared functionality:
 * - Request retry with exponential backoff
 * - Timeout handling
 * - Image formatting for vision models
 * - Standardized error handling
 */

const axios = require('axios');
const config = require('../config');

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role - Message role
 * @property {string|Array} content - Message content
 */

/**
 * @typedef {Object} ChatParams
 * @property {Message[]} messages - Conversation messages
 * @property {string} [model] - Model to use
 * @property {number} [maxCompletionTokens] - Max tokens in response
 * @property {string} [image] - Base64 encoded image
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} provider - Provider name
 * @property {string} id - Response ID
 * @property {string} model - Model used
 * @property {string} content - Response text
 * @property {string} finishReason - Why generation stopped
 * @property {Object} usage - Token usage
 * @property {Object} raw - Raw API response
 */

class BaseProvider {
    // Shared constants (DRY)
    static BASE64_IMAGE_PREFIX = 'data:image/jpeg;base64,';
    static RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

    /**
     * @param {Object} providerConfig - Provider configuration from config
     */
    constructor(providerConfig) {
        if (new.target === BaseProvider) {
            throw new Error('BaseProvider is abstract and cannot be instantiated directly');
        }

        this.name = providerConfig.name;
        this.baseUrl = providerConfig.baseUrl;
        this.apiKey = providerConfig.apiKey;
        this.endpoints = providerConfig.endpoints;
        this.models = providerConfig.models;
        this.defaults = providerConfig.defaults || {};
        this.timeouts = config.timeouts;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HTTP HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get authorization headers for API requests
     * Override for providers with different auth schemes (e.g., Gemini)
     * @returns {Object} HTTP headers
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Build full URL for an endpoint
     * @param {string} endpoint - API endpoint path
     * @returns {string} Full URL
     */
    buildUrl(endpoint) {
        return `${this.baseUrl}${endpoint}`;
    }

    /**
     * Make POST request with retry logic
     * @param {string} url - Request URL
     * @param {Object} payload - Request body
     * @param {Object} [options] - Additional axios options
     * @param {number} [attempt=1] - Current retry attempt
     * @returns {Promise<Object>} Axios response
     */
    async requestWithRetry(url, payload, options = {}, attempt = 1) {
        try {
            const response = await axios.post(url, payload, {
                headers: this.getHeaders(),
                ...options
            });
            return response;
        } catch (error) {
            const isRetryable = this.isRetryableError(error);
            const canRetry = attempt < this.timeouts.retryAttempts;

            if (isRetryable && canRetry) {
                const delay = this.timeouts.retryDelayMs * Math.pow(2, attempt - 1);
                console.log(`[${this.name}] Retry attempt ${attempt + 1} after ${delay}ms`);
                await this.sleep(delay);
                return this.requestWithRetry(url, payload, options, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Check if error is retryable (transient)
     * @param {Error} error - Axios error
     * @returns {boolean}
     */
    isRetryableError(error) {
        // Network errors are retryable
        if (!error.response) {
            return true;
        }
        return BaseProvider.RETRYABLE_STATUS_CODES.includes(error.response.status);
    }

    /**
     * Sleep helper for retry delay
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // IMAGE HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Create base64 image URL from raw base64 data
     * @param {string} base64Data - Raw base64 image data
     * @returns {string} Data URL for image
     */
    getBase64ImageUrl(base64Data) {
        return `${BaseProvider.BASE64_IMAGE_PREFIX}${base64Data}`;
    }

    /**
     * Format messages with image for vision (OpenAI-compatible format)
     * Converts last user message to multimodal content array
     * @param {Message[]} messages - Original messages
     * @param {string} image - Base64 encoded image
     * @returns {Message[]} Formatted messages
     */
    formatMessagesWithImage(messages, image) {
        const formatted = [...messages];

        // Find last user message and add image
        for (let i = formatted.length - 1; i >= 0; i--) {
            if (formatted[i].role === 'user') {
                formatted[i] = {
                    role: 'user',
                    content: [
                        { type: 'text', text: formatted[i].content },
                        {
                            type: 'image_url',
                            image_url: {
                                url: this.getBase64ImageUrl(image)
                            }
                        }
                    ]
                };
                break;
            }
        }

        return formatted;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABSTRACT METHODS (must be implemented by providers)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Chat completion
     * @param {ChatParams} params - Chat parameters
     * @returns {Promise<ChatResponse>} Standardized response
     */
    async chat(params) {
        throw new Error('Method chat() must be implemented');
    }

    /**
     * Streaming chat completion (optional)
     * @param {ChatParams} params - Chat parameters
     * @param {Function} onChunk - Callback for each text chunk
     * @returns {Promise<void>}
     */
    async chatStream(params, onChunk) {
        throw new Error(`Streaming not supported by ${this.name}`);
    }

    /**
     * Image analysis (vision)
     * @param {Object} params - { image, prompt, maxTokens? }
     * @returns {Promise<ChatResponse>} Standardized response
     */
    async analyzeImage(params) {
        throw new Error('Method analyzeImage() must be implemented');
    }

    /**
     * Image generation
     * @param {Object} params - { prompt, size?, quality?, format?, count? }
     * @returns {Promise<Object>} Standardized response
     */
    async generateImage(params) {
        throw new Error(`Image generation not supported by ${this.name}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CAPABILITIES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Check if provider supports a specific capability
     * @param {string} capability - Capability to check
     * @returns {boolean}
     */
    supports(capability) {
        return this.getCapabilities().includes(capability);
    }

    /**
     * Get list of supported capabilities
     * Override in child classes
     * @returns {string[]} List of capabilities
     */
    getCapabilities() {
        return ['chat'];
    }
}

module.exports = BaseProvider;
