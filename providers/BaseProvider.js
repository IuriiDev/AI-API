/**
 * BaseProvider - Abstract base class for all AI providers
 * 
 * Implements: Interface Segregation & Dependency Inversion (SOLID)
 * 
 * All AI providers must extend this class and implement the abstract methods.
 * This ensures consistent interface across all providers.
 * 
 * Features:
 * - Shared HTTP client with configurable timeout
 * - Automatic retry with exponential backoff
 * - Request logging in development mode
 */

const axios = require('axios');
const config = require('../config');

class BaseProvider {
    // Shared constants to eliminate duplication (DRY)
    static BASE64_IMAGE_PREFIX = 'data:image/jpeg;base64,';

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

        // Create axios instance with default configuration
        this.httpClient = axios.create({
            timeout: config.http.timeouts.default
        });

        // Add request logging in development mode
        if (process.env.NODE_ENV !== 'production') {
            this.httpClient.interceptors.request.use(request => {
                console.log(`[HTTP] ${request.method?.toUpperCase()} ${request.url}`);
                return request;
            });
        }
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
     * Create base64 image URL from raw base64 data
     * Centralizes image URL formatting (DRY)
     */
    getBase64ImageUrl(base64Data) {
        return `${BaseProvider.BASE64_IMAGE_PREFIX}${base64Data}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HTTP Client with Retry Logic
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Execute HTTP POST request with automatic retry and exponential backoff
     * 
     * @param {string} url - Full URL to request
     * @param {Object} payload - Request body
     * @param {Object} options - { timeout, headers }
     * @returns {Promise<Object>} - Axios response
     * @throws {Error} - After all retries exhausted
     */
    async request(url, payload, options = {}) {
        const retryConfig = config.http.retry;
        let lastError;

        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                const response = await this.httpClient.post(url, payload, {
                    timeout: options.timeout || config.http.timeouts.default,
                    headers: options.headers || this.getHeaders()
                });
                return response;
            } catch (error) {
                lastError = error;

                // Don't retry if not retryable or last attempt
                if (!this.isRetryable(error) || attempt === retryConfig.maxAttempts) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = this.calculateBackoff(attempt, retryConfig);

                console.log(
                    `[Retry] Attempt ${attempt}/${retryConfig.maxAttempts} failed: ${error.message}. ` +
                    `Retrying in ${delay}ms...`
                );

                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    /**
     * Calculate backoff delay using exponential formula
     * delay = min(baseDelay * multiplier^(attempt-1), maxDelay)
     */
    calculateBackoff(attempt, retryConfig) {
        const delay = retryConfig.baseDelay * Math.pow(retryConfig.multiplier, attempt - 1);
        return Math.min(delay, retryConfig.maxDelay);
    }

    /**
     * Determine if an error should trigger a retry
     * Retries: timeouts, rate limits (429), server errors (5xx)
     */
    isRetryable(error) {
        // Retry on network/timeout errors
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
            return true;
        }

        // Retry on configured HTTP status codes
        if (error.response && config.http.retryableStatuses.includes(error.response.status)) {
            return true;
        }

        return false;
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Abstract Methods (must be implemented by providers)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Chat completion - must be implemented by each provider
     * @param {Object} params - { messages, model?, maxTokens? }
     * @returns {Promise<Object>} - Standardized response
     */
    async chat(params) {
        throw new Error('Method chat() must be implemented');
    }

    /**
     * Streaming chat completion - must be implemented by each provider
     * Uses callbacks for real-time text delivery
     * 
     * @param {Object} params
     * @param {Array} params.messages - Chat history
     * @param {string} params.model - Model to use
     * @param {Function} params.onChunk - Called with each text chunk
     * @param {Function} params.onComplete - Called with full content when done
     * @param {Function} params.onError - Called on error
     */
    async chatStream(params) {
        throw new Error('Method chatStream() must be implemented');
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
