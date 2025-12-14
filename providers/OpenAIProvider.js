/**
 * OpenAIProvider - OpenAI API Implementation
 * 
 * Implements: Single Responsibility & Liskov Substitution (SOLID)
 * 
 * Supports:
 * - Chat completions (GPT-4o, GPT-4o-mini, etc.)
 * - Streaming responses
 * - Image analysis/vision
 * - Image generation (DALL-E 3)
 * - Retry logic with exponential backoff
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const config = require('../config');

class OpenAIProvider extends BaseProvider {
    constructor(providerConfig) {
        super(providerConfig);
        this.timeouts = config.timeouts;
    }

    getCapabilities() {
        return ['chat', 'vision', 'imageGeneration', 'streaming'];
    }

    /**
     * Chat completion (with optional vision support)
     * Includes retry logic for transient failures
     */
    async chat({ messages, model, maxCompletionTokens, image }) {
        const url = this.buildUrl(this.endpoints.chat);

        const maxTokens = maxCompletionTokens || this.defaults.maxCompletionTokens;

        // If image provided, transform last user message for vision
        let formattedMessages = messages;
        if (image) {
            formattedMessages = this.formatMessagesWithImage(messages, image);
        }

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            // Per latest OpenAI docs, new ChatGPT models expect max_completion_tokens
            // instead of the legacy max_tokens parameter.
            max_completion_tokens: maxTokens
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Make request with retry logic and timeout
     */
    async requestWithRetry(url, payload, attempt = 1) {
        try {
            const response = await axios.post(url, payload, {
                headers: this.getHeaders(),
                timeout: this.timeouts.requestMs
            });
            return response;
        } catch (error) {
            // Only retry on transient errors
            const isRetryable = this.isRetryableError(error);
            const canRetry = attempt < this.timeouts.retryAttempts;

            if (isRetryable && canRetry) {
                const delay = this.timeouts.retryDelayMs * Math.pow(2, attempt - 1);
                console.log(`[OpenAI] Retry attempt ${attempt + 1} after ${delay}ms`);
                await this.sleep(delay);
                return this.requestWithRetry(url, payload, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        if (!error.response) {
            // Network errors are retryable
            return true;
        }

        const status = error.response.status;
        // Retry on 429 (rate limit), 500, 502, 503, 504
        return [429, 500, 502, 503, 504].includes(status);
    }

    /**
     * Sleep helper for retry delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Streaming chat completion
     * Calls onChunk callback for each text chunk
     */
    async chatStream({ messages, model, maxCompletionTokens }, onChunk) {
        const url = this.buildUrl(this.endpoints.chat);

        const payload = {
            model: model || this.models.chat,
            messages,
            max_completion_tokens: maxCompletionTokens || this.defaults.maxCompletionTokens,
            stream: true
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders(),
            timeout: this.timeouts.requestMs * 3, // Longer timeout for streaming
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();

                // Process complete SSE messages
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            // Skip malformed JSON
                        }
                    }
                }
            });

            response.data.on('end', () => {
                resolve();
            });

            response.data.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Format messages with image for vision
     * Converts last user message to multimodal content array
     */
    formatMessagesWithImage(messages, image) {
        const formatted = [...messages];

        // Find last user message
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

    /**
     * Image analysis using vision model
     */
    async analyzeImage({ image, prompt, maxCompletionTokens }) {
        const url = this.buildUrl(this.endpoints.chat);

        const maxTokens = maxCompletionTokens || this.defaults.maxCompletionTokens;

        const payload = {
            model: this.models.vision,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: this.getBase64ImageUrl(image)
                            }
                        }
                    ]
                }
            ],
            max_completion_tokens: maxTokens
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Image generation using DALL-E
     */
    async generateImage({ prompt, size, quality, outputFormat, count }) {
        const url = this.buildUrl(this.endpoints.imageGeneration);

        const payload = {
            model: this.models.imageGeneration,
            prompt: prompt.trim(),
            n: count || 1,
            size: size || '1024x1024',
            quality: quality || 'standard',
            response_format: 'b64_json'
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatImageResponse(response.data);
    }

    /**
     * Format chat/vision response to standardized structure
     */
    formatChatResponse(data) {
        const rawContent = data.choices?.[0]?.message?.content;
        const formattedContent = this.extractContentText(rawContent);

        return {
            provider: this.name,
            id: data.id,
            model: data.model,
            content: formattedContent || null,
            finishReason: data.choices?.[0]?.finish_reason,
            usage: data.usage,
            raw: data
        };
    }

    /**
     * Normalize OpenAI chat content into a single text string.
     * Handles both legacy string responses and the new content part structure
     * (e.g., { type: 'output_text', text: { value: '...' } }).
     */
    extractContentText(rawContent) {
        if (!rawContent) return null;
        if (typeof rawContent === 'string') return rawContent;

        if (Array.isArray(rawContent)) {
            const parts = rawContent
                .map(part => {
                    if (typeof part === 'string') return part;

                    // Text-only parts
                    if (part?.type === 'text' && part?.text) {
                        return typeof part.text === 'string' ? part.text : part.text?.value;
                    }

                    // New OpenAI format: { type: 'output_text', text: { value } }
                    if (part?.type === 'output_text') {
                        if (typeof part.text === 'string') return part.text;
                        if (part.text?.value) return part.text.value;
                    }

                    // Fallback for any other shapes that contain a text field
                    if (typeof part?.text === 'string') return part.text;
                    if (part?.text?.value) return part.text.value;
                    return '';
                })
                .filter(Boolean);

            return parts.length ? parts.join(' ') : null;
        }

        return null;
    }

    /**
     * Format image generation response to standardized structure
     */
    formatImageResponse(data) {
        const images = data.data?.map(item => item.b64_json) || [];

        return {
            provider: this.name,
            images,
            imageBase64: images[0] || null,
            count: images.length,
            raw: data
        };
    }
}

module.exports = OpenAIProvider;
